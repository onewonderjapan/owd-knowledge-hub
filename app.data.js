/* ============================================================================
   app.data.js — データ層（取得・正規化・遮断・スクラブ）
   ----------------------------------------------------------------------------
   PR #1 の指摘 1（「至少把 i18n 字典和数据层分开」）への対応で index.html から
   切り出した。この層が受け持つのは次の 4 つ。

     BLOCK_SCOPES / BLOCK_TYPES / isPublishable   公開してよいかの判定（安全網）
     isVerified / isOverdue                       検証済み・見直し期限の判定
     kbNormalize / kbScrub / kbScrubTree           形の正規化と社内語の除去
     kbSanitize / kbLoadData                       取得から画面へ渡すまで

   注意：遮断はあくまで**安全網**で、根治はデータ生成側で行う。
   data-side filtering applies; see private ops repo for policy.
   ここを緩めると非公開ナレッジが画面に出るので、変更時は必ず遮断漏れ検査を通すこと。

   読み込み順の決まり：app.i18n.js の後、本体の前。
   トップレベルの let / const はグローバル字句環境に入るため、後続の
   classic script から DATA / isPublishable などをそのまま参照できる。
   ========================================================================== */
/* 数据加载：内嵌 payload（内部版）直接用；公开版从 CDN 拉取 kb-data.json */
let DATA = null;
/* 公開可否は scope / type という構造的な印だけで判定する（安全網）。
   ここを通らないナレッジは一覧・検索・詳細・CSV・グラフの全経路から外れるので、
   遮断する印を 1 つ足すだけで全画面に一括で効く。
   runbook を type で塞ぐのは、運用手順書が種類として常に社内向けだから。
   これはページ側の安全網にすぎない。根治はデータ生成側で出力しないこと。
   data-side filtering applies; see private ops repo for policy. */
const BLOCK_SCOPES = ['customer-confidential', 'internal'];
const BLOCK_TYPES = ['runbook'];
/* R33：この KB で「検証済み」とは、検証日（verified_at）を持つことをいう。
   status=='verified' は実測で 4 件が検証日を持たず（日付の裏づけが無い）、
   review.unverified は公開 17 件すべてを載せるため、どちらも判定には使わない。
   詳細画面の「検証日 / 次回見直し」と同じ軸なので、画面間で食い違わない。 */
const isVerified = n => !!(n && n.verified_at);
/* R33：見直し期限を過ぎているか。詳細画面の鮮度ドットと同じ材料を使う。 */
const isOverdue = n => !!(n && n.stale_limit && (n.days || 0) > n.stale_limit);
const isPublishable = n => !!n
  && BLOCK_SCOPES.indexOf(n.scope) < 0
  && BLOCK_TYPES.indexOf(n.type) < 0;
/* 内部マーカーの除去（安全網）。読み込んだ直後に 1 箇所で落とせば、
   一覧・検索・詳細・プレビュー・シグナル・CSV の全経路に一括で効く
   （表示箇所ごとに書くと必ず取りこぼす）。元の値は *_raw に残す。
   data-side filtering applies; see private ops repo for policy.

   除去対象の語そのものは公開ソースに持たない。必要な環境では、このスクリプトを
   読み込む前に window.KB_INTERNAL_WORDS = ["…"] を与える
   （形式は tools/internal-words.example.json、正本は非公開の運用リポジトリ側）。
   何も与えなければ語ベースの規則は 0 本になり、公開可否は scope / type だけで決まる。 */
const KB_INTERNAL_WORDS = (typeof window !== 'undefined' && Array.isArray(window.KB_INTERNAL_WORDS))
  ? window.KB_INTERNAL_WORDS.filter(w => typeof w === 'string' && w.trim() !== '')
  : [];
