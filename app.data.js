/* ============================================================================
   app.data.js — データ層（取得・正規化・遮断・スクラブ）
   ----------------------------------------------------------------------------
   PR #1 の指摘 1（「至少把 i18n 字典和数据层分开」）への対応で index.html から
   切り出した。この層が受け持つのは次の 4 つ。

     BLOCK_SCOPES / BLOCK_TYPES / isPublishable   公開してよいかの判定（安全網）
     isVerified / isOverdue                       検証済み・見直し期限の判定
     kbNormalize / kbScrub / kbScrubTree           形の正規化と社内語の除去
     kbSanitize / kbLoadData                       取得から画面へ渡すまで

   注意：遮断はあくまで**安全網**で、根治は publish-data.sh 側（PR #1 指摘 3）。
   ここを緩めると非公開ナレッジが画面に出るので、変更時は必ず遮断漏れ検査を通すこと。

   読み込み順の決まり：app.i18n.js の後、本体の前。
   トップレベルの let / const はグローバル字句環境に入るため、後続の
   classic script から DATA / isPublishable などをそのまま参照できる。
   ========================================================================== */
/* 数据加载：内嵌 payload（内部版）直接用；公开版从 CDN 拉取 kb-data.json */
let DATA = null;
/* R1（内部商業情報の保護 / 安全網）：顧客機密ナレッジのハードブロック。
   従来 renderDetail は scope === 'customer-confidential' のナレッジに「客户机密」バッジを
   付けて “そのまま表示” していた。README のレッドライン（顧客案件資料は公開リポジトリに
   入れない）に対して、ページ側が表示してしまう作りだったため除外に変更する。
   現行データに該当は 0 件のため、表示内容への影響はない（純粋な安全網）。

   NOTE（方針＝案 C）：scope === 'internal' の 63 件は利用者判断により
   意図的にフィルタしていない。将来これも遮断する場合は BLOCK_SCOPES に 'internal' を
   1 語追加すれば、一覧・検索・詳細・CSV・グラフの全経路に一括で効く。
   ただし本来の恒久対策は publish-data.sh 側で kb-data.json に出力しないこと。

   R12：内部の運用手順書は対外公開物に載せない。
   監査で type:'runbook' が 1 件（ark-harness の README、scope:internal）見つかり、
   社内の自己学習 harness の構成と「各赛道状态与上手指南」がそのまま公開されていた。
   scope でなく type で塞ぐのは、runbook が種類として常に社内向けだから。

   R12：この判定は kbSanitize（集計値の補正）からも使うため、
   kbMain の外＝モジュール先頭に置く。 */
/* ==== R26①：社内資料を公開画面から外す ====
   実測（R23〜R25 の検査）：notes 80 件のうち scope='internal' が 63 件あるのに、
   遮断対象は 'customer-confidential'（該当 0 件）と type='runbook'（1 件）だけで、
   **62 件がそのまま公開されていた**。公開されていたものには
     Wonder4ge ワールドBible（世界机制正典 / SSOT）
     Wonder4ge 成员正典卡（yaya / gaga / juju / baibai）／成员关系正典
     面具讽刺角色正典（S / B / BP）／生成安全词汇表／世界事件时间线
     Wonder4ge 角色资产 v2 生成规格（Codex imagen 用）  ← 画像生成の指示書
     Season 1 方向书（2026-08-16 用户重定…）           ← 社内方針
     canon_fact 1/15〜15/15・skill_policy 1〜3・visual_asset 1〜3
   が含まれ、README の赤線（正典アセットの保護／公開内容だけを置く）に抵触していた。

   type × scope を実測した結果：
     canon 30・research 20・playbook 6・spec 4・decision 2・runbook 1 → すべて internal
     digest 9・experiment 8                                          → 印なし
   つまり type で絞る案（canon+spec+decision+playbook を遮断）では research 20 件が
   internal のまま残り、目的を達成しない。'internal' という印はまさに
   「社内用」を示すために付いているので、それを遮断対象にするのが筋が通る。

   公開件数は 79 → 17（digest 9 + experiment 8）に減る。ヒーローの指標も
   pubNotes() を経由しているので自動で追随する。

   ⚠️ これはページ側の安全網にすぎない。CDN の kb-data.json には
   internal 63 件の本文がそのまま入っており、JSON の URL を直接開けば読める
   （実測：Access-Control-Allow-Origin: * / 認証なし / 200）。
   恒久対策は publish-data.sh 側で出力しないこと。 */
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
/* R12（内部商業情報の保護）：データ側に残っている内部マーカーを、読み込んだ直後に
   1 箇所で落とす。ここで潰せば一覧・検索・詳細・プレビュー・シグナル・CSV の
   全経路に一括で効く（表示箇所ごとに書くと必ず取りこぼす）。
   元の値は *_raw に残すので、後から突き合わせができる。
   恒久対策は publish-data.sh 側で kb-data.json に出力しないこと。 */