const kbReEsc = w => String(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/* 区切り記号（中黒・ハイフン・ダッシュ類） */
const KB_SEP = '[\\u00b7\\u30fb\\-\\u2014\\u2013]';
/* 空白の扱い：\s* は**改行も食う**ため使わない。本文の見出しは行末で終わり、
   その次の行が続く。改行まで消すと見出しと次の行が 1 行に繋がって壊れる。
   行内の空白だけを対象にする（[^\S\r\n] = 改行以外の空白）。 */
const KB_SPC = '[^\\S\\r\\n]*';
/* 括弧ごと落とす規則。前後がそのまま繋がって文として成立するので、
   題名・要約・本文のどこに出ても当てて構わない。 */
const kbBracketRule = w =>
  [new RegExp(KB_SPC + '[（(]' + KB_SPC + kbReEsc(w) + '[^）)]{0,40}[）)]' + KB_SPC, 'g'), ''];
/* 区切り記号付きの前置き・後置き。題名・要約のような短い文字列にだけ当てる
   （長文の散文では文の主語として出ることがあり、消すと文が壊れる）。 */
const kbEdgeRules = w => [
  [new RegExp('^\\s*' + kbReEsc(w) + '\\s*' + KB_SEP + '\\s*', 'g'), ''],
  [new RegExp('\\s*' + KB_SEP + '\\s*' + kbReEsc(w) + '\\s*$', 'g'), '']
];
/* 構造的な規則：内部の作業管理番号は「括弧 ＋ 英字 1 文字 ＋ ハイフン ＋ 数字」
   という形をしているので、語彙を持たずに形だけで落とせる。
   呼ばれるたびに新しい RegExp を作るのは、g 付き正規表現が lastIndex という
   状態を持つため（配列をまたいで共有しない）。 */
const kbIdRule = () =>
  [new RegExp(KB_SPC + '[（(]' + KB_SPC + '[A-Za-z]-\\d+' + KB_SPC + '[）)]' + KB_SPC, 'g'), ''];
const kbRules = edges => KB_INTERNAL_WORDS.reduce(
  (acc, w) => acc.concat([kbBracketRule(w)], edges ? kbEdgeRules(w) : []),
  [kbIdRule()]
);
/* 本文（content）専用。長文なので、文として崩れない規則だけを当てる */
const KB_SCRUB_BODY = kbRules(false);
/* 題名・要約用。短い文字列なので前置き・後置きの除去まで当てる */
const KB_SCRUB = kbRules(true);
/* データ全体の走査用。フィールドを列挙する方式では必ず漏れる
   （被リンク一覧・目次・グラフのノード名などにも同じ文字列が出る）ので、
   データ全体を 1 回走査して当てる。*_raw（元値の控え）は触らない。 */
const KB_SCRUB_ANY = kbRules(false);
const kbScrub = v => {
  let t = String(v == null ? '' : v);
  for(const [re, to] of KB_SCRUB) t = t.replace(re, to);
  return t.trim();
};
function kbScrubTree(o, depth){
  if(depth > 6 || o == null) return o;
  if(typeof o === 'string'){
    let t = o;
    for(const [re, to] of KB_SCRUB_ANY) t = t.replace(re, to);
    return t;
  }
  if(Array.isArray(o)){
    for(let i = 0; i < o.length; i++) o[i] = kbScrubTree(o[i], depth + 1);
    return o;
  }
  if(typeof o === 'object'){
    for(const k of Object.keys(o)){
      if(/_raw$/.test(k)) continue;
      o[k] = kbScrubTree(o[k], depth + 1);
    }
    return o;
  }
  return o;
}
/* R18：描画側が「配列である」「文字列である」ことを前提にしているフィールドを、
   読み込んだ直後に一度だけ正規化する。
   実測で `notes[].backlinks` が null のデータを流したところ
   `n.backlinks.length` で例外になり、**CSV 書き出しが黙って失敗**した
   （ナレッジ詳細でも例外）。フィールドの欠損は publish 側の不具合や
   部分的なデータ更新で現実に起こりうるので、描画箇所ごとに `||[]` を
   足すのではなく入口で形をそろえる。 */
function kbNormalize(d){
  if(!d) return d;
  var arr = function(v){ return Array.isArray(v) ? v : []; };
  var str = function(v){ return v == null ? '' : String(v); };
  var num = function(v){ var n = Number(v); return isFinite(n) ? n : 0; };
  if(Array.isArray(d.notes)) d.notes.forEach(function(n){
    if(!n) return;
    n.tags = arr(n.tags);
    n.backlinks = arr(n.backlinks);
    n.sources = arr(n.sources);
    n.entities = arr(n.entities);
    n.charts = arr(n.charts);
    n.toc = arr(n.toc);
    n.title = str(n.title);
    n.summary = str(n.summary);
    n.content = str(n.content);
    n.days = num(n.days);
  });
  d.conclusions = arr(d.conclusions);
  d.conclusions.forEach(function(c){ if(c){ c.text = str(c.text); c.section = str(c.section); } });
  d.entries = arr(d.entries);
  d.entries.forEach(function(e){ if(e) e.text = str(e.text); });
  d.heat = arr(d.heat);
  d.heat.forEach(function(h){ if(h) h.kw = arr(h.kw); });
  if(d.boards && typeof d.boards === 'object')
    Object.keys(d.boards).forEach(function(k){ if(d.boards[k]) d.boards[k].kw = arr(d.boards[k].kw); });
  if(!d.boards || typeof d.boards !== 'object') d.boards = {};
  if(!d.watchlist || typeof d.watchlist !== 'object') d.watchlist = {};
  if(!d.kw || typeof d.kw !== 'object') d.kw = {};
  d.kw.top = arr(d.kw.top);
  d.kw.rising = arr(d.kw.rising);
  if(!d.today || typeof d.today !== 'object') d.today = {};
  d.today.added = arr(d.today.added);
  if(!d.review || typeof d.review !== 'object') d.review = {};
  d.review.unverified = arr(d.review.unverified);
  ['graph','entity_graph'].forEach(function(g){
    if(!d[g] || typeof d[g] !== 'object') d[g] = {};
    d[g].nodes = arr(d[g].nodes);
    d[g].edges = arr(d[g].edges);
  });
  /* stats が丸ごと欠けると topic_names の参照で落ちてサイト全体が開けなくなる
     （実測：「ナレッジデータの読み込みに失敗しました」と誤った原因が出る）。
     最低限の形を用意して、件数は 0 として扱う。 */
  if(!d.stats || typeof d.stats !== 'object') d.stats = {};
  var st = d.stats;
  if(!st.topic_names || typeof st.topic_names !== 'object') st.topic_names = {};
  if(!st.topics || typeof st.topics !== 'object') st.topics = {};
  if(!st.types || typeof st.types !== 'object') st.types = {};
  if(!st.lines || typeof st.lines !== 'object') st.lines = {};
  st.platforms = arr(st.platforms);
  ['notes','entries','claims','points'].forEach(function(k){ if(typeof st[k] !== 'number') st[k] = 0; });
  return d;
}
function kbSanitize(d){
  d = kbNormalize(d);
  if(!d || !Array.isArray(d.notes)) return d;
  d.notes.forEach(n => {
    ['title','summary'].forEach(f => {
      const before = n[f];
      if(before == null) return;
      const after = kbScrub(before);
      /* 空になってしまう場合は元を残す（題名が丸ごと消えるのを防ぐ） */
      if(after !== before && after !== ''){ n[f + '_raw'] = before; n[f] = after; }
    });
    /* 本文も同様に。ただし本文は長文なので、文として崩れない規則だけを当てる
       （散文中では文の主語や分析対象として出る語があり、消すと文が壊れる）。 */
    if(n.content != null){
      let c = String(n.content);
      const before = c;
      for(const [re, to] of KB_SCRUB_BODY) c = c.replace(re, to);
      if(c !== before){ n.content_raw = before; n.content = c; }
    }
  });
  /* R12-b6：遮断したナレッジの分を、ビルド時に算出済みの集計値から差し引く。
     ここを直さないと「テーマ別の動き」が 20 件と出るのに詳細は 19 件しか無い、
     といった食い違いが残る（集計はデータ生成側で数えた値なので遮断を知らない）。 */
  const blocked = d.notes.filter(n => !isPublishable(n));
  if(blocked.length){
    const blockedIds = new Set(blocked.map(n => n.id));
    /* 事業ラインのタイルの件数 */
    if(d.stats && d.stats.lines) blocked.forEach(n => {
      if(n.line && typeof d.stats.lines[n.line] === 'number')
        d.stats.lines[n.line] = Math.max(0, d.stats.lines[n.line] - 1);
    });
    /* テーマ別の動きの件数 */
    if(Array.isArray(d.heat)) blocked.forEach(n => {
      const row = d.heat.find(h => h.topic === n.topic);
      if(row && typeof row.notes === 'number') row.notes = Math.max(0, row.notes - 1);
    });
    /* テーマカードの件数（heat とは別に boards 側にも持っている） */
    if(d.boards) blocked.forEach(n => {
      const b = d.boards[n.topic];
      if(b && typeof b.notes === 'number') b.notes = Math.max(0, b.notes - 1);
    });
    /* ウォッチリストは id の配列なので厳密に除ける */
    if(d.watchlist) Object.keys(d.watchlist).forEach(k => {
      if(Array.isArray(d.watchlist[k]))
        d.watchlist[k] = d.watchlist[k].filter(id => !blockedIds.has(id));
    });
    /* 遮断前の総数。表示には使わないが、突き合わせのために残す */
    if(d.stats) d.stats.notes_raw = d.stats.notes;
  }
  /* 題名・要約・本文の個別処理（*_raw の控え作成）が終わったあとに全体走査。
     これで控えは skip され、残りのフィールドから漏れが消える。 */
  kbScrubTree(d, 0);
  return d;
}
function kbLoadData(){
  const el = document.getElementById('kb-data');
  const t = el ? el.textContent.trim() : '';
  if(t) return Promise.resolve(kbSanitize(JSON.parse(t)));
  const url = window.__KB_DATA_URL__ || 'data/kb-data.json';
  return fetch(url, {cache:'no-store'}).then(r => {
    if(!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(kbSanitize);
}