/* R16：本文（content）専用の規則。題名・要約とは文脈が違うので分ける。
   R14 では題名と要約だけを対象にしていたため、本文の Markdown 見出しや
   相互参照リンクのラベルに内部の作業管理番号が残り、画面に出ていた
   （実測：ナレッジ詳細に「（L-15）」「知识波」が表示されていた）。 */
const KB_SCRUB_BODY = [
  /* R16-b1：当初は前後を \s* にしていたが、これは**改行も食う**。
     本文の見出しは行末が「…v1（L-15）」で、その次の行が「> Summary: …」なので、
     改行まで消えた結果 h1 と引用が 1 行に繋がり、
     「題名 ＋ Summary 全文」という巨大な見出しになっていた（実測 4 件）。
     行内の空白だけを対象にする（[^\S\r\n] = 改行以外の空白）。 */
  /* 社内の作業管理番号。本文では見出しと相互参照リンクのラベルに出る */
  [/[^\S\r\n]*[（(][^\S\r\n]*L-\d+[^\S\r\n]*[）)][^\S\r\n]*/g, ''],
  /* 内部の情報収集タスク名。「由 Codex 定期任务（知识波 Daily Intelligence Hub）
     每日研究产出」という形で 13 件の digest 本文に出る。
     括弧ごと落とすと前後がそのまま繋がって文として成立する。 */
  [/[^\S\r\n]*[（(][^\S\r\n]*知识波[^）)]{0,40}[）)][^\S\r\n]*/g, '']
];
const KB_SCRUB = [
  /* 社内の作業管理番号（L-nn）。対外的に意味が無く、ナレッジ 4 件の題名に出ていた */
  [/\s*[（(]\s*L-\d+\s*[）)]\s*/g, ''],
  /* 内部の情報収集タスク名と実行系の名前。digest 8 件の要約が
     「codex 每日情报任务"知识波"的…」で始まり、社内の運用体制が読み取れていた */
  [/^\s*codex\s*每日情报任务\s*["\u201c\u201d\u300c\u300d']*\s*知识波\s*["\u201c\u201d\u300c\u300d']*\s*的\s*/g, ''],
  /* 社内アカウント呼称。区切り記号ごと落とす（前置き・後置きの両方に出る） */
  [/^\s*白菜咕咕\s*[\u00b7\u30fb\-\u2014\u2013]\s*/g, ''],
  [/\s*[\u00b7\u30fb\-\u2014\u2013]\s*白菜咕咕\s*$/g, '']
];
const kbScrub = v => {
  let t = String(v == null ? '' : v);
  for(const [re, to] of KB_SCRUB) t = t.replace(re, to);
  return t.trim();
};
/* R16：L-nn と内部タスク名は「どの文字列に出ても」落として構わない
   （括弧ごと消えるだけで文が壊れない）。フィールドを列挙する方式では必ず漏れる
   ——実測で backlinks[].title（14 箇所）/ toc[].text（6）/ graph.nodes[].title（6）/
   review.unverified[].title（4）に残り、被リンク一覧として画面に出ていた。
   データ全体を 1 回走査して当てる。*_raw（元値の控え）は触らない。 */
const KB_SCRUB_ANY = [
  /* R16-b1 と同じ理由で改行は食わない */
  [/[^\S\r\n]*[（(][^\S\r\n]*L-\d+[^\S\r\n]*[）)][^\S\r\n]*/g, ''],
  [/[^\S\r\n]*[（(][^\S\r\n]*知识波[^）)]{0,40}[）)][^\S\r\n]*/g, '']
];
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
    /* R16：本文も同様に。ただし本文は長文なので、文として崩れない規則だけを当てる。
       固有名詞「白菜咕咕」は本文では文の主語や分析対象として出るため触らない
       （公開アカウント名であり、消すと文が壊れる。題名では区切り記号ごと
       落とせたので R14 で処理済み）。 */
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
