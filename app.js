/* ============================================================================
   app.js — 画面の本体
   ----------------------------------------------------------------------------
   PR #1 の指摘 1（「后续请拆 app.css / app.js」）への対応で index.html から
   切り出した。

   読み込み順の決まり：
     index.html の言語判定 → app.i18n.js → app.data.js → **このファイル**
   app.i18n.js の KT() と app.data.js の DATA / isPublishable に依存するため、
   必ずその 2 つより後に読み込むこと（pr-check.mjs が順序を検査する）。

   構成：アプリ全体が kbMain() の中にあり、末尾の kbBoot() が
   データ取得 → kbMain() の順で起動する。
   ========================================================================== */
function kbMain(){
const state = {tab:'overview', q:'', topic:'', tag:'', fresh:'', line:'', sel:null, entity:null, entityFrom:'', actExpand:false, conclFull:false, boardTopic:'', boardLine:'', graphMode:'entity', noteView:'list',
  /* R34：状態（検証済み / 未検証 / 見直し期限切れ / つながりなし）での絞り込み。
     '' なら絞らない。健全性パネルの数字を押したときもここに入る。 */
  noteState:'',
  /* R15: 検索結果ビュー。searchFrom = 検索を始めたときのタブ（解除で戻る先）、
     srFull = 種類ごとの全件展開フラグ。 */
  searchFrom:'', srFull:{},
  /* R21-5：ナレッジの「更新時期」絞り込み（'' | '7' | '30' | '90'）。
     動画データは 5 軸あるのにナレッジは並べ方だけで、
     「直近 1 か月だけ見たい」ができなかった。 */
  notePeriod:'',
  vp:'', vc:'', vcat:'', vdur:'', vviews:'', vscope:'video', vout:false,
  sort:{key:'views_num', dir:-1}};
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* 遮断判定（BLOCK_SCOPES / BLOCK_TYPES / isPublishable）はモジュール先頭で定義済み。
   公開対象のナレッジ件数。画面に出す件数は必ずこれを使う
   （DATA.stats.notes は遮断前の数なので、一覧の行数と食い違う）。 */
const pubNotes = () => DATA.notes.filter(isPublishable);
/* noteById は詳細ビュー・ハッシュ直打ち・実験詳細・被リンク解決など全経路が通るため、
   ここで塞げば個別ビューの取りこぼしが起きない。 */
const noteById = id => { const n = DATA.notes.find(x => x.id === id); return isPublishable(n) ? n : undefined; };
const PNAME = {youtube:'YouTube', tiktok:'TikTok', instagram:'Instagram', xiaohongshu:'小红书', analysis:'分析'};
const PCOLOR = {youtube:'#ff6b6b', tiktok:'#25f4ee', instagram:'#e1306c', xiaohongshu:'#ff2442', analysis:'#a78bfa'};
/* 浅色主题下的品牌色加深变体（保证白字/白底对比度） */
const PCDARK = {youtube:'#c22b2b', tiktok:'#0e7c86', instagram:'#ad1f59', xiaohongshu:'#d61f2f', analysis:'#6d28d9'};
const pcolor = p => isLight() ? (PCDARK[p] || PCOLOR[p]) : PCOLOR[p];
/* R11-b4: .pf（プラットフォーム章）は CSS で白文字固定だが、暗テーマでは
   pcolor() が明るいブランド色を返すため白字が読めなかった
   （TikTok の #25f4ee で 1.38:1、AA の 4.5:1 を大きく下回る）。
   ブランド色そのものは図表の塗りとして正しいので色は変えず、
   章の文字色だけを背景輝度から決める。白と黒の適用範囲は重なるため
   （白は L≦0.183、黒は L≧0.175）どの色でも 4.5:1 を満たす。 */
const pfInk = c => {
  let r, g, b;
  let m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c);
  if(m){ r = parseInt(m[1],16); g = parseInt(m[2],16); b = parseInt(m[3],16); }
  else {
    m = /^hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/i.exec(c);
    if(!m) return '#fff';
    const h = +m[1]/360, s = +m[2]/100, l = +m[3]/100;
    const q = l < .5 ? l*(1+s) : l+s-l*s, pp = 2*l-q;
    const hue = t => { t = (t+1)%1;
      if(t < 1/6) return pp+(q-pp)*6*t;
      if(t < 1/2) return q;
      if(t < 2/3) return pp+(q-pp)*(2/3-t)*6;
      return pp; };
    r = hue(h+1/3)*255; g = hue(h)*255; b = hue(h-1/3)*255;
  }
  const lin = v => { v /= 255; return v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); };
  const L = .2126*lin(r) + .7152*lin(g) + .0722*lin(b);
  return L <= 0.183 ? '#fff' : '#000';
};
const IC = {
  trophy:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M7 6H4a2 2 0 0 0 2 4h1M17 6h3a2 2 0 0 1-2 4h-1"/></svg>',
  clock:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  layers:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 2 7l10 5 10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>',
  chart:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 16v-5M12 16V8M17 16v-3"/></svg>',
  search:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
  check:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 5-6"/></svg>',
  health:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
  cal:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>'
};
/* R1: 信頼度の記号（CDN データ側の値）→ 表示名を多言語化。
   キーはデータ側の記号のままで、値だけ i18n キーに置き換えている。 */
const CRED_KEY = {'榜':'cred_rank','媒':'cred_media','估':'cred_est','榜/媒':'cred_rank_media','媒/估':'cred_media_est'};
const credName = c => CRED_KEY[c] ? KT(CRED_KEY[c]) : (c || KT('cred_none'));
const topicColor = t => PCOLOR[t] || 'var(--accent)';
/* R11: テーマ名の表示。分類語彙の対訳（taxo）→ PNAME（プラットフォーム固有名詞と
   データ由来の表示名）→ スラッグ、の順に解決する。
   PNAME を直接引いていた箇所はすべてこれに置き換えた（球体のラベル・テーマ別の動き・
   キーワード榜・ナレッジのメタ・エンティティビュー・グラフなど）。
   metricLabel / noteType も同じ考え方で分類語彙を引く。 */
const topicName = t => window.taxo('topic', t) !== t ? window.taxo('topic', t) : (PNAME[t] || t);
const metricLabel = v => window.taxo('metric', v);
const noteType = v => window.taxo('ntype', v);
const catLabel = v => window.taxo('cat', v);
/* ==== R20-B1：検索の当たり判定に「画面に出ている表示名」を含める ====
   実測（R20 検査）：画面のタブに「動画データ」、テーマカードに「動画生成 AI」
   「コンテンツ制作」「市場・マクロ情報」と出ているのに、その語で検索すると
   いずれも 0 件だった。分類語彙は taxo() で*表示するとき*に訳しているだけで、
   検索は生データ（topic / type / category のスラッグ）しか見ていなかったため。
   利用者は画面で読んだ語をそのまま打つので、表示名も干し草に入れる。
   絞り込み側（filteredNotes / filteredVideos / renderConclWall）と
   検索結果ビュー側（*ForSearch / searchConclusions）で同じ関数を通し、
   「タブの件数」と「検索結果の件数」がずれないようにする。 */
const _hs = v => v == null ? '' : String(v);
function noteHay(n){
  return (_hs(n.title) + ' ' + _hs(n.summary) + ' ' + (n.tags||[]).join(' ') + ' ' + _hs(n.content)
    + ' ' + _hs(topicName(n.topic)) + ' ' + _hs(noteType(n.type))
    + ' ' + (n.line ? _hs(lineName(n.line)) : '')).toLowerCase();
}
function videoHay(e){
  const src = noteById(e.note_id);
  return (_hs(e.text) + ' ' + (src ? _hs(src.title) : '')
    + ' ' + _hs(topicName(e.platform))
    + ' ' + (e.category ? _hs(catLabel(e.category)) : '')).toLowerCase();
}
function conclHay(c){
  return (_hs(c.text) + ' ' + _hs(c.section) + ' ' + _hs(topicName(c.topic))).toLowerCase();
}
/* ==== R21-2：空白区切りを AND として扱う ====
   実測（R20 検査）：「Claude 価格」で 0 件だった。全体を 1 つの文字列として
   探していたため、2 語入れると必ず外れる作りだった。人は普通に 2 語入れる。
   全角スペースも区切りに含める（日本語入力では全角が混じる）。 */
function qTokens(q){
  return String(q == null ? '' : q).toLowerCase().split(/[\s　]+/).filter(Boolean);
}
function hayHit(hay, toks){
  if(!toks || !toks.length) return false;
  for(let i = 0; i < toks.length; i++) if(hay.indexOf(toks[i]) < 0) return false;
  return true;
}
/* ==== R21-2：ヒット箇所を <mark> で囲む ====
   生の文字列を走査し、区間ごとに esc() してから <mark> を挟む。
   「エスケープ済みの文字列をあとから置換」だと、語に < > & が入ったときや
   2 語目が "mark" だったときにタグを壊すため、この順序でなければならない。 */
function escHi(str, toks){
  const raw = String(str == null ? '' : str);
  const list = (toks || []).filter(Boolean);
  if(!list.length) return esc(raw);
  /* 正規表現のメタ文字を無効化する。文字クラスに ] と \ を書くと
     このファイルを生成するパッチ側でエスケープが縮んで壊れたため、
     コードポイントで判定する（RegExp を組まずに 1 文字ずつ見る）。 */
  const META = '.*+?^${}()|[]\\/-';
  const rxEsc = t => Array.prototype.map.call(String(t),
    ch => META.indexOf(ch) >= 0 ? '\\' + ch : ch).join('');
  const pat = list.map(rxEsc).join('|');
  let out = '', last = 0, m;
  const re = new RegExp(pat, 'gi');
  while((m = re.exec(raw)) !== null){
    if(m.index === re.lastIndex){ re.lastIndex++; continue; }   /* 空マッチの保険 */
    out += esc(raw.slice(last, m.index)) + '<mark>' + esc(m[0]) + '</mark>';
    last = m.index + m[0].length;
  }
  return out + esc(raw.slice(last));
}
/* ==== R20-B8：詳細画面で h1 が 2 つになるのを直す ====
   実測（R20 検査）：ナレッジ／テーマ／実験の詳細では、R16 で足した
   画面レベルの見出し（h1）と、その項目のタイトル（h1）が同時に出ていた。
   詳細の主題は「その項目」なので項目側を h1 に残し、画面レベルを h2 に落とす。
   aria-level だけで済ませないのは、マークアップ上の h1 が 2 つ残ったままだと
   見出し一覧を出す道具の見え方が直らないため。
   class / id / style / data-i18n は引き継ぐので、見た目も言語切替もそのまま。 */
function setHeadLevel(el, tag){
  if(!el || el.tagName.toLowerCase() === tag) return el;
  const r = document.createElement(tag);
  if(el.className) r.className = el.className;
  if(el.id) r.id = el.id;
  const st = el.getAttribute('style'); if(st != null) r.setAttribute('style', st);
  ['data-i18n','data-i18n-title','data-i18n-aria'].forEach(a => {
    const v = el.getAttribute(a); if(v != null) r.setAttribute(a, v);
  });
  r.textContent = el.textContent;
  el.replaceWith(r);
  return r;
}
const isLight = () => document.documentElement.dataset.theme !== 'dark';
/* R1/R2: 桁の区切り方が言語圏で異なるため分岐する。
   ja / zh / ko は漢数詞圏＝万（1e4）・億（1e8）区切り。
   en / es / fr は西洋式＝K（1e3）・M（1e6）・B（1e9）区切り。
   従来は中国語の 万/亿 固定だったため、英語表示時に「336.7 亿」のような表記になっていた。 */
const CJK_NUM_LANGS = ['ja','zh','ko'];
const fmtViews = n => { if(n == null) return '—';
  if(CJK_NUM_LANGS.indexOf(window.KB_LANG) < 0){
    if(n >= 1e9) return (Math.round(n/1e8)/10) + 'B';
    if(n >= 1e6) return (Math.round(n/1e5)/10) + 'M';
    if(n >= 1e3) return (Math.round(n/1e2)/10) + 'K';
    return String(n);
  }
  if(n >= 1e8) return (Math.round(n/1e7)/10) + ' ' + KT('u_oku');
  if(n >= 1e4) return Math.round(n/1e4) + ' ' + KT('u_man');
  return String(n); };
const fmtDur = s => { if(s == null) return '—';
  if(s < 60) return s + KT('u_sec');
  if(s < 3600) return Math.floor(s/60) + ':' + String(s%60).padStart(2,'0');
  return Math.floor(s/3600) + KT('u_hour') + Math.floor(s%3600/60) + KT('u_min'); };
const dotCls = (d, lim) => { lim = lim || 30; return d <= lim/2 ? 'g' : d <= lim ? 'y' : 'r'; };
/* R34：鮮度ドットの説明文。一覧では色しか出ておらず（実測：title も aria-label も
   テキストも無し）、赤と緑だけで見分けさせていた。色覚特性のある方には区別できず、
   WCAG 1.4.1「色だけで情報を伝えない」にも反する。
   詳細画面はドットの隣に「N 日前に更新」の文字があるので、こちらは一覧用。 */
const dotLabel = (d, lim) => {
  const n = Number(d) || 0;
  if(!lim) return KT('dot_none', {n});
  const cls = dotCls(n, lim);
  return KT(cls === 'r' ? 'dot_over' : cls === 'y' ? 'dot_soon' : 'dot_ok', {n, l: lim});
};
/* R1: 多言語化に伴い定数配列から関数へ変更（言語切替時に読み直す必要があるため）。
   本文は KB_I18N の ck 配列を参照する。 */
const CHECKLIST = () => {
  const d = window.KB_I18N[window.KB_LANG] || window.KB_I18N.ja;
  return d.ck || window.KB_I18N.ja.ck;
};

/* 所有条目（含平台级/窗口外，供检索）；CLEAN = 口径干净的单条视频 */
const VIDEOS = DATA.entries.filter(e => e.platform && e.platform !== 'analysis');
const CLEAN = VIDEOS.filter(e => e.scope === 'video' && !e.out_of_window);
/* 通用主题兜底：显示名取自 _topic.md 的 H1，配色按主题名哈希生成 */
{ const tn = DATA.stats.topic_names || {};
  for(const t of Object.keys(DATA.stats.topics)){
    if(!PNAME[t] && tn[t]) PNAME[t] = tn[t];
    if(!PCOLOR[t]){
      let h = 0; for(const c of t) h = (h * 31 + c.charCodeAt(0)) >>> 0;
      PCOLOR[t] = 'hsl(' + (h % 360) + ',62%,55%)';
    }
  }
}

/* 链接协议白名单（T-14d 修复轮 1）：仅 http/https/mailto 与站内相对/锚点成链。
   检测前先做与浏览器一致的 URL 预处理（去 tab/换行、去首尾 C0 控制符与空格、小写），
   防 `java\tscript:`、前导空白等变体绕过；含控制字符的 URL 一律不成链。 */
const hrefAllowed = u => {
  const bare = String(u).replace(/[\t\r\n]/g, '').replace(/^[\x00-\x20]+/, '').replace(/[\x00-\x20]+$/, '').toLowerCase();
  if(/[\x00-\x1f\x7f]/.test(bare)) return false;
  if(/^(https?|mailto):/.test(bare)) return true;      /* 白名单协议 */
  if(/^[#\/]/.test(bare)) return true;                 /* 页内锚点 / 站内（根）相对 */
  return !/^[a-z][a-z0-9+.-]*:/.test(bare);            /* 无协议的站内相对路径；其余协议拒绝 */
};
/* R16：本文中の相対リンクは全部（67 本）内部の作業ファイル（*.md）を指していて、
   本番では 404 になり、しかも href に内部のファイル名とディレクトリ構成
   （`../agent-tips/...` など）が露出していた。
   対応するナレッジがあれば画面内で開く導線に置き換え、
   無ければリンクにせずラベルだけ残す（67 本中 66 本が対応するナレッジを持つ）。 */
const mdNoteTarget = u => {
  const m = /^(?:\.{1,2}\/)*([^\/?#]+)\.md(?:[?#].*)?$/i.exec(String(u).trim());
  if(!m) return null;
  const base = m[1];
  const n = DATA.notes.find(x => x.id === base || x.id.endsWith('-' + base));
  return (n && isPublishable(n)) ? n.id : null;
};
const isMdPath = u => /\.md(?:[?#]|$)/i.test(String(u).trim());
function inline(s){
  s = esc(s);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m,t,u) => {
    const nid = mdNoteTarget(u);
    if(nid) return '<a href="#" data-note="'+esc(nid)+'" rel="noopener noreferrer">'+t+'</a>';
    if(isMdPath(u)) return t;       /* 対応するナレッジが無い .md はリンクにしない */
    if(!hrefAllowed(u)) return m;   /* 白名单外：不成链，整段按纯文本保留（已转义，不丢字） */
    const ext = /^(https?:|\/\/)/i.test(u.replace(/^[\x00-\x20]+/, ''));  /* 外链才开新窗口 */
    return '<a href="'+u+'"'+(ext ? ' target="_blank"' : '')+' rel="noopener noreferrer">'+t+'</a>';
  });
  return s;
}
function renderMD(md){
  const lines = md.split(/\r?\n/); const out = []; let i = 0, inUl = false, inOl = false;
  const closeL = () => { if(inUl){out.push('</ul>'); inUl=false;} if(inOl){out.push('</ol>'); inOl=false;} };
  while(i < lines.length){
    const L = lines[i]; let m;
    if(/^\s*\|/.test(L)){
      closeL(); const rows = [];
      while(i < lines.length && /^\s*\|/.test(lines[i])){
        const cells = lines[i].trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim());
        if(!cells.every(c => c === '' || /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      if(rows.length){
        let t = '<div class="twrap"><table><thead><tr>' + rows[0].map(c=>'<th>'+inline(c)+'</th>').join('') + '</tr></thead><tbody>';
        for(let r=1;r<rows.length;r++) t += '<tr>' + rows[r].map(c=>'<td>'+inline(c)+'</td>').join('') + '</tr>';
        out.push(t + '</tbody></table></div>');
      }
      continue;
    }
    if(m = L.match(/^(#{1,4})\s+(.*)$/)){ closeL(); const lv=m[1].length; out.push('<h'+lv+'>'+inline(m[2])+'</h'+lv+'>'); i++; continue; }
    if(/^\s*(---|\*\*\*)\s*$/.test(L)){ closeL(); out.push('<hr>'); i++; continue; }
    if(m = L.match(/^>\s?(.*)$/)){ closeL(); out.push('<blockquote>'+inline(m[1])+'</blockquote>'); i++; continue; }
    if(m = L.match(/^\s*[-*]\s+(.*)$/)){ if(inOl){out.push('</ol>');inOl=false;} if(!inUl){out.push('<ul>');inUl=true;} out.push('<li>'+inline(m[1])+'</li>'); i++; continue; }
    if(m = L.match(/^\s*\d+\.\s+(.*)$/)){ if(inUl){out.push('</ul>');inUl=false;} if(!inOl){out.push('<ol>');inOl=true;} out.push('<li>'+inline(m[1])+'</li>'); i++; continue; }
    if(!L.trim()){ closeL(); i++; continue; }
    closeL(); out.push('<p>'+inline(L)+'</p>'); i++;
  }
  closeL(); return out.join('\n');
}

/* ---------- 热门视频库 ---------- */
function filteredVideos(){
  const q = state.q.toLowerCase();
  return VIDEOS.filter(e => {
    if(state.vscope === 'video' && e.scope !== 'video') return false;
    if(state.vscope === 'platform' && e.scope !== 'platform') return false;
    if(!state.vout && e.out_of_window) return false;
    if(state.vp && e.platform !== state.vp) return false;
    if(state.vc && credName(e.credibility) !== credName(state.vc) && !(state.vc === '__none' && !e.credibility)) return false;
    if(state.vcat && e.category !== state.vcat) return false;
    if(state.vdur === 's15' && !(e.duration_s != null && e.duration_s < 15)) return false;
    if(state.vdur === 's60' && !(e.duration_s != null && e.duration_s >= 15 && e.duration_s <= 60)) return false;
    if(state.vdur === 'm1' && !(e.duration_s != null && e.duration_s > 60 && e.duration_s <= 180)) return false;
    if(state.vdur === 'm3' && !(e.duration_s != null && e.duration_s > 180)) return false;
    if(state.vviews === 'has' && e.views_num == null) return false;
    if(state.vviews && state.vviews !== 'has' && !(e.views_num >= +state.vviews)) return false;
    if(q && !hayHit(videoHay(e), qTokens(q))) return false;   /* R20-B1 / R21-2 */
    return true;
  });
}
function renderVideoFacets(){
  const counts = {};
  VIDEOS.forEach(e => counts[e.platform] = (counts[e.platform]||0) + 1);
  const creds = [...new Set(VIDEOS.filter(e => e.credibility).map(e => e.credibility))].sort();
  const noneN = VIDEOS.filter(e => !e.credibility).length;
  const cats = [...new Set(VIDEOS.map(e => e.category).filter(Boolean))].sort();
  const el = $('#v-facets');
  const opt = (v, cur, label) => '<option value="'+v+'"'+(cur===v?' selected':'')+'>'+esc(label)+'</option>';
  let h = '<span class="tagchip'+(state.vp===''?' on':'')+'" data-pf="">'+esc(KT('v_all',{n:VIDEOS.length}))+'</span>';
  for(const p of DATA.stats.platforms)
    /* R14-b1：ここだけ PNAME を直参照していたため、絞り込みチップが「小红书」、
       すぐ下の表のバッジが「Xiaohongshu」と、同じタブ内で表記が 2 通りになっていた
       （R12 でバッジ側を topicName に寄せたときの取りこぼし）。 */
    h += '<span class="tagchip'+(state.vp===p?' on':'')+'" data-pf="'+p+'">'+esc(topicName(p))+' '+counts[p]+'</span>';
  /* R14-b2：5 つの select は aria-label / title / label のどれも無く、
     支援技術には「ラベルの無いコンボボックス」と読まれていた。
     視覚的にも 5 つ並ぶと何の絞り込みか分からないので title も入れる
     （レイアウトを変えずに済ませるため、可視ラベルは追加していない）。 */
  const sel = (id, key) => ' <select id="'+id+'" aria-label="'+esc(KT(key))+'" title="'+esc(KT(key))+'">';
  h += sel('v-scope','vf_scope')
    + opt('video', state.vscope, KT('v_scope_video')) + opt('platform', state.vscope, KT('v_scope_plat'))
    + opt('', state.vscope, KT('v_scope_all')) + '</select>'
    + sel('v-cat','vf_cat') + opt('', state.vcat, KT('v_cat_all'))
    + cats.map(c => opt(esc(c), state.vcat, catLabel(c))).join('') + '</select>'
    + sel('v-dur','vf_dur') + opt('', state.vdur, KT('v_dur_all'))
    + opt('s15', state.vdur, KT('v_dur1')) + opt('s60', state.vdur, KT('v_dur2'))
    + opt('m1', state.vdur, KT('v_dur3')) + opt('m3', state.vdur, KT('v_dur4')) + '</select>'
    + sel('v-views','vf_views') + opt('', state.vviews, KT('v_views_all'))
    + opt('has', state.vviews, KT('v_views_has')) + opt('1000000', state.vviews, KT('v_views_1m'))
    + opt('10000000', state.vviews, KT('v_views_10m')) + opt('100000000', state.vviews, KT('v_views_100m')) + '</select>'
    + sel('v-cred','vf_cred') + opt('', state.vc, KT('v_cred_all'))
    + creds.map(c => opt(esc(c), state.vc, credName(c))).join('')
    + opt('__none', state.vc, KT('v_cred_none') + ' (' + noneN + ')') + '</select>'
    + ' <label><input type="checkbox" id="v-out"'+(state.vout?' checked':'')+'>'+esc(KT('v_out'))+'</label>'
    + ' <button class="btn" id="v-csv">'+esc(KT('v_export'))+'</button>';
  el.innerHTML = h;
  el.querySelectorAll('[data-pf]').forEach(c => c.onclick = () => { state.vp = c.dataset.pf; renderVideoFacets(); renderVideos(); });
  $('#v-scope').onchange = e => { state.vscope = e.target.value; renderVideos(); };
  $('#v-cat').onchange = e => { state.vcat = e.target.value; renderVideos(); };
  $('#v-dur').onchange = e => { state.vdur = e.target.value; renderVideos(); };
  $('#v-views').onchange = e => { state.vviews = e.target.value; renderVideos(); };
  $('#v-cred').onchange = e => { state.vc = e.target.value; renderVideos(); };
  $('#v-out').onchange = e => { state.vout = e.target.checked; renderVideos(); };
  $('#v-csv').onclick = exportCSV;
}
function exportCSV(){
  const vs = filteredVideos();
  const cols = ['rank','title','creator','platform','metric','metric_type_label','views_num','duration_s','month','category','credibility','scope','out_of_window','why'];
  const head = ['#', KT('th_title'), KT('th_creator'), KT('th_platform'), KT('th_metric'), KT('th_unit'),
    KT('th_views_num'), KT('th_dur_s'), KT('th_month'), KT('th_cat'), KT('th_cred'), KT('th_scope'),
    KT('th_out'), KT('th_why')];
  const q = s => '"' + String(s ?? '').replace(/"/g,'""') + '"';
  const csv = '\uFEFF' + [head.map(q).join(',')].concat(vs.map(e => cols.map(c => q(e[c])).join(','))).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}));
  a.download = 'kb-videos-' + DATA.built_at.slice(0,10) + '.csv';
  a.click();
}
function renderVideos(){
  let vs = filteredVideos().slice();
  const k = state.sort.key, d = state.sort.dir;
  vs.sort((a,b) => {
    let x = a[k], y = b[k];
    if(x == null) return 1; if(y == null) return -1;
    if(typeof x === 'string'){ x = x.toLowerCase(); y = y.toLowerCase(); }
    return (x < y ? -1 : x > y ? 1 : 0) * d;
  });
  const CAP = 200; const show = vs.slice(0, CAP);
  /* R30#9：aria-sort で並び順を読み上げに伝え、tabindex でキーボードから
     押せるようにする（role は columnheader のまま＝表の意味を壊さない）。 */
  const th = (key, label) => '<th class="sortable" data-sk="'+key+'" tabindex="0"'
    + ' aria-sort="'+(state.sort.key===key ? (state.sort.dir===-1?'descending':'ascending') : 'none')+'">'
    + label
    + (state.sort.key===key ? (state.sort.dir===-1?' ▼':' ▲') : '') + '</th>';
  let h = (vs.length > CAP ? '<p class="kbd">'+esc(KT('v_count',{a:vs.length, b:CAP}))+'</p>' : '')
    + '<div class="twrap"><table><thead><tr>'
    + th('rank','#') + '<th>'+esc(KT('th_title'))+'</th><th>'+esc(KT('th_creator'))+'</th>'
    + '<th>'+esc(KT('th_platform'))+'</th><th>'+esc(KT('th_metric'))+'</th>'
    + th('views_num', esc(KT('th_views'))) + th('duration_s', esc(KT('th_dur')))
    /* R29#5：「出典」列を外した。実測で entries 90 件すべての note_id が
       非公開ナレッジを指しており、76 行すべてが「—」になっていた。
       辿れる出典が戻ったら th_src / 下の td を復活させる。 */
    + '<th>'+esc(KT('th_cred'))+'</th>'
    + '</tr></thead><tbody>';
  for(const e of show){
    /* T-13 榜单总控点评位：来源笔记带可选 frontmatter editor_note 时在条目上展示（仅公开版） */
    const en = DATA.public ? (noteById(e.note_id) || {}).editor_note : '';
    h += '<tr class="vrow" data-note="'+esc(e.note_id)+'" title="'+esc(e.why||e.preview)+(e.month?esc(KT('v_peak',{d:e.month})):'')+'">'
      + '<td class="muted">'+esc(e.rank)+'</td>'
      + '<td style="max-width:340px"><b>'+esc(e.title.slice(0,42))+'</b>'
        + (e.category ? ' <span class="tagchip" style="cursor:default">'+esc(catLabel(e.category))+'</span>' : '')
        + (e.out_of_window ? ' <span class="mtag">'+esc(KT('th_out'))+'</span>' : '')
        + (e.scope === 'platform' ? ' <span class="mtag">'+esc(KT('v_scope_plat'))+'</span>' : '')
        + (en ? '<div class="enote">'+esc(en)+'</div>' : '') + '</td>'
      + '<td class="muted" style="max-width:130px">'+esc((e.creator||'—').slice(0,14))+'</td>'
      + '<td><span class="pf" style="background:'+pcolor(e.platform)+';color:'+pfInk(pcolor(e.platform))+'">'+esc(topicName(e.platform))+'</span></td>'
      + '<td class="muted" style="max-width:200px;font-size:12.5px">'+esc((e.metric||'').slice(0,28))+'</td>'
      + '<td class="num">'+(e.metric_value != null ? fmtViews(e.metric_value) : '—')
        + (e.metric_type !== 'views' ? '<br><span class="mtag">'+esc(metricLabel(e.metric_type_label))+'</span>' : '') + '</td>'
      + '<td>'+fmtDur(e.duration_s)+'</td>'
      + '<td>'+(e.credibility ? '<span class="cred">'+esc(credName(e.credibility))+'</span>' : '<span class="muted">'+esc(KT('cred_none'))+'</span>')+'</td>'
      /* R29#5：出典列そのものを外したため td も出さない（R28 の「—」表示は撤去）。 */
      + '</tr>';
  }
  /* R1: 表末の注記から内部カバレッジ指標（可信度カバー率 n/N）を外した。
     指標の定義は「会社情報 → 調査手法と掲載基準」で公開している。 */
  /* R11: 0 件のときの空状態。従来はヘッダーだけが残り、壊れたように見えていた。
     colspan は上のヘッダー列数（9 列）に合わせる。 */
  if(!show.length){
    h += '<tr><td colspan="9" class="muted" style="text-align:center;padding:26px 14px">'
      + esc(KT('v_none')) + '</td></tr>';
  }
  h += '</tbody></table></div>';
  $('#videos-table').innerHTML = h;
  $('#videos-table').querySelectorAll('th.sortable').forEach(t => {
    const sort = () => {
      const key = t.dataset.sk;
      if(state.sort.key === key) state.sort.dir *= -1; else state.sort = {key, dir: -1};
      renderVideos();
    };
    t.onclick = sort;
    /* R30#9：Enter / Space でも並べ替えられるようにする。 */
    t.onkeydown = ev => {
      if(ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar'){ ev.preventDefault(); sort(); }
    };
  });
  $('#videos-table').querySelectorAll('.vrow').forEach(r => r.onclick = () => openNote(r.dataset.note));
}

/* ---------- 总览 ---------- */
function svgEl(t, attrs){ const e = document.createElementNS('http://www.w3.org/2000/svg', t);
  for(const k in attrs) e.setAttribute(k, attrs[k]); return e; }
function chartHist(container){
  /* R2: バケットのラベルは表示言語から取る（境界値そのものは共通） */
  const BK_LABELS = (window.KB_I18N[window.KB_LANG] || window.KB_I18N.ja).ch_buckets || window.KB_I18N.ja.ch_buckets;
  const BK_RANGES = [[0,7],[7,15],[15,30],[30,60],[60,180],[180,600],[600,1e12]];
  const buckets = BK_RANGES.map((r, i) => [BK_LABELS[i], r[0], r[1]]);
  const data = buckets.map(() => ({})); let total = 0; const platN = {};
  CLEAN.forEach(e => { if(e.duration_s != null){ total++; platN[e.platform] = (platN[e.platform]||0)+1;
    for(let i=0;i<buckets.length;i++) if(e.duration_s >= buckets[i][1] && e.duration_s < buckets[i][2]){
      data[i][e.platform] = (data[i][e.platform]||0) + 1; break; } } });
  const counts = data.map(pm => Object.values(pm).reduce((a,b)=>a+b,0));
  const peak = counts.indexOf(Math.max(...counts));
  const loop = counts[1], story = counts[3];
  const twoPeak = (loop >= 4 && story >= 4);
  const W=460, H=215, bw=50, gap=13, x0=30, y0=160, maxc=Math.max(...counts,1);
  /* R28：読み上げ用の名前（パネル見出しと同じキー） */
  const svg = svgEl('svg', {class:'chart', viewBox:'0 0 '+W+' '+H, role:'img', 'aria-label':KT('v_hist')});
  for(let i=0;i<buckets.length;i++){
    let y = y0;
    for(const p of Object.keys(data[i]).sort()){
      const bh = Math.round(data[i][p]/maxc*(y0-34));
      y -= bh;
      svg.appendChild(svgEl('rect', {x:x0+i*(bw+gap), y, width:bw, height:Math.max(bh,1), rx:2, fill:pcolor(p), opacity:.9}));
    }
    const t1 = svgEl('text', {x:x0+i*(bw+gap)+bw/2, y:y-5, 'text-anchor':'middle', class:'val'});
    t1.textContent = counts[i] || ''; svg.appendChild(t1);
    const t2 = svgEl('text', {x:x0+i*(bw+gap)+bw/2, y:y0+15, 'text-anchor':'middle'});
    t2.textContent = buckets[i][0]; svg.appendChild(t2);
  }
  svg.appendChild(svgEl('line', {x1:x0-8, y1:y0, x2:W-8, y2:y0, stroke:'var(--border)'}));
  const note = svgEl('text', {x:W-8, y:H-4, 'text-anchor':'end'});
  note.textContent = 'n='+total; svg.appendChild(note);
  const concl = document.createElement('p');
  concl.className = 'concl';
  concl.textContent = KT('ch_hist_concl', {n:total, peak:buckets[peak][0], pc:counts[peak],
    loop, story, verdict: KT(twoPeak ? 'ch_v_yes' : 'ch_v_no')});
  container.innerHTML = ''; container.appendChild(concl); container.appendChild(svg);
  const fn = document.createElement('p'); fn.className = 'footnote';
  /* R2: サンプル偏りの注記は「プラットフォーム別の件数」という事実だけを出す。
     従来は「TikTok/小红书に尺データが無い/少ない、短尺のピークは実質 IG 代表」という
     内部向けの読み解きが付いていたが、判定基準は会社情報の調査手法側に集約した。 */
  fn.textContent = KT('ch_skew', {list: Object.entries(platN).map(([p,n]) => (PNAME[p]||p)+' '+n).join(' / ')});
  container.appendChild(fn);
}
function chartCats(container){
  const byCat = {};
  CLEAN.forEach(e => { const c = e.category || KT('ch_other');
    byCat[c] = byCat[c] || {}; byCat[c][e.platform] = (byCat[c][e.platform]||0) + 1; });
  const cats = Object.entries(byCat).map(([c,pm]) => [c, Object.values(pm).reduce((a,b)=>a+b,0), pm])
    .sort((a,b)=>b[1]-a[1]).slice(0,8);
  if(!cats.length){ container.innerHTML = '<p class="muted">'+esc(KT('ch_no_cat'))+'</p>'; return; }
  const W=460, rowH=27, x0=110, H=cats.length*rowH+8;
  const max = Math.max(...cats.map(c=>c[1]),1);
  /* R28：読み上げ用の名前（パネル見出しと同じキー） */
  const svg = svgEl('svg', {class:'chart', viewBox:'0 0 '+W+' '+H, role:'img', 'aria-label':KT('v_cats')});
  cats.forEach(([c,total,pm], i) => {
    const y = i*rowH+6; let x = x0;
    const lab = svgEl('text', {x:x0-8, y:y+13, 'text-anchor':'end'});
    lab.textContent = catLabel(c); svg.appendChild(lab);
    for(const p of Object.keys(pm).sort()){
      const w = pm[p]/max*(W-x0-42);
      const seg = svgEl('rect', {x:x+1, y, width:Math.max(w-2,1), height:16, rx:2, fill:pcolor(p), opacity:.9});
      svg.appendChild(seg);
      if(pm[p]/total > .18 && w > 26){
        const pct = svgEl('text', {x:x+w/2, y:y+12, 'text-anchor':'middle',
          style:'fill:#fff;font-weight:600;font-size:11px;paint-order:stroke;stroke:rgba(0,0,0,.35);stroke-width:2px'});
        pct.textContent = Math.round(pm[p]/total*100) + '%';
        svg.appendChild(pct);
      }
      x += w;
    }
    const v = svgEl('text', {x:W-6, y:y+13, 'text-anchor':'end', class:'val'});
    v.textContent = total; svg.appendChild(v);
  });
  container.innerHTML = '';
  const top = cats[0];
  const domPlat = Object.entries(top[2]).sort((a,b)=>b[1]-a[1])[0];
  const concl = document.createElement('p'); concl.className = 'concl';
  concl.textContent = KT('ch_cats_concl', {n:cats.reduce((a,c)=>a+c[1],0), top:catLabel(top[0]), cnt:top[1], plat:topicName(domPlat[0])});
  container.appendChild(concl); container.appendChild(svg);
  const fn = document.createElement('p'); fn.className = 'footnote';
  fn.textContent = KT('ch_cats_fn');
  container.appendChild(fn);
}
function chartTop15(container){
  const vs = CLEAN.filter(e => e.views_num).sort((a,b)=>b.views_num-a.views_num).slice(0,15);
  if(!vs.length){ container.innerHTML = '<p class="muted">'+esc(KT('ch_no_views'))+'</p>'; return; }
  const W=940, rowH=27, x0=255, H=vs.length*rowH+10;
  const lg = v => Math.log10(v);
  const lo = lg(Math.max(vs[vs.length-1].views_num, 1e5)), hi = lg(vs[0].views_num);
  /* R28：読み上げ用の名前（パネル見出しと同じキー） */
  const svg = svgEl('svg', {class:'chart', viewBox:'0 0 '+W+' '+H, role:'img', 'aria-label':KT('v_top')});
  [[1e8,fmtViews(1e8)],[1e7,fmtViews(1e7)],[1e6,fmtViews(1e6)]].forEach(([v,lab]) => {
    if(v < Math.pow(10,lo) || v > Math.pow(10,hi)) return;
    const x = x0 + Math.max((lg(v)-lo)/Math.max(hi-lo,.001)*(W-x0-90), 0);
    svg.appendChild(svgEl('line', {x1:x, y1:4, x2:x, y2:H-8, stroke:'var(--border)', 'stroke-dasharray':'3 3'}));
    const t = svgEl('text', {x:x+3, y:12}); t.textContent = lab; svg.appendChild(t);
  });
  vs.forEach((e,i) => {
    const y = i*rowH+5;
    const lab = svgEl('text', {x:x0-8, y:y+12, 'text-anchor':'end'});
    lab.textContent = (PNAME[e.platform]+'·'+e.title).slice(0,26);
    lab.appendChild(document.createElement('title')).textContent = PNAME[e.platform]+'·'+e.title;
    svg.appendChild(lab);
    const w = Math.max((lg(e.views_num)-lo)/Math.max(hi-lo,.001)*(W-x0-90), 4);
    svg.appendChild(svgEl('rect', {x:x0, y, width:w, height:17, rx:4, fill:pcolor(e.platform), opacity:.9}));
    const v = svgEl('text', {x:x0+w+6, y:y+12, class:'val'});
    v.textContent = fmtViews(e.views_num) + (e.credibility ? ' / '+credName(e.credibility) : '');
    svg.appendChild(v);
  });
  container.innerHTML = '';
  const pc = {}; vs.forEach(e => pc[e.platform] = (pc[e.platform]||0)+1);
  const dp = Object.entries(pc).sort((a,b)=>b[1]-a[1])[0];
  const concl = document.createElement('p'); concl.className = 'concl';
  concl.textContent = KT('ch_top_concl', {title:vs[0].title.slice(0,18), views:fmtViews(vs[0].views_num), plat:(PNAME[dp[0]]||dp[0]), cnt:dp[1], n:CLEAN.filter(e=>e.views_num).length});
  container.appendChild(concl); container.appendChild(svg);
  const fn = document.createElement('p'); fn.className = 'footnote';
  fn.textContent = KT('ch_top_fn');
  container.appendChild(fn);
}
function chartMonths(container){
  const pool = CLEAN.filter(e => e.month);
  const months = [...new Set(pool.map(e => e.month))].sort();
  if(months.length < 2){ container.innerHTML = '<p class="muted">'+esc(KT('ch_no_month'))+'</p>'; return; }
  const data = months.map(() => ({}));
  pool.forEach(e => { const i = months.indexOf(e.month);
    data[i][e.platform] = (data[i][e.platform]||0) + 1; });
  const counts = data.map(pm => Object.values(pm).reduce((a,b)=>a+b,0));
  const W=460, rowH=27, x0=86, H=months.length*rowH+8;
  const max = Math.max(...counts,1);
  /* R28：読み上げ用の名前（パネル見出しと同じキー） */
  const svg = svgEl('svg', {class:'chart', viewBox:'0 0 '+W+' '+H, role:'img', 'aria-label':KT('v_mon')});
  months.forEach((mo,i) => {
    const y = i*rowH+6; let x = x0;
    const lab = svgEl('text', {x:x0-8, y:y+13, 'text-anchor':'end'});
    lab.textContent = mo; svg.appendChild(lab);
    for(const p of Object.keys(data[i]).sort()){
      const w = data[i][p]/max*(W-x0-42);
      svg.appendChild(svgEl('rect', {x:x+1, y, width:Math.max(w-2,1), height:16, rx:2, fill:pcolor(p), opacity:.9}));
      x += w;
    }
    const v = svgEl('text', {x:W-6, y:y+13, 'text-anchor':'end', class:'val'});
    v.textContent = counts[i]; svg.appendChild(v);
  });
  container.innerHTML = '';
  const peak = counts.indexOf(Math.max(...counts));
  const concl = document.createElement('p'); concl.className = 'concl';
  concl.textContent = KT('ch_mon_concl', {month:months[peak], cnt:counts[peak]});
  container.appendChild(concl); container.appendChild(svg);
  const fn = document.createElement('p'); fn.className = 'footnote';
  fn.textContent = KT('ch_mon_fn', {n:pool.length});
  container.appendChild(fn);
}
/* ---------- 结论墙（可视化知识库主视图） ---------- */
const KNOWN_ORDER = ['analysis','youtube','tiktok','instagram','xiaohongshu'];
/* R2: analysis テーマだけは「プラットフォーム横断の共通結論」という
   固定の言い換えを当てる（テーマ名そのままだと意味が伝わらないため）。 */
const GROUP_TITLE_FIX = {analysis:'ch_universal'};
const groupOrder = () => KNOWN_ORDER.concat(
  Object.keys(DATA.stats.topics).filter(t => !KNOWN_ORDER.includes(t)).sort());
const groupTitle = t => GROUP_TITLE_FIX[t]
  ? KT(GROUP_TITLE_FIX[t])
  : topicName(t);
function renderConclWall(opts){
  const {digest=false, totalLimit=12, groupLimit=2} = opts || {};
  const q = state.q.toLowerCase();
  const groups = {};
  (DATA.conclusions || []).forEach(c => {
    /* R12-b5：遮断したナレッジの結論は母集団から外す。ここで外さないと
       グループの件数バッジだけが多く出て、カードの数と合わなくなる。 */
    if(!noteById(c.note_id)) return;
    if(q && !hayHit(conclHay(c), qTokens(q))) return;         /* R20-B1 / R21-2 */
    (groups[c.topic] = groups[c.topic] || []).push(c);
  });
  let h = '';
  let used = 0;
  for(const t of groupOrder()){
    const cs = groups[t];
    if(!cs || !cs.length) continue;
    const shown = digest ? cs.slice(0, Math.max(0, groupLimit)) : cs;
    if(digest && used >= totalLimit) break;
    used += shown.length;
    h += '<div class="panel"><h2 class="panel-title">'+IC.trophy+' '+groupTitle(t)
      + '<span class="chip" style="margin-left:8px">'+KT('unit_pcs',{n:cs.length})
      + (digest && cs.length > shown.length ? ' / '+shown.length : '')+'</span></h2><div class="cgrid">';
    for(const c of shown){
      /* R12：遮断したナレッジに属する結論は、出典が辿れないので出さない
         （従来は noteById が undefined でも空の出典でカードを描いていた）。 */
      const n = noteById(c.note_id);
      if(!n) continue;
      const srcs = (n.sources || []).slice(0, 5);
      h += '<div class="ccard" data-note="'+esc(c.note_id)+'" style="--pc:'+pcolor(t)+'">'
        + '<div class="csec">'+esc(c.section)+(c.kind==='claim'?' <span class="chip" style="margin-left:6px">'+esc(KT('c_claim'))+'</span>':'')+'</div>'
        + '<div class="ctxt">'+esc(c.text)+'</div>'
        + '<div class="csrc">'
        + (srcs.length
            ? srcs.map(s => '<a class="srclink" href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">🔗 '+esc(s.label)+'</a>').join('')
            : '<span class="kbd">'+esc(KT('c_nosrc'))+'</span>')
        + '</div>'
        + '<div class="cfrom">📄 '+esc(n.title || c.note_id)+'</div></div>';
    }
    h += '</div></div>';
  }
  return h || '<div class="panel"><p class="muted">'+esc(KT('c_nomatch'))+'</p></div>';
}
/* R1: 事業ライン名を多言語化。あわせて説明文から社内コード名（白菜咕咕 / ark-harness /
   Wonder / 知识波 など、対外的に意味が通らない内部呼称）を外し、扱う領域の説明に置き換えた。 */
const LINE_I18N = {
  ja:{content:['コンテンツ制作','ショート動画の企画・制作・運用'],
      'enterprise-ai':['企業向け AI 導入','RAG・ファインチューニング・ローカル LLM'],
      intel:['市場・マクロ情報','日本 / シンガポールの IT 市場、世界経済、AI 動向'],
      platform:['プラットフォーム基盤','開発効率・ツールチェーン・自動化']},
  en:{content:['Content production','Planning, production and operation of short-form video'],
      'enterprise-ai':['Enterprise AI','RAG, fine-tuning and local LLM deployment'],
      intel:['Market & macro intelligence','IT markets in Japan and Singapore, world economy, AI trends'],
      platform:['Platform engineering','Developer efficiency, tooling and automation']},
  zh:{content:['内容产线','短视频的选题、制作与运营'],
      'enterprise-ai':['企业 AI 交付','RAG、微调与本地 LLM 部署'],
      intel:['市场与宏观情报','日本 / 新加坡 IT 市场、世界经济、AI 动态'],
      platform:['平台工程','工程效率、工具链与自动化']},
  /* R11-b6: ko / es / fr / de が無く、この 4 言語では事業ライン名と説明が
     日本語のまま表示されていた（KT 経由ではなく lineDict() の
     LINE_I18N.ja フォールバックだったため、未訳キー検査にも掛からなかった）。 */
  ko:{content:['콘텐츠 제작','숏폼 영상의 기획・제작・운영'],
      'enterprise-ai':['기업용 AI 도입','RAG・파인튜닝・로컬 LLM 구축'],
      intel:['시장・거시 정보','일본 / 싱가포르 IT 시장, 세계 경제, AI 동향'],
      platform:['플랫폼 엔지니어링','개발 효율・툴체인・자동화']},
  es:{content:['Producción de contenido','Planificación, producción y operación de vídeo de formato corto'],
      'enterprise-ai':['IA para empresas','RAG, ajuste fino y despliegue de LLM en local'],
      intel:['Inteligencia de mercado y macro','Mercados TI de Japón y Singapur, economía mundial, tendencias de IA'],
      platform:['Ingeniería de plataforma','Eficiencia de desarrollo, herramientas y automatización']},
  fr:{content:['Production de contenu','Conception, production et exploitation de vidéos courtes'],
      'enterprise-ai':['IA en entreprise','RAG, fine-tuning et déploiement de LLM en local'],
      intel:['Veille marché et macro','Marchés IT du Japon et de Singapour, économie mondiale, tendances IA'],
      platform:['Ingénierie de plateforme','Efficacité de développement, outillage et automatisation']},
  de:{content:['Content-Produktion','Konzeption, Produktion und Betrieb von Kurzvideos'],
      'enterprise-ai':['KI im Unternehmen','RAG, Fine-Tuning und lokale LLM-Bereitstellung'],
      intel:['Markt- und Makro-Intelligence','IT-Märkte in Japan und Singapur, Weltwirtschaft, KI-Trends'],
      platform:['Plattform-Engineering','Entwicklungseffizienz, Tooling und Automatisierung']}
};
const lineDict = () => LINE_I18N[window.KB_LANG] || LINE_I18N.ja;
const lineName = k => (lineDict()[k] || [k])[0];
const lineDesc = k => (lineDict()[k] || ['',''])[1] || '';
/* 既存コードが LINE_NAMES[k] を参照しているため、Proxy で言語追随の読み取りを提供する
   （呼び出し側の書き換えを最小にするための互換シム）。 */
const LINE_NAMES = new Proxy({}, {get:(_, k) => typeof k === 'string' ? lineName(k) : undefined,
  has:(_, k) => k in lineDict(), ownKeys:() => Object.keys(lineDict()),
  getOwnPropertyDescriptor:() => ({enumerable:true, configurable:true})});

/* ---------- 板块模板：Panel Shell + 首屏组件（供后续 OVERVIEW_CONFIG 注册复用） ---------- */
function renderPanelShell(o){
  return '<div class="panel '+(o.cls||'')+'"'+(o.id?' id="'+o.id+'"':'')+'>'
    + (o.title ? '<h2 class="panel-title">'+o.title+(o.badge?' <span class="chip">'+o.badge+'</span>':'')+'</h2>' : '')
    + (o.body||'')+'</div>';
}
/* ============================================================================
   R1（内部商業情報の保護）で削除した 3 パネル
     ・renderStatusStrip … 「今日の変化」。git のコミットハッシュ（DATA.today.head）を
        公開サイトに出力していた。
     ・renderReviewPanel … 「要レビュー」。ソース乖離 / 期限超過 / 孤立 / 未検証 / 廃止の
        内部品質メトリクスを、そのまま客先に見せていた。
     ・renderActionsPanel … 「推奨アクション」。入札書類の取得指示、提案に含めるかの判断、
        「文書を見る前に契約金額を見積もるな」等、社内の営業指示そのものを公開していた。
   いずれも呼び出し側（renderOverview）から外し、関数本体も削除済み。
   注意：元データ（DATA.today / DATA.review / DATA.actions）は CDN の kb-data.json に
   依然含まれている。ページ側で描画しなくても JSON を直接取得すれば読めるため、
   恒久対策は内部 workspace の scripts/publish-data.sh 側で出力しないこと。
   ============================================================================ */
function renderWeekConcl(){
  const cut = new Date(Date.now() - 7*86400000).toISOString().slice(0,10);
  const recentIds = new Set(pubNotes().filter(n => (n.created||'') >= cut).map(n => n.id));
  const seen = new Set();
  let claims = [];
  for(const c of (DATA.conclusions||[])){
    if(claims.length >= 5) break;
    if(c.kind === 'claim' && recentIds.has(c.note_id) && !seen.has(c.text)){
      seen.add(c.text); claims.push(c);
    }
  }
  for(const c of (DATA.conclusions||[])){
    if(claims.length >= 5) break;
    if(c.kind === 'claim' && !seen.has(c.text)){ seen.add(c.text); claims.push(c); }
  }
  return renderPanelShell({title: esc(KT('p_weekconcl')), badge: esc(KT('p_weekconcl_badge')),
    body: (claims.length
      ? '<ol style="margin:0;padding-left:20px;font-size:13px">'+claims.map(c =>
          '<li style="margin:4px 0">'+esc(c.text)+' <a data-note="'+esc(c.note_id)+'" href="#" rel="noopener noreferrer" style="font-size:12px" title="'+esc(KT('sig_open'))+'">↗</a></li>').join('')+'</ol>'
      : '<p class="muted">'+esc(KT('p_weekconcl_none'))+'</p>')
    + '<p class="footnote" style="margin:8px 0 0"><a href="#" id="goto-wall" rel="noopener noreferrer">'+esc(KT('goto_wall'))+'</a></p>'});
}
function renderNavTileGrid(s){
  /* R1: 件数 0 の事業ラインは出さない（空の入口は対外的にマイナスなので隠す）。
     従来は「平台工程 0 篇」がトップページに常時表示されていた。 */
  const keys = Object.keys(lineDict()).filter(k => ((s.lines||{})[k]||0) > 0);
  if(!keys.length) return '';
  return '<div class="lane-grid">' + keys.map(k =>
    '<button class="panel lane-tile" data-line="'+k+'">'
    + '<span class="lane-name">'+esc(lineName(k))+'</span>'
    + '<span class="chip">'+esc(KT('unit_notes',{n:(s.lines||{})[k]||0}))+'</span>'
    + '<span class="footnote">'+esc(lineDesc(k))+'</span></button>').join('') + '</div>';
}

/* ---------- 板块页（KB-DISPLAY-SPEC P0-1） ---------- */
function renderBoards(){
  const el = $('#view-boards');
  if(state.boardTopic && (DATA.boards||{})[state.boardTopic]){
    const b = DATA.boards[state.boardTopic];
    /* R12-b4：ここは isPublishable を通しておらず、一覧からは消えたナレッジが
       テーマ詳細では出ていた（遮断が経路ごとに漏れる典型）。 */
    const notes = pubNotes().filter(n => n.topic === state.boardTopic)
      .sort((a,x) => (x.type||'').localeCompare(a.type||'') || a.days - x.days);
    const byType = {};
    notes.forEach(n => { const k = noteType(n.type) || '—'; (byType[k] = byType[k] || []).push(n); });
    el.innerHTML =
      /* R16: 読み上げ専用の画面見出し（視覚デザインは変えない）
         R20-B8: 詳細ではテーマ名が h1 になるので、画面見出しは h2 に落とす。 */
      '<h2 class="sr-only">'+esc(KT('tab_boards'))+'</h2>'
      + '<p style="margin:4px 0"><button class="btn" id="board-back">'+esc(KT('b_back'))+'</button>'
      + (state.boardLine ? ' <span class="chip">'+esc(lineName(state.boardLine))+'</span>' : '') + '</p>'
      + '<div class="badges" style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0">'
      + '<span class="tagchip" style="background:var(--panel2)">'+esc(KT('b_tag_topic'))+'</span>'
      + (b.line ? '<span class="tagchip" style="background:var(--panel2)">'+esc(lineName(b.line))+'</span>' : '')
      + '<span class="tagchip" style="background:var(--panel2)">'+esc(KT(b.ev7 ? 'b_daily' : 'b_on_src'))+'</span></div>'
      + '<h1 style="font-size:var(--fs-h2);margin:6px 0 2px;letter-spacing:-.01em">'+esc(topicName(b.topic) || b.name)+'</h1>'
      /* R1: 統計から「待复核（要レビュー件数）」を削除。総覧から外した内部品質メトリクスが
         テーマ詳細に残っていたもの。 */
      /* R30#1-b：4 つのうち「直近 7 日の新規」(b.new7) は未サニタイズ、
         「動き（7 日）」(b.heat7) は遮断ナレッジ由来の合成指標なので落とす。
         件数はこの画面で実際に並ぶ公開ナレッジの数（notes.length）に合わせる。 */
      + '<div class="stats">'
      + '<div class="stat"><div class="v">'+notes.length+'</div><div class="k">'+esc(KT('b_st_notes'))+'</div></div>'
      + '<div class="stat"><div class="v">'+b.ev7+'</div><div class="k">'+esc(KT('b_st_ev7'))+'</div></div></div>'
      + '<div class="grid3" style="align-items:start">'
      + '<div class="panel"><h2 class="panel-title">'+esc(KT('b_top5concl'))+' <span class="chip">'+esc(KT('b_from_concl'))+'</span></h2>'
      + (b.concl.length ? '<ol style="margin:0;padding-left:20px;font-size:13px">'
        + b.concl.map(c => '<li style="margin:4px 0">'+esc(c.text)+'</li>').join('') + '</ol>'
        : '<p class="muted">'+esc(KT('b_no_concl'))+'</p>') + '</div>'
      + '<div class="panel" style="grid-column:span 2"><h2 class="panel-title">'+esc(KT('b_top5kw'))+' <span class="chip">'+esc(KT('b_kw_note'))+'</span></h2>'
      + '<div class="grid3">'
      + (b.kw.length ? b.kw.map(([w,n]) => '<div class="krow"><span class="l">'+esc(w)+'</span><span class="r">'+n+'</span></div>').join('')
        : '<p class="muted">'+esc(KT('b_no_kw'))+'</p>')
      + '</div>'
      /* R1（内部商業情報の保護）：出来事カードから e.action（「建议行动：」）を削除。
         総覧の「推奨アクション」パネルと同じ内容＝入札書類の取得指示や提案判断といった
         社内の営業指示で、テーマ詳細ページ側に取り残されていた。 */
      + (b.recent_events.length ? '<h3 style="margin-top:12px">'+esc(KT('b_events'))+'</h3>'
        + b.recent_events.map(e => '<div class="evcard '+(e.change_type||'')+'"><div class="m">'+esc(e.date||'')+'</div>'
          + esc(e.title||'') + '</div>').join('') : '')
      + '</div></div>'
      + '<div class="panel" style="margin-top:14px"><h2 class="panel-title">'+esc(KT('b_allnotes'))+' <span class="chip">'+esc(KT('b_bytype'))+'</span></h2>'
      + Object.entries(byType).map(([ty, ns]) =>
          '<div class="small" style="margin:10px 0 2px">'+esc(ty)+'（'+ns.length+'）</div>'
          + ns.map(n => '<div class="krow" style="cursor:pointer" data-note="'+esc(n.id)+'">'
            + '<span class="l">'+esc(n.title)+'</span>'
            + '<span class="r">'+esc(n.updated)+'</span></div>').join('')).join('')
      + '</div>'
      + (b.line === 'content' ? '<div id="board-wall" style="margin-top:14px">' + renderConclDigest() + '</div>' : '');
    $('#board-back').onclick = () => { state.boardTopic=''; renderBoards();
      syncHash(true);                        /* R21-1 */
      window.scrollTo({top:0}); };
    el.querySelectorAll('[data-note]').forEach(x => x.onclick = () => openNote(x.dataset.note));
    const ct2 = $('#board-wall #concl-toggle');
    if(ct2) ct2.onclick = () => { state.conclFull = !state.conclFull; renderBoards(); window.scrollTo({top:0}); };
  } else {
    /* R26①：公開ナレッジが 0 件のテーマはカードを出さない。
       scope='internal' を遮断対象に加えた結果、20 テーマのうち 10 テーマが
       公開ナレッジ 0 件になった（件数自体は kbSanitize が再計算するので
       「0 件」と正しく出るが、開いても中身が無いカードが並ぶだけになる）。
       遮断の判定を変えれば自動で追随するよう、boards の件数ではなく
       公開ナレッジ側から数え直す（kbSanitize の再計算に依存しない）。 */
    const pubByTopic = {};
    DATA.notes.filter(isPublishable).forEach(n => { pubByTopic[n.topic] = (pubByTopic[n.topic]||0) + 1; });
    const all = Object.values(DATA.boards||{})
      .filter(b => (pubByTopic[b.topic] || 0) > 0)
      /* R30#1-a：heat7 順ではなく公開ナレッジ件数順に並べる */
      .sort((a,b) => (pubByTopic[b.topic]||0) - (pubByTopic[a.topic]||0));
    const shown = state.boardLine ? all.filter(b => b.line === state.boardLine) : all;
    const maxC = Math.max(...all.map(b => pubByTopic[b.topic]||0), 1);
    el.innerHTML =
      '<h1 class="sr-only">'+esc(KT('tab_boards'))+'</h1>'
      + (state.boardLine ? '<p style="margin:4px 0 12px"><button class="btn" id="board-back">'+esc(KT('b_back'))+'</button> <span class="chip">'+esc(lineName(state.boardLine))+'</span></p>' : '')
      + '<div class="bhead"><span class="bhead-title">'+esc(state.boardLine ? KT('b_of_line',{name:lineName(state.boardLine)}) : KT('b_all'))+'</span>'
      + '<span class="chip">'+esc(KT('b_count',{n:shown.length}))+'</span></div>'
      + '<div class="bgrid">'
      + shown.map(b => {
          const pc = pubByTopic[b.topic] || 0;
          return '<div class="bcard" data-board="'+esc(b.topic)+'">'
            + '<div class="bcard-name">'+esc(topicName(b.topic) || b.name)+'</div>'
            + '<div>'+(b.line ? '<span class="chip">'+esc(lineName(b.line))+'</span>' : '')
            + (b.ev7 ? ' <span class="chip">'+esc(KT('b_daily'))+'</span>' : '')+'</div>'
            /* R30#1-a：バーの長さと数値を公開ナレッジ件数に。heat7 と ↑↓ は撤去。 */
            + '<div class="bcard-heat"><span class="bartrack"><span class="barfill" style="display:block;width:'+(pc/maxC*100)+'%"></span></span>'
            + '<span class="bcard-hv">'+esc(KT('unit_notes',{n:pc}))+'</span></div>'
            /* R1: カードのメタから「待复核 N」（要レビュー件数）を削除。
               R30#1-a：b.new7 は未サニタイズで「1 件 ・ +3」と矛盾していたので外し、
               裏づけの取れる「出来事 N」だけ残す（b_meta_ev は b_meta の続きとして
               書かれているので、先頭の区切り記号を落としてから使う）。 */
            + (b.ev7 ? '<div class="bcard-meta">'
                + esc(KT('b_meta_ev',{n:b.ev7}).replace(/^[ 　・·]+/, ''))+'</div>' : '')
            + (b.kw && b.kw.length ? '<div class="bcard-kw">'+b.kw.slice(0,4).map(([w]) => '<span>'+esc(w)+'</span>').join('')+'</div>' : '')
            + '</div>';
        }).join('')
      + '</div>';
    const back = $('#board-back');
    if(back) back.onclick = () => { state.boardLine=''; renderBoards(); };
    el.querySelectorAll('[data-board]').forEach(x => x.onclick = () => {
      state.boardTopic = x.dataset.board; renderBoards();
      syncHash(true);                        /* R21-1 */
      window.scrollTo({top:0}); });
  }
}

/* ---------- chart 块渲染（KB-DISPLAY-SPEC §2.1） ---------- */
const CHART_COLORS = ['#2563eb','#eb6834','#1baf7a','#eda100'];
function renderChartSVG(c){
  const series = c.series||[];
  const form = (c.form||'bar-h');
  const log = (c.scale||'').toLowerCase()==='log';
  if(form === 'dot'){ /* 散点：rows = [标签, x, y] */
    const pts = (c.rows||[]).map(r => ({label:String(r[0]), x:Number(r[1]), y:Number(r[2])})).filter(p=>!isNaN(p.x)&&!isNaN(p.y));
    if(!pts.length) return '';
    const W=640,H=380,p={l:56,r:16,t:14,b:44};
    const xs=pts.map(p=>p.x), ys=pts.map(p=>p.y);
    const xlo=Math.min(...xs), xhi=Math.max(...xs), ylo=Math.min(...ys), yhi=Math.max(...ys);
    const pad=(xhi-xlo)*.08||1, ypad=(yhi-ylo)*.1||1;
    const X=v=>p.l+(W-p.l-p.r)*((v-(xlo-pad))/((xhi+pad)-(xlo-pad)||1));
    const Y=v=>H-p.b-(H-p.t-p.b)*((v-(ylo-ypad))/((yhi+ypad)-(ylo-ypad)||1));
    let s='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(c.title||KT('ch_scatter'))+'" style="width:100%;height:auto">';
    for(let g=0;g<=4;g++){ const yy=ylo-ypad+(yhi+ypad-(ylo-ypad))*g/4, xx=xlo-pad+(xhi+pad-(xlo-pad))*g/4;
      s+='<line x1="'+p.l+'" x2="'+(W-p.r)+'" y1="'+Y(yy)+'" y2="'+Y(yy)+'" stroke="var(--border)"/>'
        +'<text class="svgtext" x="'+(p.l-6)+'" y="'+(Y(yy)+4)+'" text-anchor="end">'+yy.toFixed(1)+'</text>'
        +'<text class="svgtext" x="'+X(xx)+'" y="'+(H-24)+'" text-anchor="middle">'+xx.toFixed(1)+'</text>'; }
    s+='<text class="svgtext" x="'+(W/2)+'" y="'+(H-6)+'" text-anchor="middle">x：'+esc(String((c.axes&&c.axes[0])||c.unit||''))+'</text>'
      +'<text class="svgtext" transform="rotate(-90 '+(14)+' '+(H/2)+')" x="14" y="'+(H/2)+'" text-anchor="middle">y：'+esc(String((c.axes&&c.axes[1])||c.unit2||''))+'</text>';
    pts.forEach(p2=>{ s+='<circle cx="'+X(p2.x)+'" cy="'+Y(p2.y)+'" r="6" fill="'+CHART_COLORS[0]+'" opacity=".85" data-tip="'+esc(p2.label+' ('+p2.x+', '+p2.y+')')+'"/>'
      +'<text class="svglab" x="'+X(p2.x)+'" y="'+(Y(p2.y)-10)+'" text-anchor="middle" font-size="11">'+esc(p2.label)+'</text>'; });
    return s+'</svg>';
  }
  if(form === 'line'){ /* 折线：rows = [标签, v1..vn]，每系列一条 */
    const items=(c.rows||[]).map(r=>({label:String(r[0]), vals:r.slice(1).map(Number)}));
    const W=640,H=300,p={l:48,r:14,t:12,b:36};
    const vals=items.flatMap(i=>i.vals).filter(v=>!isNaN(v));
    const lo=Math.min(...vals), hi=Math.max(...vals)||1, pad=(hi-lo)*.1||1;
    const X=i=>p.l+(W-p.l-p.r)*(i/Math.max(items.length-1,1));
    const Y=v=>H-p.b-(H-p.t-p.b)*((v-(lo-pad))/((hi+pad)-(lo-pad)||1));
    let s='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(c.title||KT('ch_line'))+'" style="width:100%;height:auto">';
    for(let g=0;g<=4;g++){ const v=lo-pad+(hi+pad-(lo-pad))*g/4;
      s+='<line x1="'+p.l+'" x2="'+(W-p.r)+'" y1="'+Y(v)+'" y2="'+Y(v)+'" stroke="var(--border)"/>'
        +'<text class="svgtext" x="'+(p.l-6)+'" y="'+(Y(v)+4)+'" text-anchor="end">'+v.toFixed(v>=100?0:1)+'</text>'; }
    const nser=Math.max(...items.map(i=>i.vals.length),1);
    for(let j=0;j<nser;j++){
      const pts=items.map((it,i)=>X(i)+','+Y(it.vals[j])).join(' ');
      s+='<polyline points="'+pts+'" fill="none" stroke="'+CHART_COLORS[j%4]+'" stroke-width="2"/>';
      items.forEach((it,i)=>{ if(!isNaN(it.vals[j])) s+='<circle cx="'+X(i)+'" cy="'+Y(it.vals[j])+'" r="3" fill="'+CHART_COLORS[j%4]+'" data-tip="'+esc(it.label+' · '+(series[j]||KT('ch_series',{n:j+1}))+' '+it.vals[j])+'"/>'; });
    }
    items.forEach((it,i)=>{ if(items.length<=14||i%Math.ceil(items.length/12)===0) s+='<text class="svgtext" x="'+X(i)+'" y="'+(H-8)+'" text-anchor="middle">'+esc(it.label.slice(0,8))+'</text>'; });
    return s+'</svg>';
  }
  const items = (c.rows||[]).map(r => ({ label: String(r[0]), vals: r.slice(1).map(Number) }));
  if((c.sort||'desc')==='desc' && form==='bar-h'){
    items.sort((a,b) => (b.vals[b.vals.length-1]||0) - (a.vals[a.vals.length-1]||0));
  }
  const rows = items;
  const nums = rows.map(r => r.vals);
  const labels = rows.map(r => r.label);
  const T = v => log ? Math.log10(Math.max(v,0.01)) : v;
  let vals = nums.flat().filter(v=>!isNaN(v));
  const lo = Math.min(...vals, 0), hi = Math.max(...vals, 1);
  const tlo = T(lo), thi = T(hi)||1;
  const W = 640, p = {l: 130, r: 56, t: 8, b: 26};
  const rowH = series.length ? 34 : 26;
  const H = p.t + p.b + rows.length*rowH;
  const x = v => p.l + (W-p.l-p.r) * ((T(v)-tlo)/((thi-tlo)||1));
  let s = '<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(c.title||KT('ch_generic'))+'" style="width:100%;height:auto">';
  const ticks = 5;
  for(let g=0; g<=ticks; g++){
    const v = tlo + (thi-tlo)*g/ticks;
    const real = log ? Math.pow(10, v) : v;
    s += '<line x1="'+x(real)+'" x2="'+x(real)+'" y1="'+p.t+'" y2="'+(H-p.b)+'" stroke="var(--border)"/>'
      + '<text class="svgtext" x="'+x(real)+'" y="'+(H-8)+'" text-anchor="middle">'+(real>=10?real.toFixed(0):real.toFixed(1))+'</text>';
  }
  rows.forEach((r,i) => {
    const y0 = p.t + i*rowH + 3;
    if(series.length){
      s += '<text class="svglab" x="'+(p.l-8)+'" y="'+(y0+rowH/2+2)+'" text-anchor="end">'+esc(labels[i])+'</text>';
      series.forEach((_,j)=>{
        const y = y0 + j*13, h = 11, v = nums[i][j];
        if(isNaN(v)) return;
        const w = x(v)-x(log?0.01:0);
        s += '<path d="M'+x(log?0.01:0)+','+y+' h'+Math.max(w-3,0)+' a3,3 0 0 1 3,3 v'+(h-6)+' a3,3 0 0 1 -3,3 h-'+Math.max(w-3,0)+' z" fill="'+CHART_COLORS[j%4]+'" data-tip="'+esc(labels[i]+' · '+series[j]+' '+v+' '+(c.unit||''))+'"/>'
          + '<text class="svgval" x="'+(x(v)+5)+'" y="'+(y+9)+'">'+(v>=10?v.toFixed(0):v.toFixed(v%1?2:1))+'</text>';
      });
    } else {
      const y = y0, h = rowH-10, v = nums[i][0];
      if(isNaN(v)) return;
      const w = x(v)-x(log?0.01:0);
      s += '<text class="svglab" x="'+(p.l-8)+'" y="'+(y+h/2+4)+'" text-anchor="end">'+esc(labels[i])+'</text>'
        + '<path d="M'+x(log?0.01:0)+','+y+' h'+Math.max(w-3,0)+' a3,3 0 0 1 3,3 v'+(h-6)+' a3,3 0 0 1 -3,3 h-'+Math.max(w-3,0)+' z" fill="'+CHART_COLORS[0]+'" data-tip="'+esc(labels[i]+' · '+v+' '+(c.unit||''))+'"/>'
        + '<text class="svgval" x="'+(x(v)+5)+'" y="'+(y+h/2+4)+'">'+v+'</text>';
    }
  });
  s += '</svg>';
  return s;
}
function renderChartsBlock(n){
  const charts = n.charts||[];
  if(!charts.length) return '';
  return charts.map(c =>
    '<div class="panel" style="margin:10px 0"><h2 class="panel-title">'+esc(c.title||KT('ch_title_fallback'))+''
    + '<span class="chip">'+esc(c.unit||'')+(c.scale==='log'?' · log':'')+'</span>'
    + (c.asof?' <span class="footnote">as-of '+esc(c.asof)+(c.fx?' · '+esc(c.fx):'')+'</span>':'')+'</h2>'
    + (c.series && c.series.length>1 ? '<div class="legend">'+c.series.map((s2,j)=>'<span><i style="background:'+CHART_COLORS[j%4]+'"></i>'+esc(s2)+'</span>').join('')+'</div>' : '')
    + renderChartSVG(c)
    + (c.source?'<p class="footnote" style="margin:4px 0 0">'+esc(KT('ch_source'))+esc(c.source)+'</p>':'')
    + '</div>').join('');
}

function renderConclDigest(){
  /* R12-b5：件数が遮断前の数（865）のままで、「865 件すべての結論を見る」を押すと
     859 件しか出ないという食い違いが起きていた。描画側と同じ条件で数える。 */
  const total = (DATA.conclusions||[]).filter(c => noteById(c.note_id)).length;
  const wall = state.conclFull
    ? renderConclWall()
    : renderConclWall({digest:true, totalLimit:12, groupLimit:2});
  return renderPanelShell({title:'💡 '+KT('cd_title'), badge: KT('cd_badge',{n:total}),
    body: wall + '<p style="margin:8px 0 0"><button class="btn" id="concl-toggle">'
      + esc(state.conclFull ? KT('cd_collapse') : KT('cd_expand',{n:total}))+'</button></p>'});
}

/* T-13 情报观察首屏信号卡：digest（今日变化）+ watchlist 命中在前端推导，
   不新增构建依赖。仅 DATA.public 渲染；推不出信号时整个卡区不渲染。 */
function signalKws(n){
  return Object.keys(DATA.watchlist || {}).filter(k => (DATA.watchlist[k] || []).includes(n.id));
}
function deriveSignals(){
  const addedIds = new Set(((DATA.today || {}).added || []).map(x => x.id));
  const candIds = new Set(addedIds);
  Object.values(DATA.watchlist || {}).forEach(ids => (ids || []).forEach(id => candIds.add(id)));
  /* 候选集 = digest 新增 ∪ watchlist 命中；payload 里有 id 但库里查无详情的跳过 */
  /* noteById 側でブロック対象を除外済み（R1）。filter(Boolean) がその受け皿になる。 */
  const cands = [...candIds].map(noteById).filter(Boolean);
  /* 候选优先级：digest 新增 > watchlist 命中多 > 更新时间新 */
  return cands.sort((a,b) => {
    const A = addedIds.has(a.id), B = addedIds.has(b.id);
    if(A !== B) return A ? -1 : 1;
    const ka = signalKws(a).length, kb = signalKws(b).length;
    if(ka !== kb) return kb - ka;
    return String(b.updated || '').localeCompare(String(a.updated || ''));
  }).slice(0, 3);
}
function renderSignalCards(){
  if(!DATA.public) return '';
  const sigs = deriveSignals();
  if(!sigs.length) return '';
  const addedIds = new Set(((DATA.today || {}).added || []).map(x => x.id));
  /* R1: 社内ウォッチリスト語をそのまま「🔔 <語>」として出していたが、これは
     どの企業・製品を追っているかという社内の関心そのものなので表示を止め、
     ヒットしたという事実だけを中立ラベルで示す。 */
  const card = n => '<div class="sig-card" data-note="'+esc(n.id)+'">'
    + '<div class="sig-src"><span class="tagchip">'+esc(KT(addedIds.has(n.id) ? 'sig_new' : 'sig_kw'))+'</span></div>'
    + '<div class="sig-title">'+esc(n.title)+'</div>'
    + '<div class="sig-desc">'+esc(n.summary||'')+'</div>'
    + '<a class="sig-link" href="#" rel="noopener noreferrer">'+esc(KT('sig_open'))+'</a></div>';
  return renderPanelShell({title: esc(KT('p_signals', {n: sigs.length})),
    body:'<div class="sig-grid">'+sigs.map(card).join('')+'</div>'});
}

/* R1（内部商業情報の保護）：概要画面から以下の内部運用パネルを撤去した。
   ・調査ウィンドウ経過日数 / 校验エラー・警告数 / 「数据详情」（カバレッジ等の内部 QA 指標）
   ・renderStatusStrip（「今日の変化」。git のコミットハッシュを公開していた）
   ・renderReviewPanel（「要レビュー」。超過 12 / 未検証 17 といった内部品質メトリクス）
   ・renderActionsPanel（「推奨アクション」。入札方針・提案判断など社内の営業指示そのもの）
   ・「ウォッチ中キーワード」（社内ウォッチリストの露出）
   ・「データ健全性」（バリデーション結果）
   品質・手法の透明性は、対外的に意味のある形で「会社情報 → 調査手法と掲載基準」に集約した。
   これらのデータ（DATA.today / review / actions / validation / watchlist）は CDN の
   kb-data.json には引き続き含まれているため、根本的な遮断は publish-data.sh 側で行うこと。 */
/* R33：ナレッジベースの状態パネル。
   これまで概要は「17 件 / 24 結論 / 8 実験」という成果の棚卸しだけで、
   同じデータが持っている「見直し期限を過ぎたもの 9 件」「つながりの無いもの 1 件」
   「検証エラー 0 件」を一切出していなかった（実測。R31 の評価で指摘）。
   自己進化を名乗る以上、溜まった量より系の現在の状態を見せる。
   既存の .panel / .stats / .stat / .chip / .footnote を流用するので
   新しい CSS は足していない。 */
function kbHealth(){
  const pub = pubNotes();
  const pubIds = new Set(pub.map(n => n.id));
  /* 公開分だけに絞る。review.* の生データには遮断ナレッジが混ざっている
     （実測：deprecated 1 件・stale 12 件中 3 件が遮断対象）。 */
  const onlyPub = arr => (Array.isArray(arr) ? arr : [])
    .filter(x => pubIds.has(typeof x === 'string' ? x : (x && x.id)));
  const rv = DATA.review || {};
  /* 空文字だけの警告は数えない（実測で warnings は [""]）。 */
  const real = arr => (Array.isArray(arr) ? arr : []).filter(v => {
    if(v == null) return false;
    if(typeof v === 'string') return v.trim() !== '';
    return true;
  });
  const val = DATA.validation || {};
  return {
    total:    pub.length,
    verified: pub.filter(isVerified).length,
    /* 期限超過はナレッジ側から数え直す。review.stale は遮断混じりのうえ、
       遮断ルールを変えても追随しないため。 */
    overdue:  pub.filter(isOverdue).length,
    orphans:  onlyPub(rv.orphans).length,
    errors:   real(val.errors).length,
    builtAt:  String(DATA.built_at || '').slice(0, 10)
  };
}
function renderKbState(){
  const h = kbHealth();
  if(!h.total) return '';
  /* R34：st を渡すと押せるようになり、その状態で絞った一覧へ飛ぶ。
     件数 0 のときは押せない（飛んでも空の一覧にしかならないため）。 */
  const stat = (v, k, st, n) => {
    const live = st && n > 0;
    return '<div class="stat"'
      + (live ? ' data-kbstate="'+esc(st)+'" style="cursor:pointer" role="button" tabindex="0"'
              + ' aria-label="'+esc(k)+' '+esc(String(v))+'"' : '')
      + '><div class="v">'+esc(String(v))+'</div>'
      + '<div class="k">'+esc(k)+'</div></div>';
  };
  return '<div class="panel">'
    + '<h2 class="panel-title">'+esc(KT('kb_state'))
    +   (h.builtAt ? ' <span class="chip">'+esc(KT('kb_built',{d:h.builtAt}))+'</span>' : '')
    + '</h2>'
    + '<div class="stats">'
    +   stat(h.verified + ' / ' + h.total, KT('kb_verified'), 'verified', h.verified)
    +   stat(h.overdue,  KT('kb_overdue'), 'overdue', h.overdue)
    +   stat(h.orphans,  KT('kb_orphan'),  'orphan',  h.orphans)
    +   stat(h.errors,   KT('kb_verr'))
    + '</div>'
    + '<p class="footnote" style="margin:0">'+esc(KT('kb_state_d'))+'</p>'
    + '</div>';
}
function renderOverview(){
  const s = DATA.stats;
  /* R17：ここが例外を投げると renderOverview ごと止まり、
     サイト全体が「データ読み込み失敗」で開けなくなっていた。 */
  const saved = window.lsJSON('kb_checklist', []);
  /* R5: renderSignalCards() の単独パネルは廃止。中身はヒーロー右カラム
     （renderHeroSide）へ移した。関数自体は残してあるので、戻したい場合は
     ここに + renderSignalCards() を復帰させ、renderHeroSide() の呼び出しを外す。 */
  $('#view-overview').innerHTML = renderHero()
    + renderKbState()                      /* R33：系の現在の状態 */
    + renderNavTileGrid(s)
    + '<div class="grid3" style="align-items:start">'
    + '<div class="panel" style="grid-column:span 2"><h2 class="panel-title">'+esc(KT('p_heat'))+' <span class="chip">'+esc(KT('p_heat_badge'))+'</span></h2>'
    /* R26①：公開ナレッジが 0 件のテーマは行に出さない。
       押しても中身が無い行になるため（実測で 20 件中 10 件が該当）。
       件数は公開側から数え直し、遮断ルールの変更に自動で追随させる。 */
    /* R29#1：バーと数字を「公開ナレッジ件数」で作り直す。
       従来は heat7（新規×3 + 出来事×2 + エンティティ×1 + 横断×0.5）を使っていたが、
       出来事・エンティティ・横断は遮断ナレッジ由来で公開分に割り当て直せない
       （実測：公開ナレッジの entities は 0 件）。そのため画面には
         AI 主要ニュース  heat 40.5 / 1 件
         AI ラボ          heat 31.5 / 8 件
       が並び、**バーが一番長いテーマが一番件数の少ないテーマ**になっていた。
       数字の裏づけが取れないものを出さない方針にし、件数だけで並べる。
       trend（↑↓）も遮断前の値（ai-news で 2.55）なので出さない。
       遮断ルールを緩めれば件数が増え、そのまま追随する。 */
    + (() => {
        const ht = {}; pubNotes().forEach(n => ht[n.topic] = (ht[n.topic]||0)+1);
        const rows = (DATA.heat||[]).map(b => [b, ht[b.topic] || 0])
          .filter(([, c]) => c > 0)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);
        if(!rows.length) return '<p class="muted" style="margin:0">—</p>';
        const maxC = Math.max(...rows.map(r => r[1]), 1);
        return rows.map(([b, c]) =>
          '<div class="krow" style="cursor:pointer" data-board="'+esc(b.topic)+'">'
          + '<span class="l"><i style="display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:6px;background:var(--accent)"></i>'+esc(topicName(b.topic) || b.name)+'</span>'
          + '<span class="bartrack"><span class="barfill" style="display:block;width:'+(c/maxC*100)+'%"></span></span>'
          + '<span class="r">'+esc(KT('unit_notes',{n:c}))+'</span></div>').join('');
      })()
    + '<p class="footnote" style="margin:6px 0 0">'+esc(KT('p_heat_note'))+'</p></div>'
    + '<div class="panel"><h2 class="panel-title">'+esc(KT('p_kw'))+'</h2>'
    + '<div class="small" style="margin-bottom:4px">'+esc(KT('kw_top'))+'</div>'
    /* R26①：kw.top は遮断前の件数で作られていたため、
       「Wonder4ge 20 件」のように公開ナレッジ数（17）を超える数字が出ていた。
       watchlist は kbSanitize が公開分だけに絞り込んでいるので、そちらから
       作り直す（＝画面に出す数字は必ず公開ナレッジで裏づけが取れる）。 */
    + (() => {
        const wl = Object.entries(DATA.watchlist||{})
          .map(([k, ids]) => [k, (ids||[]).length])
          .filter(([, n]) => n > 0)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);
        if(!wl.length) return '<p class="muted" style="margin:0">—</p>';
        return wl.map(([kw, n]) => '<div class="krow" style="cursor:pointer" data-kwe="'+esc(kw)+'"><span class="l">'+esc(kw)+'</span><span class="r">'+esc(KT('unit_notes',{n}))+'</span></div>').join('');
      })()
    /* R29#4：「上昇」は履歴が溜まるまで見出しごと出さない。
       実測：常に「集計に十分な履歴がありません。」だけが出ており、
       見出し＋空文言で 50px を占めていた。データが入れば自動で復活する。 */
    + ((DATA.kw?.rising||[]).length
        ? '<div class="small" style="margin:10px 0 4px">'+esc(KT('kw_rising'))+'</div>'
          + (DATA.kw?.rising||[]).map(k => {
            const d = k.cur - k.prev; const cls = d>0?'up':(d<0?'down':'flat'); const sym = d>0?'↑':(d<0?'↓':'→');
            return '<div class="krow" style="cursor:pointer" data-kwe="'+esc(k.kw)+'"><span class="l">'+esc(k.kw)+'</span><span class="r">'+k.cur+' <span style="opacity:.6">← '+k.prev+'</span> <span class="'+cls+'">'+sym+(d>0?'+':'')+d+'</span></span></div>';
          }).join('')
        : '')
    + '</div></div>'
    + renderWeekConcl()
    + '<div class="panel"><h2 class="panel-title">'+IC.check+' '+esc(KT('p_checklist'))+' <span class="muted" id="ck-count"></span></h2>'
      + '<div class="cgrid">'
      + CHECKLIST().map((c,i) => '<label class="check'+(saved[i]?' done':'')+'"><input type="checkbox" data-ck="'+i+'" '+(saved[i]?'checked':'')+'><span>'+esc(c)+'</span></label>').join('')
      + '</div></div>';
  /* R5: ヒーロー右カラムの項目は <a href="#"> なので、preventDefault しないと
     クリックでページ先頭へ飛んでしまう（href="#" の既定動作）。
     ここで一括して抑止する。 */
  $('#view-overview').querySelectorAll('[data-note]').forEach(el => el.onclick = ev => {
    ev.preventDefault();
    openNote(el.dataset.note);
  });
  $('#view-overview').querySelectorAll('[data-line]').forEach(el => el.onclick = () => {
    state.boardLine = el.dataset.line; state.boardTopic = ''; switchTab('boards'); });
  $('#view-overview').querySelectorAll('[data-kwe]').forEach(el => el.onclick = () => {
    openEntity(el.dataset.kwe); });
  /* R34：健全性パネルの数字 → その状態だけの一覧へ。
     期間の絞り込みが残っていると件数が合わなくなるので併せて解除する。 */
  $('#view-overview').querySelectorAll('[data-kbstate]').forEach(el => {
    const go = () => {
      state.noteState = el.dataset.kbstate;
      state.notePeriod = '';
      state.topic = ''; state.tag = ''; state.line = '';
      switchTab('notes');
      window.scrollTo({top:0});
    };
    el.onclick = go;
    el.onkeydown = ev => {
      if(ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar'){ ev.preventDefault(); go(); }
    };
  });
  $('#view-overview').querySelectorAll('[data-board]').forEach(el => el.onclick = () => {
    state.boardTopic = el.dataset.board; state.boardLine = ''; switchTab('boards'); });
  /* R1: 「ウォッチ中キーワード」「推奨アクション」パネルを撤去したため、
     data-kw / data-act / #act-toggle のハンドラも併せて削除した。 */
  const hm = $('#hero-method');
  if(hm) hm.onclick = (e) => { e.preventDefault(); switchSection('about'); gotoMethod(); };
  const gw = $('#goto-wall');
  if(gw) gw.onclick = (e) => { e.preventDefault(); state.boardLine = 'content'; state.boardTopic = ''; switchTab('boards'); };
  const ct = $('#concl-toggle');
  if(ct) ct.onclick = () => { state.conclFull = !state.conclFull; renderOverview(); window.scrollTo({top:0}); };
  const boxes = $('#view-overview').querySelectorAll('[data-ck]');
  const upd = () => { const n = [...boxes].filter(b=>b.checked).length;
    $('#ck-count').textContent = n + '/' + CHECKLIST().length;
    window.lsSet('kb_checklist', JSON.stringify([...boxes].map(b=>b.checked))); };
  boxes.forEach(b => b.onchange = () => { b.closest('.check').classList.toggle('done', b.checked); upd(); });
  upd();
}

/* ---------- 笔记 ---------- */
/* R34：review.orphans（他のナレッジと繋がっていないもの）の id 集合。
   生データは遮断ナレッジを含みうるため公開分だけに絞る。
   健全性パネルの件数と一覧の絞り込みが必ず同じ母数になるよう、ここに集約する。 */
function orphanIdSet(){
  const pubIds = new Set(pubNotes().map(n => n.id));
  const src = (DATA.review && DATA.review.orphans) || [];
  const s = new Set();
  (Array.isArray(src) ? src : []).forEach(x => {
    const id = typeof x === 'string' ? x : (x && x.id);
    if(id && pubIds.has(id)) s.add(id);
  });
  return s;
}
/* R34：状態の判定を 1 か所に。健全性パネルも一覧もここを通す。 */
function matchNoteState(n, st){
  if(!st) return true;
  if(st === 'verified')   return isVerified(n);
  if(st === 'unverified') return !isVerified(n);
  if(st === 'overdue')    return isOverdue(n);
  if(st === 'orphan')     return orphanIdSet().has(n.id);
  return true;
}
function filteredNotes(){
  const q = state.q.toLowerCase();
  return DATA.notes.filter(n => {
    if(!isPublishable(n)) return false;
    if(state.topic && n.topic !== state.topic) return false;
    if(state.tag && !n.tags.includes(state.tag)) return false;
    if(state.line && n.line !== state.line) return false;
    if(state.fresh === 'g' && n.days > (n.stale_limit||30)/2) return false;
    if(state.fresh === 'y' && (n.days <= (n.stale_limit||30)/2 || n.days > (n.stale_limit||30))) return false;
    if(state.fresh === 'r' && n.days <= (n.stale_limit||30)) return false;
    /* R21-5：更新時期での絞り込み。n.days は「最終更新からの経過日数」。 */
    if(state.notePeriod && !(Number(n.days) <= Number(state.notePeriod))) return false;
    /* R34：状態での絞り込み。 */
    if(state.noteState && !matchNoteState(n, state.noteState)) return false;
    if(q){
      if(!hayHit(noteHay(n), qTokens(q))) return false;       /* R20-B1 / R21-2 */
    }
    return true;
  });
}
function renderNoteList(){
  const ns = filteredNotes().slice().sort((a,b) => a.days - b.days);
  const el = $('#note-list');
  /* R1: 「按状态」（内部の検証ステータスでのグルーピング）を外し、テーマ別に置き換えた。
     検証ステータスは内部運用の区分で、対外的な閲覧軸としては意味を持たない。 */
  const views = [['list', KT('nv_list')],['type', KT('nv_type')],['line', KT('nv_line')],['topic', KT('nv_topic')]];
  /* R21-5：更新時期の選択肢。ラベルは短く保つ（R7 の実測どおり、一覧ヘッダーは
     内寸 310px しかなく、長いラベルを並べると 7 言語すべてで折り返す）。 */
  const periods = [['', KT('np_all')],['7', KT('np_7')],['30', KT('np_30')],['90', KT('np_90')]];
  /* R34：状態の選択肢。語は健全性パネル（kb_*）と共有し、食い違いを作らない。 */
  const states = [['', KT('ns_all')], ['verified', KT('kb_verified')], ['unverified', KT('ns_unverified')],
                  ['overdue', KT('kb_overdue')], ['orphan', KT('kb_orphan')]];
  const item = n => { const d = document.createElement('div');
    d.className = 'item' + (state.sel===n.id ? ' sel' : '');
    d.dataset.note = n.id; /* T-14b 悬停预览入口锚点 */
    /* R34：ドットに読み上げ用の名前と説明を付ける（色だけで伝えない）。 */
    const dlab = dotLabel(n.days, n.stale_limit);
    d.innerHTML = '<div class="t"><span class="dot '+dotCls(n.days, n.stale_limit)+'" role="img"'
      + ' title="'+esc(dlab)+'" aria-label="'+esc(dlab)+'"></span>'+esc(n.title)+'</div>'
      + '<div class="meta">'+esc(topicName(n.topic))+' · '+esc(noteType(n.type))+' · '+esc(KT('updated',{d:n.updated}))+'</div>';
    d.onclick = () => openNote(n.id);
    return d; };
  /* ============================================================================
     R7: 一覧ヘッダーのボタン並びを作り直した。

     元の作り：4 つの表示切替ボタン + CSV ボタンを flex-wrap で並べ、
     間に <span style="flex:1"> のスペーサーを挟んでいた。
     問題は 2 つ：
       ① スペーサーは折り返し後の 2 行目に効かないため、
          1 行目だけ右寄せ・2 行目は左寄せというギザギザな並びになっていた
       ② そもそも入りきらない。実測（.list 幅 330px、ヘッダー内寸 310px）：
            zh 333px / ko 392 / en 395 / ja 411 / es 447 / fr 462 / de 506
          つまり全 7 言語で折り返す。4 つの切替ボタンだけでも
          中国語以外は収まらない（de は 364px）。

     対処：排他選択の切替は <select> にする（動画データのフィルタ列と同じ作法で
     サイト内の一貫性もある）。どの言語でも 1 行に収まり、折り返しが起きない。
     CSV は副次操作なのでアイコンボタンにして幅を空ける
     （ラベルは title / aria-label に残す）。
     ============================================================================ */
  const head = document.createElement('div');
  head.className = 'note-head';
  const chips = (state.line
      ? '<span class="chip">'+esc(lineName(state.line))+' <a href="#" id="line-clear" rel="noopener noreferrer" style="margin-left:4px">✕</a></span>' : '')
    + (state.q ? '<span class="chip">'+esc(state.q.slice(0,20))+'</span>' : '');
  const exportLabel = esc(KT('note_export'));
  head.innerHTML =
    (chips ? '<div class="note-head-chips">'+chips+'</div>' : '')
    + '<div class="note-head-ctl">'
    /* BUGFIX(R7-b1)：ここは行頭の連結用 "+" と map 内の "+" が並んで "+ +" になり、
       単項プラスとして評価されて ' selected' が NaN になっていた
       （＝ selected 属性が一度も出力されず、再描画のたびに先頭項目へ戻る）。
       map の中身は 1 行に閉じて、行頭の "+" と混ざらないようにする。 */
    /* R12-b3：aria-label が先頭の選択肢の値（「一覧」）になっており、
       支援技術には「一覧という名前のセレクト」と読まれていた。
       コントロールが何をするものかを名前にする。 */
    +   '<select id="note-view" aria-label="'+esc(KT('nv_aria'))+'">'
    +     views.map(([v, label]) => '<option value="' + v + '"' + (state.noteView === v ? ' selected' : '') + '>' + esc(label) + '</option>').join('')
    +   '</select>'
    +   '<select id="note-period" aria-label="'+esc(KT('np_aria'))+'">'
    +     periods.map(([v, label]) => '<option value="' + v + '"' + (state.notePeriod === v ? ' selected' : '') + '>' + esc(label) + '</option>').join('')
    +   '</select>'
    +   '<select id="note-state" aria-label="'+esc(KT('ns_aria'))+'">'
    +     states.map(([v, label]) => '<option value="' + v + '"' + (state.noteState === v ? ' selected' : '') + '>' + esc(label) + '</option>').join('')
    +   '</select>'
    +   '<button class="btn icon-btn" id="notes-csv" title="'+exportLabel+'" aria-label="'+exportLabel+'">'
    +     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    +     '<path d="M12 3v11m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>'
    +   '</button>'
    + '</div>';
  el.innerHTML = ns.length ? '' : '<p class="muted">—</p>';
  el.prepend(head);
  /* R14：言語注記をここへ。本文を読み始める直前に出るので伝わりやすい。 */
  const lnote = KT('lang_note');
  if(lnote){
    const p = document.createElement('p');
    p.className = 'lang-note';
    p.style.margin = '10px 0 2px';
    p.textContent = lnote;
    head.after(p);
  }
  if(state.noteView === 'list'){
    ns.forEach(n => el.appendChild(item(n)));
  } else {
    const key = state.noteView;
    const groups = {};
    ns.forEach(n => {
      const k = key==='type'  ? (noteType(n.type) || '—')
              : key==='topic' ? (topicName(n.topic) || '—')
              :                 (n.line ? lineName(n.line) : '—');
      (groups[k] = groups[k]||[]).push(n); });
    Object.entries(groups).sort((a,b) => b[1].length - a[1].length).forEach(([g, list]) => {
      const h = document.createElement('div');
      h.className = 'small'; h.style.cssText = 'padding:8px 10px 2px;color:var(--dim)';
      h.textContent = g+'（'+list.length+'）';
      el.appendChild(h);
      list.forEach(n => el.appendChild(item(n)));
    });
  }
  const clr = $('#line-clear');
  if(clr) clr.onclick = (e) => { e.preventDefault(); state.line=''; renderNoteList(); };
  /* R7: 表示切替はボタン群から <select> になったので onchange で受ける */
  const nv = $('#note-view');
  if(nv) nv.onchange = e => { state.noteView = e.target.value; renderNoteList(); };
  /* R21-5：更新時期の絞り込み。選び直したら一覧を作り直す。 */
  const np = $('#note-period');
  if(np) np.onchange = e => { state.notePeriod = e.target.value; renderNoteList(); };
  /* R34：状態での絞り込み。 */
  const nst = $('#note-state');
  if(nst) nst.onchange = e => { state.noteState = e.target.value; renderNoteList(); };
  $('#notes-csv').onclick = () => exportNotesCSV(ns);
}
function exportNotesCSV(ns){
  /* R1（内部商業情報の保護）：書き出し列から scope と path を除去した。
     scope は社内の機密区分そのもの、path は内部 workspace のディレクトリ構成
     （topics/wonder/… 等）を露出するため、いずれも対外配布物に含めない。 */
  /* R14-b3：動画 CSV は 7 言語対応なのに、こちらは英語キー固定で方針が揺れていた。
     客先が Excel で開く前提なので表示言語にそろえる。 */
  const rows = [['nc_id','nc_title','nc_topic','nc_type','nc_status','nc_line','nc_lang','nc_updated','nc_days','nc_backlinks'].map(k => KT(k))];
  /* R27：被リンク数は画面と同じ母数（公開対象のみ）にする。
     従来は遮断したナレッジからの被リンクも数えており、
     画面の「被リンク (N)」と CSV の数字が食い違っていた。 */
  ns.forEach(n => rows.push([n.id, n.title, n.topic, n.type||'', n.status||'', n.line||'', n.lang||'', n.updated, n.days,
    (n.backlinks||[]).filter(b => !!noteById(b.id)).length]));
  const csv = '\uFEFF' + rows.map(r => r.map(x => '"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}));
  a.download = 'kb-notes-'+DATA.built_at.slice(0,10)+'.csv';
  a.click();
}
function openNote(id){
  state.sel = id; switchTab('notes'); renderNoteList(); renderDetail();
  window.scrollTo({top:0});
}

/* ---------- T-14d：digest 总结型时间线渲染（仅 frontmatter type==='digest' 启用）。
   解析规则以现存 9 篇 digest 的实际格式为准：
   - 日期分组标题：`#### 2026-08-29 · 频道名`（频道名可省略，如 intelhub-learned 的 date-only 行）
   - 条目标题：`### [A·new] 标题（重要度 N）`，方括号 = 置信度 A/B/C · 状态 new/updated/watch
   - 保序块结构（修复轮 1）：遇到非条目、非日期分组的标题（任何级别 #，如「## 数据来源与局限」）
     即结束当前条目并退出时间线，其后内容作为普通 Markdown 块接在时间线容器之后、主体列内渲染，
     保序不丢弃；头部区（Summary/Context 等）同理按普通块渲染在时间线之前 ---------- */
function parseDigest(md){
  const reGroup = /^####\s+(\d{4}-\d{2}-\d{2})(?:\s*·\s*(.+?))?\s*$/;
  const reEntry = /^###\s+\[([ABC])·(new|updated|watch)\]\s*(.+?)\s*$/;
  const reImp = /[（(]重要度\s*(\d+)[)）]\s*$/;
  /* 保序块序列：kind='plain' 普通 Markdown 块（前置区/组后章节），kind='group' 日期分组（时间线内） */
  const blocks = [];
  let cur = null, entry = null;
  for(const L of md.split(/\r?\n/)){
    let m = L.match(reGroup);
    if(m){ entry = null; cur = {kind:'group', date:m[1], chan:(m[2]||'').trim(), plain:[], entries:[]}; blocks.push(cur); continue; }
    m = L.match(reEntry);
    if(m){
      const im = m[3].match(reImp);
      entry = {conf:m[1], status:m[2], title:m[3].replace(reImp,'').trim(), imp:im?im[1]:'', lines:[]};
      if(!cur || cur.kind !== 'group'){ cur = {kind:'group', date:'', chan:'', plain:[], entries:[]}; blocks.push(cur); }
      cur.entries.push(entry); continue;
    }
    if(/^#{1,6}\s+/.test(L) && cur){
      /* 非条目、非日期分组的标题：结束当前条目，退出时间线；标题行本身入新普通块，保序不丢字 */
      entry = null; cur = {kind:'plain', lines:[L]}; blocks.push(cur); continue;
    }
    if(entry) entry.lines.push(L);
    else if(cur) (cur.kind === 'group' ? cur.plain : cur.lines).push(L);
    else { cur = {kind:'plain', lines:[L]}; blocks.push(cur); }
  }
  return blocks;
}
function digestTimelineHTML(md){
  const stCls = {new:'tl-status-new', updated:'tl-status-updated', watch:'tl-status-watch'};
  const confCls = {A:'conf-h', B:'conf-m', C:'conf-l'};
  const blocks = parseDigest(md);
  const grpHTML = g => {
    const head = (g.date || g.chan)
      ? '<h3 class="tl-date"><span class="tl-node"></span><span>'+esc(g.date||'')+'</span>'
        + (g.chan ? '<span class="tl-chan">'+esc(g.chan)+'</span>' : '')
        + (g.entries.length ? '<span class="tl-n">'+esc(KT('tl_n',{n:g.entries.length}))+'</span>' : '')
        + '</h3>'
      : '';
    const plain = g.plain.length ? renderMD(g.plain.join('\n')) : '';
    const cards = g.entries.map(e => {
      const body = renderMD(e.lines.join('\n'));
      return '<div class="tl-card"><div class="tl-card-head">'
        + '<span class="conf-badge '+(confCls[e.conf]||'conf-m')+'">'+esc(e.conf)+'</span>'
        + '<span class="tl-status '+(stCls[e.status]||'')+'">'+esc(e.status)+'</span>'
        + '<span class="tl-title">'+esc(e.title)+'</span>'
        + (e.imp ? '<span class="tl-imp">'+esc(KT('tl_imp'))+' '+esc(e.imp)+'</span>' : '')
        + '</div>'
        + (body.trim() ? '<div class="tl-card-body">'+body+'</div>' : '')
        + '</div>';
    }).join('');
    return '<div class="tl-group">'+head+'<div class="tl-grp-body">'+plain+cards+'</div></div>';
  };
  /* 按块序渲染：连续的 group 块合并进同一个 .tl 容器，普通块在容器外按序输出 */
  let html = '', tl = null;
  const flush = () => { if(tl){ html += '<div class="tl">'+tl.join('')+'</div>'; tl = null; } };
  for(const b of blocks){
    if(b.kind === 'group'){ if(!tl) tl = []; tl.push(grpHTML(b)); }
    else { flush(); html += renderMD(b.lines.join('\n')); }
  }
  flush();
  return html;
}
/* R14：ナレッジタブの未選択時、右の広い領域が 1 行だけで、
   このタブに来た瞬間の情報量が乏しかった（左は 79 件、右は空）。
   最近更新された 3 件を出して、そのまま読み始められるようにする。
   describe を出さないのはヒーローのシグナルと同じ理由（本文が執筆言語のまま）。 */
function notePickHTML(){
  const recent = pubNotes().slice()
    .sort((a,b) => String(b.updated||'').localeCompare(String(a.updated||'')))
    .slice(0, 3);
  /* 最近更新の一覧を出すときは np_hint が同じことを言うので、
     note_pick は出さない（「一覧から選んでください」が 2 行続くのを避ける）。
     データが 0 件のときだけ従来の 1 行に落とす。 */
  if(!recent.length) return '<p class="muted">'+esc(KT('note_pick'))+'</p>';
  let h = '<div class="np-recent">'
    + '<div class="side-head">'+esc(KT('np_recent'))+'</div>'
    + recent.map(n => '<a class="side-item" href="#" data-note="'+esc(n.id)+'">'
        + '<span class="side-title">'+esc(n.title)+'</span>'
        + '<span class="side-meta">'+esc(topicName(n.topic) || '')
        +   (n.updated ? ' ・ ' + esc(n.updated) : '')+'</span>'
        + '</a>').join('')
    + '<p class="footnote" style="margin:10px 0 0">'+esc(KT('np_hint'))+'</p>'
    + '</div>';
  return h;
}
function bindNotePick(el){
  if(!el) return;
  el.querySelectorAll('[data-note]').forEach(a => a.onclick = ev => {
    ev.preventDefault(); openNote(a.dataset.note); });
}
function renderDetail(){
  const n = noteById(state.sel); const el = $('#note-detail');
  /* R20-B8：ナレッジを選んでいる間は画面レベルの見出しを h2 に落とす
     （選択中の h1 はナレッジのタイトル 1 つだけにする）。 */
  setHeadLevel(document.getElementById('h-view-notes'), n ? 'h2' : 'h1');
  if(!n){ el.innerHTML = notePickHTML(); bindNotePick(el); return; }
  const claims = (DATA.conclusions||[]).filter(c => c.note_id===n.id && c.kind==='claim').slice(0,5);
  /* R27：被リンクを公開対象だけに絞る。
     実測（R26 の遮断後の再検査）：`20260829-local-llm-digest` の被リンク一覧に、
     遮断した `20260903-local-llm-leaderboards`（scope=internal / type=research）の
     題名「本地 LLM 开源榜总览」がリンクとして出ていた。
     backlinks はデータ側が持つ配列をそのまま描いていたため、
     isPublishable を変えても追随していなかった。
     件数（infobox の dl）も同じ母数にする。 */
  const backs = (n.backlinks||[]).filter(b => !!noteById(b.id));
  const nextReview = (() => {
    if(!n.verified_at) return '—';
    const rv = parseInt(n.review_every||'90', 10) || 90;
    const d = new Date(n.verified_at);
    if(isNaN(d)) return '—';
    d.setDate(d.getDate()+rv);
    return d.toISOString().slice(0,10)+'（'+KT('d_review_every',{n:rv})+'）';
  })();
  el.innerHTML =
    '<div class="badges" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">'
    + '<span class="tagchip" style="background:var(--panel2);font-weight:600">'+esc(noteType(n.type) || '—')+'</span>'
    + (n.line ? '<span class="tagchip" style="background:var(--panel2)">'+(LINE_NAMES[n.line]||n.line)+'</span>' : '')
    + '<span class="tagchip" style="background:var(--panel2)">'+esc(n.status||'')+'</span>'
    + (n.lang ? '<span class="tagchip" style="background:var(--panel2)">'+esc(n.lang)+'</span>' : '')
    + (n.source_drift ? '<span class="mtag" style="background:#c0392b;color:#fff">'+esc(KT('d_drift'))+'</span>' : '')
    + '</div>'
    + '<h1>'+esc(n.title)+'</h1>'
    /* BUGFIX(R1-b1): 閉じていない </span> が 1 つ余っていた（対応する開始タグが無い）。
       BUGFIX(R1-b2): PNAME[n.topic] が未定義のとき文字列 "undefined" が出る。
       現行データでは全 topic が揃っているため顕在化していないが、topic 追加時に
       stats.topics への反映が漏れると即座に表面化するのでフォールバックを入れた。 */
    /* R21-1：この 1 件を指す URL を渡せるようにする。
       実測（R20 検査）ではナレッジを開いても URL が空のままで、
       客先に「この分析を見てください」と送れなかった。 */
    + '<p style="margin:0 0 10px"><button class="btn" id="copy-link" data-i18n="copy_link">リンクをコピー</button> '
    +   '<span class="meta" id="copy-link-msg" aria-live="polite"></span></p>'
    + '<div class="meta" style="margin-bottom:8px">'+esc(n.id)+' · '+esc(topicName(n.topic) || '—')+' · '
    + '<span class="dot '+dotCls(n.days, n.stale_limit)+'"></span>'+esc(KT('meta_updated_ago',{n:n.days}))+'</div>'
    /* R2: ナレッジ詳細のラベルも多言語化（最もよく読まれるビューなので取りこぼしは致命的）。
       「来源 N 个域名」は内部の集計口径だったので、単純に出典数へ変更。 */
    + '<div class="infobox" style="margin-bottom:10px"><dl>'
    + '<dt>'+esc(KT('meta_verified'))+'</dt><dd>'+esc(n.verified_at||'—')+'</dd>'
    + '<dt>'+esc(KT('meta_nextreview'))+'</dt><dd>'+nextReview+'</dd>'
    + '<dt>'+esc(KT('note_sources'))+'</dt><dd>'+(n.sources||[]).length+'</dd>'
    + '<dt>'+esc(KT('note_backlinks'))+'</dt><dd>'+backs.length+'</dd>'   /* R27 */
    + '</dl></div>'
    + (claims.length
        ? '<div class="concl"><b>'+esc(KT('p_concl'))+'</b>'
          + '<ol>'+claims.map(c=>'<li>'+esc(c.text)+'</li>').join('')+'</ol></div>'
        : '')
    + renderChartsBlock(n)
    + '<div class="toc" id="toc"></div><div id="mdbody"></div>'
    + '<h2>'+esc(KT('note_backlinks'))+' ('+backs.length+')</h2>'   /* R27 */
    + (backs.length ? '<ul>'+backs.map(b=>'<li><a data-note="'+esc(b.id)+'" href="#note/'+esc(b.id)+'">'+esc(b.title)+'</a></li>').join('')+'</ul>' : '<p class="muted">—</p>')
    + ((n.sources && n.sources.length)
        ? '<h2>'+esc(KT('note_sources'))+' ('+n.sources.length+')</h2><div class="csrc">'
          + n.sources.map(s2 => '<a class="srclink" href="'+esc(s2.url)+'" target="_blank" rel="noopener noreferrer">🔗 '+esc(s2.label)+'</a>').join('') + '</div>'
        : '');
  /* R16：本文はほぼ全件が「# タイトル」で始まり、直前で <h1> として
     題名を描いているので、同じ文字列が 2 回続いて出ていた（実測 79/79 件）。
     1 ページに h1 が 2 つある状態でもあった。
     先頭の見出しが題名と一致する場合だけ落とす（違う見出しなら情報なので残す）。 */
  const stripDupH1 = md => {
    const t = String(n.title || '').replace(/\s+/g, '');
    return String(md).replace(/^\s*#\s+(.+?)\s*(?:\r?\n|$)/, (m, h) => {
      /* R16：本文の見出しには題名から外した社内アカウント呼称が残っている場合がある
         （例：題名「内容发布计划 v2（定位 v2）」／本文「# 白菜咕咕 · 内容发布计划 v2（定位 v2）」）。
         本文の散文中の呼称は文の主語なので触らない方針だが、
         見出しは題名と同じ性質なので、比較のときだけ題名と同じ規則で正規化する。
         一致すれば見出しごと落ちるので、呼称も画面から消える。 */
      const norm = kbScrub(h).replace(/\s+/g, '');
      return (norm === t || h.replace(/\s+/g, '') === t) ? '' : m;
    });
  };
  const mdBody = stripDupH1((n.content||'').replace(/```chart[\s\S]*?```/g, ''));
  $('#mdbody').innerHTML = n.type === 'digest' ? digestTimelineHTML(mdBody) : renderMD(mdBody);
  const toc = $('#toc'); const hs = el.querySelectorAll('#mdbody h2, #mdbody h3');
  toc.innerHTML = hs.length ? esc(KT('d_toc')) + Array.from(hs).map((h,i)=>{
    h.id = 'h-'+i; const pad = h.tagName==='H3' ? '　' : '';
    return '<a data-anchor="h-'+i+'" rel="noopener noreferrer">'+pad+esc(h.textContent)+'</a>';
  }).join(' · ') : '';
  toc.querySelectorAll('a[data-anchor]').forEach(a => a.onclick = () => el.querySelector('#'+a.dataset.anchor).scrollIntoView({behavior:'smooth'}));
  el.querySelectorAll('a[data-note]').forEach(a => a.onclick = ev => { ev.preventDefault(); openNote(a.dataset.note); });
}

/* ---------- 实体聚合视图（T-14a）：点实体不再跳搜索，而是聚合该实体的
   提及笔记与共现实体。提及笔记按实体登记口径（DATA.notes[].entities 包含
   该实体名，非全文搜索）；未知实体 = 未在任何 notes[].entities 登记。
   共现实体来自 DATA.entity_graph 邻边，按 weight 排序。 ---------- */
function entityMentionNotes(name){
  /* R12-b4：エンティティ集約ビューも遮断を通していなかった */
  const direct = pubNotes().filter(n => (n.entities || []).includes(name));
  if(direct.length) return direct;
  /* R30#5：公開ナレッジの entities は実測 0 件で、概要のキーワード行 9 個すべてが
     「未登録のエンティティ」に着地していた。件数の出どころである watchlist は
     kbSanitize が公開 id だけに絞り込んでいるので、こちらを第 2 の登記簿として
     使う（＝画面に出ている件数と開いた先の中身が必ず一致する）。 */
  const ids = (DATA.watchlist || {})[name];
  if(!Array.isArray(ids) || !ids.length) return [];
  const set = new Set(ids);
  return pubNotes().filter(n => set.has(n.id));
}
function entityRegistered(name){
  return entityMentionNotes(name).length > 0;
}
/* R30#5：公開側で解決できるエンティティ名の一覧（notes[].entities ∪ watchlist）。 */
function entityNames(){
  const s = new Set();
  pubNotes().forEach(n => (n.entities || []).forEach(e => s.add(e)));
  Object.keys(DATA.watchlist || {}).forEach(k => {
    if(Array.isArray(DATA.watchlist[k]) && DATA.watchlist[k].length) s.add(k);
  });
  return [...s];
}
function entityNeighbors(name){
  /* R30#5：従来は entity_graph の weight を「共起 N」として出していたが、
     この重みは遮断ナレッジ込みで算出されており、辺に出てくる 23 名のうち 10 名は
     遮断ナレッジにしか登場しない（RAG / SES / Qwen / Google / GLM など）。
     公開ナレッジの中で同じナレッジに同時に出てくる回数で数え直し、
     公開側で解決できる名前だけを返す。 */
  const mine = new Set(entityMentionNotes(name).map(n => n.id));
  if(!mine.size) return [];
  const out = [];
  for(const other of entityNames()){
    if(other === name) continue;
    const c = entityMentionNotes(other).filter(n => mine.has(n.id)).length;
    if(c > 0) out.push([other, c]);
  }
  return out.sort((a,b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}
/* ============================================================================
   R15：検索結果ビュー
   ----------------------------------------------------------------------------
   従来の検索は state.q を各タブの絞り込みに流すだけで、「検索結果」という画面が
   存在しなかった。そのため
     ・概要 / テーマ / 関連分析 で検索すると件数だけ出て画面が一切変わらない
     ・Enter を押しても何も起きない
     ・結論 859 件には検索から到達する導線が無い
        （テーマ → 該当ボード → 結論ウォールまで手動で辿るしかない）
   という状態だった。ナレッジ・結論・動画データの 3 種を横断して見せる面を作る。
   ============================================================================ */
/* 検索結果ビュー内の照合は「検索語だけ」で行う。
   filteredNotes / filteredVideos はテーマ・タグ・ファセットも見るので、
   そのまま使うと「概要から検索したのに件数が少ない」という食い違いが出る。
   件数表示（updateQCount）と同じ母集団・同じ条件でそろえてある。 */
function filteredNotesForSearch(){
  const q = state.q.toLowerCase();
  if(!q) return [];
  const toks = qTokens(q);                                    /* R21-2 */
  return pubNotes().filter(n => hayHit(noteHay(n), toks))
    .sort((a,b) => String(b.updated||'').localeCompare(String(a.updated||'')));
}
function filteredVideosForSearch(){
  const q = state.q.toLowerCase();
  if(!q) return [];
  const toks = qTokens(q);                                    /* R21-2 */
  return VIDEOS.filter(e => hayHit(videoHay(e), toks));
}
/* ==== R24：「結論」という語が 2 つの母数を指していた問題 ====
   実測（R23 の全面テスト）：
     kind='claim' : 317 件  ← ヒーローの「317 検証済み結論」が数えているもの
     kind='point' : 542 件
     合計          : 859 件  ← 検索結果の「結論」グループが数えていたもの
   トップで「317」と読んだ人が検索で「結論 719 件」を見ると食い違って見える。
   出典で検証できることを売りにしているサイトで、その「結論」の件数が
   場所によって違うのは避けたい種類の食い違い。

   さらに kind='point' の中身を section 名で調べると、
     构成特征观察 / 每家近况 / 分档推荐表 / 配置模板 / 假设 / 方法（预注册） /
     Inputs / 证据链 / 待办（人类环节） / 身份锚点 …
   のように観察・手順・仮説・TODO まで混ざっており、**そもそも結論ではない**。
   一方 kind='claim' の section は 已验证结论 / 结论归档 / 核心结论 …
   とすべて「結論」を含む節から来ている。

   対処：「結論」は claim だけを指すことにし、point は
   「本文中の記述」として別グループに分ける。point 542 件には
   「Gemini 3.1 Pro は $2/$12」のような具体的な事実も含まれるので、
   検索から消すのではなく名前を実体に合わせる。 */
function searchConclusions(kind){
  const q = state.q.toLowerCase();
  if(!q) return [];
  const toks = qTokens(q);                                    /* R21-2 */
  return (DATA.conclusions || []).filter(c =>
    noteById(c.note_id) && (!kind || c.kind === kind) && hayHit(conclHay(c), toks));
}
function renderSearchView(){
  const el = $('#view-search');
  if(!el) return;
  const q = state.q;
  if(!q){ el.innerHTML = ''; return; }

  const notes = filteredNotesForSearch();
  const concls = searchConclusions('claim');                   /* R24 */
  const points = searchConclusions('point');                   /* R24 */
  const vids = filteredVideosForSearch();
  const total = notes.length + concls.length + points.length + vids.length;

  const toks = qTokens(q);                                    /* R21-2 */
  let h = '<div class="sr-head">'
    + '<h1>'+esc(KT('sr_title', {q: q}))+'</h1>'
    + '<span class="chip">'+esc(KT('sr_total', {n: total}))+'</span>'
    + '</div>'
    /* R21-2：2 語以上のときは AND で絞っていることを明示する
       （黙って絞ると「なぜ少ないのか」が分からない）。 */
    + (toks.length > 1 ? '<p class="sr-and">'+esc(KT('sr_and', {n: toks.length}))+'</p>' : '');

  if(!total){
    h += '<div class="panel"><p class="muted" style="margin:0 0 6px">'+esc(KT('sr_none', {q: q}))+'</p>'
      + '<p class="footnote" style="margin:0">'+esc(KT('sr_hint'))+'</p></div>'
      + '<p class="sr-actions"><a href="#" id="sr-clear" rel="noopener noreferrer">'+esc(KT('sr_clear'))+'</a></p>';
    el.innerHTML = h;
    bindSearchView(el);
    return;
  }

  const LIM = 5;
  /* 行き先のタブがある種類は「すべて見る →」でそちらへ送る。
     結論はタブが無いので、この場で展開できるようにする。 */
  const group = (key, label, list, itemHTML, allTab) => {
    if(!list.length){
      return '<div class="sr-group"><div class="sr-group-head">'
        + '<span class="l">'+esc(label)+' <span class="n">0</span></span></div>'
        + '<p class="sr-empty">'+esc(KT('sr_group_none'))+'</p></div>';
    }
    const full = !!state.srFull[key];
    const shown = full ? list : list.slice(0, LIM);
    const rest = list.length - shown.length;
    let g = '<div class="sr-group"><div class="sr-group-head">'
      + '<span class="l">'+esc(label)+' <span class="n">'+esc(KT('sr_total', {n: list.length}))+'</span></span>';
    if(allTab && list.length > LIM)
      g += '<a class="sr-more" href="#" data-sr-tab="'+allTab+'" rel="noopener noreferrer">'+esc(KT('sr_all'))+'</a>';
    else if(!allTab && (rest > 0 || full))
      g += '<a class="sr-more" href="#" data-sr-toggle="'+key+'" rel="noopener noreferrer">'
        + esc(full ? KT('sr_less') : KT('sr_more', {n: rest}))+'</a>';
    g += '</div>' + shown.map(itemHTML).join('') + '</div>';
    return g;
  };

  h += group('notes', KT('sr_notes'), notes, n =>
      '<a class="sr-item" href="#note/'+esc(n.id)+'" data-note="'+esc(n.id)+'">'
      + '<span class="sr-t">'+escHi(n.title, toks)+'</span>'
      + '<span class="sr-m">'+esc(noteType(n.type) || '')
      +   ' ・ '+esc(topicName(n.topic) || '')
      +   (n.updated ? ' ・ '+esc(n.updated) : '')+'</span></a>', 'notes');

  h += group('concl', KT('sr_concl'), concls, c => {
      const src = noteById(c.note_id);
      return '<a class="sr-item is-concl" href="#note/'+esc(c.note_id)+'" data-note="'+esc(c.note_id)+'">'
        + '<span class="sr-t">'+escHi(c.text, toks)+'</span>'
        + '<span class="sr-m">'+esc(KT('sr_from'))+'：'+escHi((src && src.title) || c.note_id, toks)
        +   (c.section ? ' ・ '+esc(c.section) : '')+'</span></a>';
    }, '');

  /* R24：本文中の記述（kind='point'）。結論とは別の母数なので別グループ。
     行き先のタブは無いので、この場で展開できるようにする（結論と同じ扱い）。 */
  h += group('points', KT('sr_points'), points, c => {
      const src = noteById(c.note_id);
      return '<a class="sr-item is-concl" href="#note/'+esc(c.note_id)+'" data-note="'+esc(c.note_id)+'">'
        + '<span class="sr-t">'+escHi(c.text, toks)+'</span>'
        + '<span class="sr-m">'+esc(KT('sr_from'))+'：'+escHi((src && src.title) || c.note_id, toks)
        +   (c.section ? ' ・ '+escHi(c.section, toks) : '')+'</span></a>';
    }, '');

  h += group('videos', KT('sr_videos'), vids, e => {
      const src = noteById(e.note_id);
      return '<a class="sr-item" href="#videos" data-sr-tab="videos">'
        + '<span class="sr-t">'+escHi(e.text, toks)+'</span>'
        + '<span class="sr-m">'+esc(topicName(e.platform) || '')
        +   (e.metric_type_label ? ' ・ '+esc(metricLabel(e.metric_type_label)) : '')
        +   (src ? ' ・ '+esc(KT('sr_from'))+'：'+esc(src.title) : '')+'</span></a>';
    }, 'videos');

  h += '<p class="sr-actions"><a href="#" id="sr-clear" rel="noopener noreferrer">'+esc(KT('sr_clear'))+'</a></p>';
  el.innerHTML = h;
  bindSearchView(el);
}
function bindSearchView(el){
  el.querySelectorAll('[data-note]').forEach(a => a.onclick = ev => {
    ev.preventDefault(); openNote(a.dataset.note); });
  el.querySelectorAll('[data-sr-tab]').forEach(a => a.onclick = ev => {
    ev.preventDefault(); switchTab(a.dataset.srTab); });
  el.querySelectorAll('[data-sr-toggle]').forEach(a => a.onclick = ev => {
    ev.preventDefault();
    const k = a.dataset.srToggle;
    /* 展開は見出しの下に項目が増えるだけなので、位置は動かさない
       （先頭へ戻すと、今見ていた場所を見失う）。 */
    state.srFull[k] = !state.srFull[k];
    renderSearchView();
  });
  const clr = el.querySelector('#sr-clear');
  if(clr) clr.onclick = ev => { ev.preventDefault(); clearSearch(); };
}
/* 検索の解除：語を消して、検索を始めたタブへ戻す。 */
function clearSearch(){
  const back = state.searchFrom && state.searchFrom !== 'search' ? state.searchFrom : 'overview';
  state.q = '';
  state.srFull = {};
  state.searchFrom = '';
  const inp = $('#q');
  if(inp) inp.value = '';
  updateQCount('');
  switchTab(back);
}
function renderEntityView(){
  const el = $('#view-entity');
  const name = state.entity;
  if(name == null){ el.innerHTML = ''; return; }
  const notes = entityMentionNotes(name).slice()
    .sort((a,b) => String(b.updated||'').localeCompare(String(a.updated||'')));
  const nbAll = entityNeighbors(name);
  const nb = nbAll.slice(0, 8);
  /* R9: このビューは中国語ハードコードのまま残っていた（R2 でキーだけ用意し接続漏れ）。
     全ラベルを KT() 経由にし、絵文字（🔗 / 📄）も外した。 */
  if(!entityRegistered(name)){
    el.innerHTML = '<p style="margin:4px 0"><button class="btn" id="entity-back">'+esc(KT('back'))+'</button></p>'
      + '<div class="panel"><h2 class="panel-title">'+esc(KT('e_unreg'))+'</h2>'
      + '<p class="muted" style="margin:4px 0 0">'
      + esc(String(name).trim() ? KT('e_unreg_msg', {name}) : KT('e_noname'))+'</p></div>';
    $('#entity-back').onclick = closeEntity;
    return;
  }
  const tc = {}, lc = {};
  notes.forEach(n => { tc[n.topic] = (tc[n.topic]||0)+1; if(n.line) lc[n.line] = (lc[n.line]||0)+1; });
  const mainTopic = Object.keys(tc).sort((a,b) => tc[b]-tc[a])[0] || '';
  const mainLine = Object.keys(lc).sort((a,b) => lc[b]-lc[a])[0] || '';
  const lastUpd = notes.length ? notes[0].updated : '—';
  el.innerHTML =
    '<p style="margin:4px 0"><button class="btn" id="entity-back">'+esc(KT('back'))+'</button></p>'
    + '<div class="panel">'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 0">'
    + (mainLine ? '<span class="tagchip">'+esc(lineName(mainLine))+'</span>' : '')
    + (mainTopic ? '<span class="tagchip">'+esc(KT('e_main_topic'))+' · '+esc(topicName(mainTopic))+'</span>' : '')
    + '</div>'
    + '<h1 style="font-size:var(--fs-h2);margin:8px 0 4px;letter-spacing:-.01em;overflow-wrap:anywhere">'+esc(name)+'</h1>'
    + '<div class="stats">'
    + '<div class="stat"><div class="v">'+notes.length+'</div><div class="k">'+esc(KT('e_st_mentions'))+'</div></div>'
    + '<div class="stat"><div class="v">'+nbAll.length+'</div><div class="k">'+esc(KT('e_st_neighbors'))+'</div></div>'
    + '<div class="stat"><div class="v" style="font-size:var(--fs-h4)">'+esc(lastUpd)+'</div><div class="k">'+esc(KT('e_st_updated'))+'</div></div>'
    + '</div></div>'
    + '<div class="ent-grid">'
    + '<div class="panel"><h2 class="panel-title">'+esc(KT('e_neighbors'))
    +   ' <span class="chip">'+esc(KT('e_of',{a:nb.length, b:nbAll.length}))+'</span></h2>'
    + (nb.length ? nb.map(([w, c]) =>
        '<div class="krow" style="cursor:pointer" data-ent="'+esc(w)+'"><span class="l">'+esc(w)+'</span><span class="r">'+esc(KT('e_cooc',{n:c}))+'</span></div>').join('')
      : '<p class="muted" style="margin:4px 0 0">'+esc(KT('e_no_neighbors'))+'</p>')
    + '<p class="footnote" style="margin:8px 0 0">'+esc(KT('e_fn_neighbors'))+'</p></div>'
    + '<div class="panel"><h2 class="panel-title">'+esc(KT('e_mentions'))
    +   ' <span class="chip">'+esc(KT('unit_notes',{n:notes.length}))+'</span></h2>'
    + (notes.length ? notes.map(n =>
        '<div class="krow" style="cursor:pointer" data-note="'+esc(n.id)+'"><span class="l">'+esc(n.title)+'</span>'
        + '<span class="r">'+esc(n.updated)+' · '+esc(noteType(n.type))+'</span></div>').join('')
      : '<p class="muted" style="margin:4px 0 0">'+esc(KT('e_no_mentions'))+'</p>')
    + '<p class="footnote" style="margin:8px 0 0">'+esc(KT('e_fn_mentions'))+'</p></div>'
    + '</div>';
  $('#entity-back').onclick = closeEntity;
  el.querySelectorAll('[data-ent]').forEach(x => x.onclick = () => openEntity(x.dataset.ent));
  el.querySelectorAll('[data-note]').forEach(x => x.onclick = () => openNote(x.dataset.note));
}
function openEntity(name){
  if(state.tab !== 'entity') state.entityFrom = state.tab;
  state.entity = name;
  switchTab('entity');                       /* R21-1：URL は syncHash が付ける */
  window.scrollTo({top:0});
}
/* 离开实体视图的统一清理（T-14a 修复轮）：状态归零 + 摘除 #entity/ hash。
   openNote / 搜索框切回笔记页 / 导航 tab 切换都经 switchTab(非 entity) 收口；
   closeEntity 与 hashchange 路径显式调用。replaceState 不触发 hashchange，
   避免与 applySectionFromHash 重入。 */
function leaveEntityHash(){
  if(state.entity == null && !/^#entity\//.test(location.hash)) return;
  state.entity = null;
  state.entityFrom = '';
  if(/^#entity\//.test(location.hash))
    history.replaceState(null, '', location.pathname + location.search);
}
function closeEntity(){
  const from = state.entityFrom && state.entityFrom !== 'entity' ? state.entityFrom : 'overview';
  leaveEntityHash();
  switchTab(from);
  window.scrollTo({top:0});
}

/* ---------- 关联分析 ---------- */
function mulberry32(a){ return function(){ a|=0; a=(a+0x6D2B79F5)|0;
  let t = Math.imul(a^(a>>>15), 1|a); t = (t+Math.imul(t^(t>>>7), 61|t))^t;
  return ((t^(t>>>14))>>>0)/4294967296; }; }
let G = null;
const LINE_COLORS = {content:'#2563eb','enterprise-ai':'#1baf7a',intel:'#eb6834',platform:'#eda100'};
/* R26①：公開ナレッジに登場するエンティティの集合。
   エンティティ図と、モード切替ボタンの出し入れの両方で使う。 */
function graphEntitySet(){
  /* R30#2-c：notes[].entities だけだと公開分は実測 0 件で、エンティティ図が
     常に空＝ナレッジ図へ自動フォールバックしていた（説明文と実態が不一致）。
     R30#5 と同じく watchlist を第 2 の登記簿として使う。 */
  const s = new Set();
  pubNotes().forEach(n => (n.entities||[]).forEach(e => s.add(e)));
  Object.keys(DATA.watchlist || {}).forEach(k => {
    if(Array.isArray(DATA.watchlist[k]) && DATA.watchlist[k].length) s.add(k);
  });
  return s;
}
/* R30#2-d：エンティティ図に出す名前。graphEntitySet() は「登記があるか」で、
   こちらは「開いたときに中身が 1 件以上あるか」で絞る。 */
function graphEntitySet2(){
  return [...graphEntitySet()].filter(nm => entityMentionNotes(nm).length > 0).sort();
}
function buildGraph(){
  const rnd = mulberry32(42);
  const nodes = [], edges = [], idx = {};
  const add = (id, title, kind, topic, r0, line) => { if(idx[id]) return idx[id];
    idx[id] = nodes.length; nodes.push({id, title, kind, topic, line,
      x:.5+(rnd()-.5)*.7, y:.5+(rnd()-.5)*.6, vx:0, vy:0, r:r0}); return idx[id]; };
  if(state.graphMode === 'entity' && DATA.entity_graph){
    /* R26①：エンティティは公開ナレッジに登場するものだけにする。
       実測：scope='internal' を遮断対象に加えた結果、entity_graph の 24 ノードは
       すべて遮断ナレッジ由来になり（公開ナレッジ側の entities は 0 件）、
       円をクリックしても集約ビューが 0 行になる状態だった。 */
    /* R30#2-d：丸の大きさ（docs）と線（edges）は遮断ナレッジ込みの値なので、
       公開ナレッジでの言及数と同時出現から組み直す。色分けだけ引き継ぐ。 */
    const lineOf = {};
    ((DATA.entity_graph && DATA.entity_graph.nodes) || []).forEach(n => lineOf[n.name] = n.line);
    const names = graphEntitySet2();
    names.forEach(nm => add('ent:'+nm, nm, 'entity', null,
      6 + Math.min(entityMentionNotes(nm).length, 20)/4, lineOf[nm]));
    names.forEach(nm => entityNeighbors(nm).forEach(([other]) => {
      const a = idx['ent:'+nm], b = idx['ent:'+other];
      if(a != null && b != null && a < b) edges.push([a, b]);
    }));
    G = {nodes, edges, deg:{}}; nodes.forEach(n => G.deg[n.id]=1);
    edges.forEach(([a,b]) => { G.deg[nodes[a].id]++; G.deg[nodes[b].id]++; });
    return;
  }
  /* R26①：遮断したナレッジをノードに出さない。
     ここは DATA.notes を直に走査していたため、scope='internal' を遮断対象に
     加えたあとも 63 件が「ナレッジ関連図」に残っていた。
     canvas に描く文字は DOM に出ないので、画面の文字列を走査する検査では
     見つけられない（実測でノード 80 件のうち 63 件が遮断対象だった）。
     テーマとキーワードも、公開ナレッジが 1 件も無いものは出さない。 */
  const gpub = pubNotes();
  const gpubIds = new Set(gpub.map(n => n.id));
  const gTopics = new Set(gpub.map(n => n.topic));
  for(const n of gpub) add(n.id, n.title.split('（')[0], 'note', n.topic, 7);
  for(const p of Object.keys(DATA.stats.topics)) if(gTopics.has(p)) add('topic:'+p, topicName(p), 'topic', p, 9);
  for(const [kw, ids] of Object.entries(DATA.watchlist))
    if((ids||[]).some(id => gpubIds.has(id))) add('kw:'+kw, kw, 'hotword', null, 3.5);
  for(const n of gpub){
    if(idx['topic:'+n.topic] != null) edges.push([idx[n.id], idx['topic:'+n.topic]]);
    for(const [kw, ids] of Object.entries(DATA.watchlist))
      if(idx['kw:'+kw] != null && ids.includes(n.id)) edges.push([idx[n.id], idx['kw:'+kw]]);
    (n.related||[]).forEach(r => { if(idx[r] != null && gpubIds.has(r)) edges.push([idx[n.id], idx[r]]); });
  }
  G = {nodes, edges, deg:{}}; nodes.forEach(n => G.deg[n.id]=1);
  edges.forEach(([a,b]) => { G.deg[nodes[a].id]++; G.deg[nodes[b].id]++; });
}
function computeGraphLayout(){
  const cv = $('#graph-canvas'); const W = cv.width, H = cv.height;
  const nodes = G.nodes.map(n => ({...n}));
  for(let it=0; it<600; it++){
    for(let i=0;i<nodes.length;i++) for(let j=i+1;j<nodes.length;j++){
      const a=nodes[i], b=nodes[j];
      const dx=b.x-a.x, dy=b.y-a.y; const d2=dx*dx+dy*dy||1e-4;
      if(d2 < .05){ const f=.0018/d2; a.vx-=dx*f; a.vy-=dy*f; b.vx+=dx*f; b.vy+=dy*f; }
    }
    G.edges.forEach(([ai,bi]) => {
      const a=nodes[ai], b=nodes[bi];
      const dx=b.x-a.x, dy=b.y-a.y; const d=Math.sqrt(dx*dx+dy*dy)||1e-3;
      const f=(d-.24)*.06; a.vx+=f*dx/d; a.vy+=f*dy/d; b.vx-=f*dx/d; b.vy-=f*dy/d;
    });
    nodes.forEach(n => { n.vx+=(.5-n.x)*.015; n.vy+=(.5-n.y)*.015; n.vx*=.8; n.vy*=.8; n.x+=n.vx; n.y+=n.vy; });
  }
  nodes.forEach(n => { n.px = 46 + n.x*(W-92); n.py = 34 + n.y*(H-72); });
  G.layout = nodes;
}
function drawGraph(hover){
  if(!G) buildGraph();
  const theme = document.documentElement.dataset.theme;
  if(!G.layout || G.layoutTheme !== theme){ computeGraphLayout(); G.layoutTheme = theme; }
  const cv = $('#graph-canvas'); const W = cv.width, H = cv.height; const ctx = cv.getContext('2d');
  const nodes = G.layout;
  const light = isLight();
  const nb = hover != null ? new Set([hover, ...G.edges.filter(([a,b]) => a===hover||b===hover).flatMap(([a,b]) => [a,b])]) : null;
  ctx.clearRect(0,0,W,H);
  ctx.lineWidth = 1.2;
  G.edges.forEach(([a,b]) => {
    const dim = nb && !(nb.has(a) && nb.has(b));
    ctx.strokeStyle = light ? 'rgba(106,118,134,'+(dim?.2:.8)+')' : 'rgba(120,140,180,'+(dim?.15:.6)+')';
    ctx.beginPath(); ctx.moveTo(nodes[a].px, nodes[a].py); ctx.lineTo(nodes[b].px, nodes[b].py); ctx.stroke();
  });
  ctx.font = '11px system-ui';
  nodes.forEach((n, i) => {
    const dim = nb && !nb.has(i);
    ctx.globalAlpha = dim ? .25 : 1;
    const r = n.r + Math.min(G.deg[n.id], 8);
    ctx.lineWidth = 2;
    ctx.strokeStyle = light ? '#ffffff' : '#0f1115';
    if(n.kind === 'topic'){ ctx.save(); ctx.translate(n.px, n.py); ctx.rotate(Math.PI/4);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent');
      ctx.fillRect(-r, -r, r*2, r*2); ctx.strokeRect(-r, -r, r*2, r*2); ctx.restore(); }
    else { ctx.beginPath(); ctx.arc(n.px, n.py, r, 0, 7);
      ctx.fillStyle = n.kind === 'note' ? pcolor(n.topic)
        : (n.kind === 'entity' && n.line ? (LINE_COLORS[n.line]||'#6a7686') : (light ? '#6a7686' : '#5f6a7d'));
      ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = light ? '#1c2330' : '#dde3ea';
    ctx.textAlign = 'center';
    ctx.fillText(n.title.slice(0, n.kind==='note'?16:12), n.px, n.py - r - 6);
    ctx.globalAlpha = 1;
  });
  cv.onmousemove = ev => {
    const r = cv.getBoundingClientRect();
    const x = (ev.clientX-r.left)*(W/r.width), y = (ev.clientY-r.top)*(H/r.height);
    let best = null, bd = 1e9;
    nodes.forEach((n, i) => { const d = (n.px-x)**2 + (n.py-y)**2;
      if(d < bd){ bd = d; best = i; } });
    drawGraph(bd < 900 ? best : null);
  };
  cv.onmouseleave = () => drawGraph(null);
  cv.onclick = ev => {
    const r = cv.getBoundingClientRect();
    const x = (ev.clientX-r.left)*(W/r.width), y = (ev.clientY-r.top)*(H/r.height);
    let best = null, bd = 1e9;
    nodes.forEach((n, i) => { const d = (n.px-x)**2 + (n.py-y)**2; if(d < bd){ bd = d; best = i; } });
    if(bd > 900) return;
    const n = nodes[best];
    if(n.kind === 'note') openNote(n.id);
    else if(n.kind === 'entity') openEntity(n.title);
    else if(n.kind === 'topic'){
      /* R30#2：テーマキーを platform フィルタに入れると必ず 0 件になる。
         プラットフォーム（youtube 等）のときだけ動画データを絞り込み、
         それ以外のテーマはテーマ画面を開く。 */
      if((DATA.stats.platforms||[]).indexOf(n.topic) >= 0){
        state.vp = n.topic; state.vscope = ''; switchTab('videos'); renderVideoFacets(); renderVideos();
      } else {
        state.boardTopic = n.topic; state.boardLine = ''; switchTab('boards'); renderBoards();
      }
    }
    else if(n.kind === 'hotword' && entityRegistered(n.title)) openEntity(n.title);
    else { state.q = n.title; $('#q').value = state.q; switchTab('videos'); renderVideos(); }
  };
}
function graphToggle(setOpen){
  const cv = $('#graph-canvas'); const btn = $('#graph-toggle');
  const open = setOpen != null ? setOpen : cv.style.display === 'none';
  cv.style.display = open ? 'block' : 'none';
  window.lsSet('kb_graph_open', open ? '1' : '0');
  syncGraphToggleLabel();
  if(open) drawGraph(null);
}
/* R32#A：開閉ボタンのラベルは canvas の実際の状態から必ず作る。
   マークアップ側は data-i18n="g_open" 固定なので applyI18N が走るたびに
   「開く」へ戻る。呼ぶべき場所が 3 つ（graphToggle / renderHub / 起動直後）
   あるので、式を 1 か所にまとめて取りこぼしを防ぐ。 */
function syncGraphToggleLabel(){
  const cv = $('#graph-canvas'), btn = $('#graph-toggle');
  if(!cv || !btn) return;
  btn.textContent = KT(cv.style.display === 'none' ? 'g_open' : 'g_close');
}
function renderHub(){
  const wh = Object.entries(DATA.watchlist).filter(([,ids])=>ids.length)
    .map(([k,ids]) => [k, ids.length]).sort((a,b)=>b[1]-a[1]);
  $('#hub-list').innerHTML = wh.map(([k,n]) =>
    '<div class="hubitem" data-kw="'+esc(k)+'"><span>'+esc(k)+'</span><span class="chip">'+esc(KT('unit_notes',{n}))+'</span></div>').join('')
    || '<p class="muted">—</p>';
  $('#hub-list').querySelectorAll('[data-kw]').forEach(el => el.onclick = () => {
    state.q = el.dataset.kw; $('#q').value = state.q; switchTab('videos'); });
  /* R1: モード切替ボタンのラベルは JS が上書きするため、data-i18n だけでは追随しない。
     切替時と描画時の両方で KT() を通す。 */
  const modeLabel = () => KT(state.graphMode === 'entity' ? 'g_to_note' : 'g_to_entity');
  /* R20-B2：開閉ボタンのラベルを状態に追随させる。
     マークアップ側は data-i18n="g_open" 固定なので applyI18N が毎回
     「開く」に戻してしまい、既定で開くようにしたあと
     「開いているのに『関連図を開く』と書いてある」状態になっていた
     （モード切替ボタンで R1 に直したのと同じ性質）。
     renderHub は言語切替でも render() 経由で applyI18N の後に走るため、
     ここで貼り直せば両方の経路で正しくなる。 */
  syncGraphToggleLabel();                  /* R32#A：式は 1 か所にまとめた */
  $('#graph-toggle').onclick = () => graphToggle();
  $('#graph-mode').onclick = () => {
    state.graphMode = state.graphMode === 'entity' ? 'notes' : 'entity';
    $('#graph-mode').textContent = modeLabel();
    G = null;
    if($('#graph-canvas').style.display !== 'none') drawGraph(null);
  };
  /* R26①：公開ナレッジに登場するエンティティが 1 つも無いときは、
     エンティティ図が空になるのでナレッジ図を既定にし、切替ボタンも出さない
     （押せるのに中身が無いボタンを残さない）。
     モードを変えたら G を捨てて描き直す。 */
  {
    const entOK = graphEntitySet();
    const hasEnt = ((DATA.entity_graph && DATA.entity_graph.nodes) || []).some(n => entOK.has(n.name));
    const mBtn = $('#graph-mode');
    if(mBtn) mBtn.hidden = !hasEnt;
    if(!hasEnt && state.graphMode === 'entity'){
      state.graphMode = 'notes';
      G = null;
      if($('#graph-canvas').style.display !== 'none') drawGraph(null);
    }
  }
  $('#graph-mode').textContent = modeLabel();
}

/* ---------- 框架 ---------- */
/* ============================================================================
   R8: ホームへ戻る。ヘッダーのロゴから呼ぶ。

   単に switchTab('overview') するだけでは不十分で、
   検索語・事業ライン絞り込み・選択中のナレッジ・エンティティ集約ビュー・
   実験詳細などが残ったままだと「トップに戻った」状態にならない。
   初期状態を構成する state をまとめて畳む。

   ページ全体の再読み込みはしない（kb-data.json 1.2MB の再取得を避ける）。
   ============================================================================ */
function goHome(){
  /* 絞り込み・検索 */
  state.q = ''; state.topic = ''; state.tag = ''; state.fresh = ''; state.line = '';
  state.noteState = '';                     /* R34 */
  const q = $('#q');
  if(q) q.value = '';
  updateQCount('');
  /* 選択・詳細ビュー */
  state.sel = null;
  state.entity = null; state.entityFrom = '';
  /* R15：検索結果ビューの状態も初期化する。ここを忘れると、検索中にロゴを押したとき
     語は消えるのに戻り先だけが残り、次の検索の解除で意図しないタブへ飛ぶ。 */
  state.searchFrom = ''; state.srFull = {};
  state.boardTopic = ''; state.boardLine = '';
  state.labExp = null;
  state.conclFull = false;
  state.noteView = 'list';
  /* 動画データのフィルタも初期値へ */
  state.vp = ''; state.vc = ''; state.vcat = ''; state.vdur = ''; state.vviews = '';
  state.vscope = 'video'; state.vout = false;
  state.sort = {key:'views_num', dir:-1};
  /* 詳細ペインを空に戻す（次に開いたとき前の内容が残らないように） */
  const nd = $('#note-detail');
  if(nd){ nd.innerHTML = notePickHTML(); bindNotePick(nd); }
  /* ハッシュを消してから既定セクション・既定タブへ */
  if(location.hash) history.replaceState(null, '', location.pathname + location.search);
  switchSection('intel');
  switchTab('overview');
  window.scrollTo({top:0, behavior:'smooth'});
}

/* R1: ヘッダーは「最終更新日」だけを出す。
   従来の「調査ウィンドウ経過日数」「公開ミラー・件数」は内部運用指標のため撤去し、
   件数はヒーローの指標ブロック（renderHero）へ移した。 */
function renderHeader(){
  const el = $('#st-updated');
  if(el) el.textContent = KT('updated', {d: buildDate()});
  const fu = document.getElementById('foot-updated');
  if(fu) fu.textContent = KT('updated', {d: buildDate()});
  const fr = document.getElementById('foot-rights');
  if(fr) fr.textContent = KT('f_rights', {y: (DATA.built_at || '').slice(0,4) || new Date().getFullYear()});
}
const buildDate = () => (DATA.built_at || '').slice(0,10) || '—';

/* R1: ヒーロー。公開ナレッジハブの定石に合わせ「1 画面目で何者かを言い切る」層を新設。
   このページ唯一の h1 を持ち（従来ホームに h1 が 0 個だった）、指標 3 点と単一の主 CTA を置く。
   UI 言語とナレッジ本文の言語が異なる場合は .lang-note で明示する（本文の言語を偽装しない）。 */
function renderHero(){
  const s = DATA.stats;
/* R12：遮断済みナレッジを数に含めない（一覧の行数と一致させる） */
  const claims = (DATA.conclusions || []).filter(c => c.kind === 'claim' && noteById(c.note_id)).length;
  const exps = pubNotes().filter(n => n.type === 'experiment').length;
  const noteCnt = pubNotes().length;
  const stat = (v, k) => '<div class="hero-stat"><div class="hv">'+v+'</div><div class="hk">'+esc(k)+'</div></div>';
  /* R5: 2 カラム化。計測したところヒーローは幅 1352px に対して本文列が 543px しか
     使っておらず、右 60% が死んだ余白で、しかも縦は 1 画面の 81% を占めていた。
     Artificial Analysis が右カラムに UPDATE / LAUNCH を積んでいるのと同じ考え方で、
     直下にあった「今週の注目シグナル」パネルをここへ引き上げる。
     効果：死んだ余白が埋まる／最新の内容が 1 画面目に入る／ページ全体が短くなる。 */
  return '<div class="hero">'
    + '<div class="hero-grid">'
    + '<div class="hero-main">'
    +   '<div class="hero-badge">'+esc(KT('hero_badge'))+'</div>'
    +   '<h1>'+esc(KT('hero_h1'))+'</h1>'
    +   '<p class="hero-lead">'+esc(KT('hero_lead'))+'</p>'
    +   '<div class="hero-stats">'
    +     stat(noteCnt, KT('st_notes')) + stat(claims, KT('st_concl')) + stat(exps, KT('st_exp'))
    +   '</div>'
    +   '<div class="hero-cta">'
    +     '<a class="btn-primary" href="mailto:info@onewonder.co.jp" rel="noopener noreferrer">'+esc(KT('cta_contact'))+'</a>'
    +     '<a class="btn-ghost" href="#about" id="hero-method">'+esc(KT('cta_method'))+'</a>'
    +   '</div>'
    /* R26②：脚注に「出典リンクつき N 件」を実数で出す。
       実測（R23〜R25）：公開ナレッジのうち出典を持つのは一部だけなのに、
       従来の文言は「全結論に出典リンクあり」と断定していた。
       数え方は公開対象（pubNotes）のうち sources が 1 件以上あるもの。
       遮断ルールを変えれば自動で追随する。 */
    +   '<p class="hero-foot">'+esc(KT('hero_foot', {d: buildDate(),
          s: pubNotes().filter(n => (n.sources||[]).length > 0).length}))+'</p>'
    /* R14：言語注記はヒーローから外した。
       主張（h1・リード・KPI・CTA）の直後に「本文は中国語です」という
       お断りが入り、ファーストビューが断り書きで終わっていた。
       注記そのものは必要なので、本文に触れる直前＝ナレッジ一覧の上部へ移した
       （renderNoteList）。R14 でも本文の言語を偽装しない方針は変えていない。 */
    + '</div>'
    + renderHeroSide()
    + '</div></div>';
}

/* R5: ヒーロー右カラム。罫線で区切ったリスト形式（参照サイトの作法）。
   シグナルが 1 件も推せないときはカラムごと出さない（空の枠は対外的にマイナス）。 */
function renderHeroSide(){
  const sigs = deriveSignals();
  if(!sigs.length) return '';
  const addedIds = new Set(((DATA.today || {}).added || []).map(x => x.id));
  /* R14：要約本文を出さないようにした。
     本文は執筆言語（現状おもに中国語）のままなので、日本語で読みに来た人の
     ファーストビューに読めない長文が 3 件密集する形になっていた。
     題名だけでも「何が動いたか」は伝わるので、代わりにテーマと更新日を添える。
     本文の日本語化が済んだ段階で side-desc を戻すのが本来の姿。 */
  const item = n => '<a class="side-item" href="#" data-note="'+esc(n.id)+'">'
    + '<span class="side-tag">'+esc(KT(addedIds.has(n.id) ? 'sig_new' : 'sig_kw'))+'</span>'
    + '<span class="side-title">'+esc(n.title)+'</span>'
    + '<span class="side-meta">'+esc(topicName(n.topic) || '')
    +   (n.updated ? ' ・ ' + esc(n.updated) : '')+'</span>'
    + '</a>';
  return '<aside class="hero-side">'
    + '<div class="side-head">'+esc(KT('p_signals', {n: sigs.length}))+'</div>'
    + sigs.map(item).join('')
    + '</aside>';
}
/* BUGFIX(R9-b1)：aria-selected は switchTab の中でしか設定していなかったが、
   初回描画は state.tab='overview' のまま render() を直接呼ぶ経路なので
   switchTab を通らず、**5 つのタブすべてで aria-selected が欠落**していた。
   role="tab" に aria-selected が無いのは ARIA として不正で、
   スクリーンリーダーがどのタブが選択中かを伝えられない。
   同期処理を関数に切り出し、初期化時にも呼ぶ。 */
function syncTabAria(){
  const btns = Array.from(document.querySelectorAll('nav button[data-tab]'));
  /* R15-b1：state.tab がナビに無いビュー（entity / search）のとき、
     どのボタンも一致しないので全部 tabindex="-1" になり、
     ロービング tabindex の原則に反してタブ列へキーボードで入れなくなっていた
     （entity では以前から起きていた穴で、search を追加して顕在化した）。
     一致が無い場合は先頭を 0 にして入口を必ず 1 つ残す。 */
  const anyOn = btns.some(b => b.dataset.tab === state.tab);
  btns.forEach((b, i) => {
    const on = b.dataset.tab === state.tab;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
    b.setAttribute('tabindex', (anyOn ? on : i === 0) ? '0' : '-1');
  });
}
/* R13-b1：タブを切り替えてもスクロール位置がそのまま残っていた。
   「テーマ別の動き」の行や事業ラインのタイルはページの下の方にあるため、
   そこをクリックすると深い位置のままテーマ詳細に切り替わり、
   しかも詳細ページは概要より短いので着地点が最下部になっていた
   （実測：795px のまま切替 → ページ高 3007px から 1862px に縮み、下に 167px しか残らない）。
   ヘッダーのタブ切替では 845px → 6553px（完全に最下部）まで飛んでいた。

   これまで scrollTo は openNote / openEntity / テーマカードなど**呼び出し側で個別に**
   書いていたため、書き忘れた経路（テーマ別の動き・事業ラインタイル・
   グラフのノード・ウォッチリスト → 動画データ）が取りこぼされていた。
   switchTab 側で面倒を見れば構造的に漏れない。

   changed を見るのが要点：同じタブへの再描画（検索文字を足したときなど）では
   戻さないので、読んでいる位置を保てる。 */
/* ==== R21-1：いま見ている画面を URL に載せる ====
   実測（R20 検査）：会社情報（#about）と実験（#lab/experiment/<id>）だけが
   URL に出て、タブ・ナレッジ・テーマ・検索は URL が空のままだった。
   さらに history.length が一切増えないため、深く潜ってから「戻る」を押すと
   サイト内に戻らずサイトを出てしまっていた（スマホでは戻るが主要操作）。
   `#note/<id>` は受け入れ側も存在しなかった（R20 の私の判定は誤り。
   ハッシュだけの遷移では再読み込みが起きず、前の state が残っていたのを
   「動いている」と読み違えた）。

   方針：状態 → ハッシュの計算を hashForState() の 1 か所に集め、
   書き込みは syncHash() だけが行う。pushState / replaceState を使うので
   自分の書き込みで hashchange が再入することはない。
   逆向き（ハッシュ → 状態）は applyRoute() が _routing フラグを立てて行い、
   その間 syncHash() は何もしない。 */
let _routing = false;

function hashForState(){
  if(state.section === 'about') return 'about';
  if(state.section === 'lab')   return state.labExp ? 'lab/experiment/' + state.labExp : 'lab';
  /* 以下は intel */
  if(state.tab === 'entity') return state.entity != null ? 'entity/' + encodeURIComponent(String(state.entity)) : '';
  if(state.tab === 'search') return state.q ? 'search/' + encodeURIComponent(state.q) : '';
  if(state.tab === 'notes')  return state.sel ? 'note/' + encodeURIComponent(state.sel) : 'notes';
  if(state.tab === 'boards') return state.boardTopic ? 'board/' + encodeURIComponent(state.boardTopic) : 'boards';
  if(state.tab === 'videos') return 'videos';
  if(state.tab === 'graph')  return 'graph';
  return '';                 /* 概要は素の URL（共有したときに余計な #overview を付けない） */
}

function syncHash(push){
  if(_routing) return;                       /* ハッシュから復元中は書かない */
  const want = hashForState();
  const now  = location.hash.replace(/^#/, '');
  if(now === want) return;
  const url = location.pathname + location.search + (want ? '#' + want : '');
  try {
    if(push) history.pushState(null, '', url);
    else     history.replaceState(null, '', url);
  } catch(e){ /* file:// など pushState が使えない環境では URL 同期を諦める */ }
}

function switchTab(tab){
  const changed = state.tab !== tab;
  if(tab !== 'entity') leaveEntityHash();
  state.tab = tab;
  syncTabAria();
  document.querySelectorAll('main section').forEach(s => s.classList.toggle('on', s.id==='view-'+tab));
  render();
  /* R21-1：タブが同じでも中身（選択中のナレッジ・テーマ・検索語）が変われば
     URL は変わるので、changed に関係なく同期する。 */
  syncHash(true);
  /* R16：ビューが変わったら <title> も追随させる */
  if(changed){ syncDocMeta(); window.scrollTo({top:0}); }
}
document.querySelectorAll('nav button').forEach(b => b.setAttribute('role','tab'));
document.querySelectorAll('main section').forEach(s => s.setAttribute('role','tabpanel'));
function render(){
  renderHeader();
  if(state.tab==='overview') renderOverview();
  else if(state.tab==='boards') renderBoards();
  /* R14-b4：未選択のときは renderDetail を呼ばず、マークアップに書いてある
     静的なプレースホルダがそのまま残る作りだった。そのため R14 で追加した
     「最近更新されたナレッジ 3 件」が、ロゴでホームに戻った経路でしか出ず、
     初回にナレッジタブへ来たときは 1 行だけという食い違いが起きていた。
     renderDetail は !n の場合を自分で処理するので、常に呼んでよい。 */
  else if(state.tab==='notes'){ renderNoteList(); renderDetail(); }
  else if(state.tab==='entity') renderEntityView();
  else if(state.tab==='search') renderSearchView();
  else if(state.tab==='videos'){ renderVideoFacets(); renderVideos();
    chartHist($('#c-hist')); chartCats($('#c-cats')); chartMonths($('#c-mon')); chartTop15($('#c-top')); }
  else { renderHub(); }
}
document.querySelectorAll('nav button').forEach(b => b.onclick = () => switchTab(b.dataset.tab));
let _qTimer = null;
/* R15：検索語が入ったら検索結果ビューへ、消したら元のタブへ戻す。
   従来は「今開いているタブを再描画する」だけだったので、概要・テーマ・関連分析では
   件数が出るのに画面が一切変わらなかった。 */
function applyQuery(val){
  const had = !!state.q;
  state.q = val;
  if(state.section && state.section !== 'intel') switchSection('intel');
  if(val){
    /* 検索を始めたタブを覚えておく（解除で戻る先）。
       検索中に語を足しただけのときは上書きしない。 */
    if(!had && state.tab !== 'search') state.searchFrom = state.tab;
    state.srFull = {};              /* 語が変われば展開状態はリセット */
    /* 語が変わったら結果の先頭から読ませる。switchTab は同じタブへの
       切替では何もしないので、結果ビュー内での絞り込み直しは明示的に戻す。
       これを入れないと「新しい結果の途中」に着地し、
       しかも着地点が結果の件数（＝ページの長さ）で変わって予測できない。 */
    if(state.tab !== 'search') switchTab('search');
    else { render(); window.scrollTo({top:0}); }
  } else {
    const back = state.searchFrom && state.searchFrom !== 'search' ? state.searchFrom : 'overview';
    state.searchFrom = '';
    state.srFull = {};
    if(state.tab === 'search') switchTab(back);
    else if(state.tab === 'entity') switchTab('notes');
    else render();
  }
  /* R21-1：検索語を URL に載せる。switchTab を通らない経路
     （検索中に語を足しただけ）でも同期が必要。 */
  syncHash(true);
  updateQCount(val);
}
$('#q').addEventListener('input', e => {
  const val = e.target.value.trim();
  clearTimeout(_qTimer);
  _qTimer = setTimeout(() => applyQuery(val), 180);
});
/* R15：Enter を押しても何も起きなかった（デバウンス待ちだけ）。
   待たずに即確定させ、検索欄からフォーカスを外して結果を読みやすくする。 */
$('#q').addEventListener('keydown', e => {
  if(e.key !== 'Enter') return;
  e.preventDefault();
  clearTimeout(_qTimer);
  applyQuery(e.target.value.trim());
  e.target.blur();
});
function updateQCount(q){
  const el = $('#q-count');
  if(!el) return;
  if(!q){ el.style.display = 'none'; el.textContent = ''; syncQHint(); return; }
  const ql = q.toLowerCase();
/* R12-b1：件数の集計に遮断判定が入っておらず、非公開分まで数えていた
     （一覧の行数と数字が食い違う）。isPublishable を通す。 */
  /* R20-B1：ここは検索結果ビューとは別に自前の当たり判定を持っていたため、
     表示名を干し草に足した R20-B1 の効果がヘッダーの件数には出ておらず、
     「件数は 0 なのに結果は出る」という食い違いになっていた（R12-b1 で
     遮断判定を入れ忘れていたのと同じ構図）。判定を共通関数に寄せる。 */
  const toks = qTokens(ql);                                   /* R21-2 */
  const notes = pubNotes().filter(n => hayHit(noteHay(n), toks)).length;
  /* R24：ラベルを「動画データ」に揃えたので、数える母数も検索結果ビューと
     同じ VIDEOS（platform 付きで analysis 以外）にする。
     DATA.entries を数えると analysis 分だけ多くなり、見出しと合わなくなる。 */
  const ents = VIDEOS.filter(e => hayHit(videoHay(e), toks)).length;
  /* R24：「結論」は claim（=ヒーローの 317 件と同じ母数）だけを数える。
     point は「本文中の記述」として検索結果ビューに別グループで出す。 */
  const concls = (DATA.conclusions||[]).filter(c =>
    noteById(c.note_id) && c.kind === 'claim' && hayHit(conclHay(c), toks)).length;
  el.style.display = '';
  /* R12-b1：この文言は R1 から search_hit として 7 言語ぶん用意されていたのに
     結線されておらず、R11 で同じ用途の q_counts を新設して二重になっていた。
     既存キーに寄せて q_counts は削除した（用語も「記録」に統一）。 */
  el.textContent = KT('search_hit',{a:notes, b:ents, c:concls});
  syncQHint();                               /* R21-4 */
}
function syncThemeIcon(){
  $('#ic-sun').style.display = isLight() ? 'none' : 'block';
  $('#ic-moon').style.display = isLight() ? 'block' : 'none';
}
/* R21-3：印刷ボタン。beforeprint で light に切り替える処理（R19）は
   window.print() でも発火するので、ここでは呼ぶだけでよい。 */
{ const pb = $('#print-btn'); if(pb) pb.onclick = () => window.print(); }

/* R21-4：スキップリンクは URL にハッシュを残さない。
   実測：素の `href="#main-content"` だと location.hash が `#main-content` に
   なり、いま見ている画面を指す共有 URL（#note/<id> など）が上書きされてしまう。
   href は JS 無効でも本文へ飛べるように残し、通常クリック（Tab → Enter）では
   preventDefault してフォーカスだけ移す。 */
{ const sk = document.querySelector('.skip-link');
  if(sk) sk.addEventListener('click', ev => {
    const m = document.getElementById('main-content');
    if(!m) return;
    if(ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    ev.preventDefault();
    m.focus();
    window.scrollTo({top:0});
  });
}

/* ==== R21-1：「リンクをコピー」====
   navigator.clipboard は https か localhost でしか使えず、権限拒否もありうる。
   使えないときは URL を選択状態にして「手で控えてください」に落とす
   （黙って何も起きないのが最悪なので、必ず結果を文字で出す）。
   ボタンは renderDetail が innerHTML ごと作り直すので、
   document 単位の委譲で受ける（毎回 onclick を張り直さない）。 */
function copyCurrentLink(msgEl){
  const url = location.href;
  const done = ok => { if(!msgEl) return;
    msgEl.textContent = KT(ok ? 'copy_done' : 'copy_fail');
    setTimeout(() => { if(msgEl) msgEl.textContent = ''; }, 2600); };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(url).then(() => done(true), () => fallback());
  } else fallback();
  function fallback(){
    try {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand && document.execCommand('copy');
      ta.remove();
      done(!!ok);
    } catch(e){ done(false); }
  }
}
document.addEventListener('click', ev => {
  const b = ev.target && ev.target.closest && ev.target.closest('#copy-link');
  if(!b) return;
  ev.preventDefault();
  copyCurrentLink(document.getElementById('copy-link-msg'));
});

/* R21-4：検索語が入っているときは件数を出し、空のときは「/」の案内を出す。
   同じ場所を使うので、両方が並んでヘッダーが 1 行増えるのを避ける。 */
function syncQHint(){
  const hint = $('#q-hint'); if(!hint) return;
  hint.style.display = state.q ? 'none' : '';
}

$('#theme-btn').onclick = () => {
  const next = isLight() ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  window.lsSet('kb_theme', next);
  syncThemeIcon(); startBG(); if($('#graph-canvas').style.display !== 'none') drawGraph(null);
  /* R11-b5: プラットフォーム色や章の文字色は描画時にインラインへ焼き込まれるため、
     テーマだけ切り替えても更新されず前のテーマの色が残っていた。
     従来は overview だけ再描画していたので、現在のビュー全体を描き直す。 */
  render();
};
syncThemeIcon();

/* ==== R19：印刷の直前だけライトテーマにする ====
   グラフの線色・プラットフォーム色・章の文字色は描画時にインラインへ焼き込まれる
   （R11-b5 と同じ性質）ため、@media print の palette 上書きだけでは
   ダークテーマの明るい線が白紙に残ってしまう。テーマ切り替えと同じ手順
   （dataset.theme → render()）を印刷の前後で行う。
   localStorage は書き換えない：印刷のために利用者の選択を上書きしない。 */
let _printPrevTheme = null;
function kbBeforePrint(){
  if(_printPrevTheme !== null) return;      /* 二重発火の保険 */
  _printPrevTheme = document.documentElement.dataset.theme || 'light';
  if(_printPrevTheme !== 'dark') return;    /* もともとライトなら何もしない */
  document.documentElement.dataset.theme = 'light';
  syncThemeIcon();
  try {
    render();
    if($('#graph-canvas') && $('#graph-canvas').style.display !== 'none') drawGraph(null);
  } catch(e){}
}
function kbAfterPrint(){
  if(_printPrevTheme === null) return;
  const prev = _printPrevTheme;
  _printPrevTheme = null;
  if(prev !== 'dark') return;
  document.documentElement.dataset.theme = prev;
  syncThemeIcon();
  try {
    render(); startBG();
    if($('#graph-canvas') && $('#graph-canvas').style.display !== 'none') drawGraph(null);
  } catch(e){}
}
window.addEventListener('beforeprint', kbBeforePrint);
window.addEventListener('afterprint', kbAfterPrint);
/* beforeprint を出さない版の Safari 向けに matchMedia('print') でも拾う */
if(window.matchMedia){
  const _mqPrint = window.matchMedia('print');
  const _onMQPrint = m => { if(m.matches) kbBeforePrint(); else kbAfterPrint(); };
  if(_mqPrint.addEventListener) _mqPrint.addEventListener('change', _onMQPrint);
  else if(_mqPrint.addListener) _mqPrint.addListener(_onMQPrint);
}

/* ---- tooltip（chart 悬停）与 `/` 聚焦搜索 ---- */
document.addEventListener('mousemove', e => {
  const t = e.target && e.target.closest && e.target.closest('[data-tip]');
  const tip = $('#tip');
  if(t){ tip.style.display='block'; tip.textContent = t.dataset.tip;
    tip.style.left = Math.min(e.clientX+12, window.innerWidth-220)+'px'; tip.style.top = (e.clientY+12)+'px'; }
  else tip.style.display='none';
});
document.addEventListener('keydown', e => {
  if(e.key==='/' && document.activeElement.tagName!=='INPUT'){ e.preventDefault(); $('#q').focus(); }
});

/* ---- T-14b 笔记悬停预览：笔记列表条目 / 反链条目 / 结论卡片，悬停 300ms 出预览卡
   （标题 + 类型徽标 + 更新日期 + summary 前 140 字，全部经 esc 转义，不注入 HTML）。
   无 hover 设备（触屏）不挂载预览层；pointer-events:none 不遮挡点击；
   贴视口边缘自动翻到光标另一侧；点击 / 滚动 / 移出即消失。 ---- */
if(matchMedia('(hover: hover)').matches){
  const pv = document.createElement('div');
  pv.id = 'note-preview';
  pv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(pv);
  let pvTimer = null, pvSrc = null;
  const pvHide = () => { clearTimeout(pvTimer); pvTimer = null; pvSrc = null; pv.style.display = 'none'; };
  const pvShow = (el, x, y) => {
    const n = noteById(el.dataset.note);
    if(!n){ pvHide(); return; }
    const sum = String(n.summary || '');
    pv.innerHTML = '<div class="np-title">'+esc(n.title)+'</div>'
      + '<div class="np-badges"><span class="tagchip" style="cursor:default">'+esc(noteType(n.type) || '—')+'</span>'
      + '<span class="np-date">'+esc(KT('np_updated'))+' '+esc(n.updated||'—')+'</span></div>'
      + '<div class="np-summary">'+esc(sum.slice(0, 140))+(sum.length > 140 ? '…' : '')+'</div>';
    pv.style.display = 'block';
    const r = pv.getBoundingClientRect();
    let left = x + 14, top = y + 14;
    if(left + r.width > window.innerWidth - 8) left = x - r.width - 14;
    if(top + r.height > window.innerHeight - 8) top = y - r.height - 14;
    pv.style.left = Math.max(8, left) + 'px';
    pv.style.top = Math.max(8, top) + 'px';
  };
  const pvHit = t => {
    const el = t && t.closest ? t.closest('[data-note]') : null;
    if(!el) return null;
    if(el.classList.contains('ccard')) return el;                       /* 结论卡片 */
    if(el.classList.contains('item') && el.closest('.list')) return el; /* 笔记列表条目 */
    if(el.tagName === 'A' && el.closest('#note-detail')) return el;     /* 反链条目 */
    return null;
  };
  document.addEventListener('mouseover', e => {
    const el = pvHit(e.target);
    if(!el){ if(pvSrc || pv.style.display === 'block') pvHide(); return; }
    if(el === pvSrc) return;
    clearTimeout(pvTimer);
    pvSrc = el;
    const x = e.clientX, y = e.clientY;
    pvTimer = setTimeout(() => pvShow(el, x, y), 300);
  });
  document.addEventListener('mouseout', e => {
    const el = pvHit(e.target);
    if(el && e.relatedTarget && el.contains(e.relatedTarget)) return; /* 同一条目内部移动不清 */
    pvHide();
  });
  document.addEventListener('click', pvHide);
  addEventListener('scroll', pvHide, {passive: true});
}

/* ---- 特效引擎：入场 / 背景粒子 ---- */
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
function particles(cv, n, linkDist, speed, mouse){
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = cv.clientWidth || innerWidth, h = cv.clientHeight || innerHeight;
  cv.width = w * dpr; cv.height = h * dpr;
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const pc = getComputedStyle(document.documentElement).getPropertyValue('--particle');
  const pts = Array.from({length:n}, () => ({
    x: Math.random() * w, y: Math.random() * h,
    vx: (Math.random() - .5) * speed, vy: (Math.random() - .5) * speed
  }));
  const m = {x: -1e4, y: -1e4};
  if(mouse){
    addEventListener('mousemove', e => { m.x = e.clientX; m.y = e.clientY; });
    addEventListener('mouseleave', () => { m.x = -1e4; m.y = -1e4; });
  }
  let run = true;
  (function frame(){
    if(!run) return;
    ctx.clearRect(0, 0, w, h);
    for(const p of pts){
      p.x += p.vx; p.y += p.vy;
      if(p.x < 0 || p.x > w) p.vx *= -1;
      if(p.y < 0 || p.y > h) p.vy *= -1;
      if(mouse){
        const dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy);
        if(d < 130 && d > .1){ p.x += dx / d * 1.4; p.y += dy / d * 1.4; }
      }
    }
    ctx.lineWidth = 1;
    for(let i = 0; i < pts.length; i++) for(let j = i + 1; j < pts.length; j++){
      const a = pts[i], b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
      if(d < linkDist){
        ctx.strokeStyle = 'rgba('+pc+','+(0.4 * (1 - d / linkDist)).toFixed(3) + ')';
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    for(const p of pts){
      ctx.fillStyle = 'rgba('+pc+',.65)';
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.7, 0, 7); ctx.fill();
    }
    requestAnimationFrame(frame);
  })();
  return () => { run = false; };
}
/* ---- v3 入口：3D 知识星球（自研 canvas 3D 投影，无外部依赖） ---- */
let introStop = null;
function mountIntro(){
  if(document.getElementById('intro')) return;
  const el = document.createElement('div');
  el.id = 'intro';
  /* R30#10：全画面を覆う要素なのに role も aria-modal も無く、支援技術には
     ただの div として読まれていた。閉じる操作（Esc / Enter / クリック）は
     この関数の下にすでにある。 */
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  /* R30#3：stats.topics は遮断を知らないので 20 のままだった。
     公開ナレッジを持つテーマだけ数える（テーマ画面・概要と同じ 10 になる）。 */
  const topicN = new Set(pubNotes().map(n => n.topic)).size;
  /* R6: 文言は KB_I18N_INTRO（全 7 言語）から取得する。
     従来（R1〜R5）は ja / en / zh だけをこの関数内にハードコードしており、
     ko / es / fr を選ぶと日本語のカタカナ「ナレッジハブ」がそのまま出ていた（不具合）。
     --n（文字数）を CSS へ渡し、語が長い言語でも 1 行に収まるようにする。 */
  const dict = window.KB_I18N[window.KB_LANG] || window.KB_I18N.ja;
  const chars = dict.intro_title || window.KB_I18N.ja.intro_title;
  /* R12：オープニングの件数もヒーローと同じ集計にそろえる */
  const claims = (DATA.conclusions||[]).filter(c => c.kind === 'claim' && noteById(c.note_id)).length;
  const sub = KT('intro_sub', {n: pubNotes().length, t: topicN, c: claims});
  /* 語中の空白（韓国語「널리지 허브」など）は幅だけ確保する専用スパンにする。
     空の <span> は flex コンテナ内で潰れて語の区切りが消えてしまうため。 */
  const charSpan = (c, i) => c === ' '
    ? '<span class="intro-sp" aria-hidden="true"></span>'
    : '<span style="--d:'+i+'">'+esc(c)+'</span>';
  el.innerHTML = '<canvas id="intro-canvas"></canvas><div class="intro-inner">'
    + '<div class="intro-badge">KNOWLEDGE HUB</div>'
    + '<h2 class="intro-title" style="--n:'+chars.length+'">'
    +   chars.map(charSpan).join('') + '</h2>'
    + '<p class="intro-sub">' + esc(sub) + '</p>'
    + '<button id="intro-enter" type="button">' + esc(KT('intro_enter')) + '</button>'
    + '<div class="intro-hint">' + esc(KT('intro_hint')) + '</div></div>';
  /* R30#10：読み上げ用の名前は本文と同じ文言から作る（新しい訳を増やさない）。 */
  el.setAttribute('aria-label',
    [].concat(dict.intro_title || []).join('') + ' — ' + sub);
  document.body.prepend(el);
  introStop = startSphere(el.querySelector('#intro-canvas'), el);
  const dismiss = () => {
    if(el.classList.contains('gone')) return;
    el.classList.add('gone');
    setTimeout(() => { if(introStop){ introStop(); introStop = null; } el.remove(); }, 600);
  };
  el.addEventListener('click', e => {
    if(e.target.id === 'intro-enter'){ dismiss(); return; }
    if((el._dragDist||0) < 8) dismiss();
  });
  addEventListener('keydown', function onk(e){
    if(!document.getElementById('intro')){ removeEventListener('keydown', onk); return; }
    if(e.key === 'Escape' || e.key === 'Enter') dismiss();
  });
}
function startSphere(cv, root){
  const ctx = cv.getContext('2d');
  let W = 0, H = 0;
  const fit = () => { const d = Math.min(devicePixelRatio || 1, 2);
    W = cv.clientWidth || innerWidth; H = cv.clientHeight || innerHeight;
    cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
  fit();
  const onResize = () => fit();
  addEventListener('resize', onResize);
  const stars = Array.from({length:120}, () => ({x: Math.random(), y: Math.random(),
    r: Math.random()*1.3 + .3, p: Math.random()*6.283, s: .4 + Math.random()*1.2}));
  const N = 240, pts = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for(let i = 0; i < N; i++){
    const y = 1 - (i/(N-1))*2, rr = Math.sqrt(Math.max(0, 1 - y*y)), th = ga * i;
    pts.push({x: Math.cos(th)*rr, y, z: Math.sin(th)*rr});
  }
  const edges = [];
  for(let i = 0; i < N; i++){
    let b1 = -1, d1 = 1e9, b2 = -1, d2 = 1e9;
    for(let j = 0; j < N; j++){ if(i === j) continue;
      const dx = pts[i].x-pts[j].x, dy = pts[i].y-pts[j].y, dz = pts[i].z-pts[j].z;
      const dd = dx*dx + dy*dy + dz*dz;
      if(dd < d1){ d2 = d1; b2 = b1; d1 = dd; b1 = j; } else if(dd < d2){ d2 = dd; b2 = j; } }
    if(b1 > i) edges.push([i, b1]);
    if(b2 > i) edges.push([i, b2]);
  }
  const ring = Array.from({length:72}, (_, i) => {
    const a = i/72*6.283, T = .45;
    const x = Math.cos(a)*1.34, z0 = Math.sin(a)*1.34;
    return {x, y: -z0*Math.sin(T), z: z0*Math.cos(T)};
  });
  const topics = Object.entries(DATA.stats.topics)
    .map(([t, c]) => ({name: topicName(t), count: c}))
    .sort((a, b) => b.count - a.count).slice(0, 12);
  const labAt = new Map();
  topics.forEach((tp, i) => labAt.set(Math.floor((i + .5) * N / topics.length), tp));
  let rotY = 0, rotX = -0.28, velY = 0.0038, drag = false, lx = 0, ly = 0;
  let parX = 0, parY = 0, tgtX = 0, tgtY = 0;
  root._dragDist = 0;
  const pd = e => { drag = true; lx = e.clientX; ly = e.clientY; };
  const pm = e => {
    if(drag){
      const dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      root._dragDist += Math.abs(dx) + Math.abs(dy);
      rotY += dx * .005; rotX += dy * .005;
      rotX = Math.max(-1.2, Math.min(1.2, rotX));
      velY = dx * .0006;
    } else {
      tgtY = (e.clientX / innerWidth - .5) * .5;
      tgtX = (e.clientY / innerHeight - .5) * .3;
    }
  };
  const pu = () => { drag = false; };
  cv.addEventListener('pointerdown', pd);
  addEventListener('pointermove', pm);
  addEventListener('pointerup', pu);
  let raf = 0;
  const t0 = performance.now();
  const frame = now => {
    const t = (now - t0) / 1000;
    if(!drag){ rotY += velY; velY += (0.0038 - velY) * .02; }
    parX += (tgtX - parX) * .04; parY += (tgtY - parY) * .04;
    const ry = rotY + parY, rx = rotX + parX;
    const cy_ = Math.cos(ry), sy_ = Math.sin(ry), cx_ = Math.cos(rx), sx_ = Math.sin(rx);
    const R = Math.min(W, H) * .33, f = R * 3.4, ox = W/2, oy = H/2;
    const proj = p => {
      const x1 = p.x*cy_ - p.z*sy_, z1 = p.x*sy_ + p.z*cy_;
      const y1 = p.y*cx_ - z1*sx_, z2 = p.y*sx_ + z1*cx_;
      const s = f / (f - z2*R*.92);
      return {x: ox + x1*R*s, y: oy + y1*R*s, s, z: z2};
    };
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createRadialGradient(ox, oy, 0, ox, oy, Math.max(W, H)*.7);
    bg.addColorStop(0, 'rgba(76,60,180,.16)');
    bg.addColorStop(.45, 'rgba(20,16,60,.10)');
    bg.addColorStop(1, 'rgba(5,7,15,0)');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    for(const st of stars){
      const a = .25 + .55*Math.abs(Math.sin(t*st.s + st.p));
      ctx.fillStyle = 'rgba(180,190,255,' + a.toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(st.x*W, st.y*H, st.r, 0, 7); ctx.fill();
    }
    const pulse = 1 + Math.sin(t*1.6)*.06;
    const core = ctx.createRadialGradient(ox, oy, 0, ox, oy, R*1.1*pulse);
    core.addColorStop(0, 'rgba(129,140,248,.30)');
    core.addColorStop(.5, 'rgba(99,102,241,.10)');
    core.addColorStop(1, 'rgba(99,102,241,0)');
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(ox, oy, R*1.1*pulse, 0, 7); ctx.fill();
    ctx.lineWidth = 1;
    for(let i = 0; i < ring.length; i++){
      const a2 = proj(ring[i]), b2 = proj(ring[(i+1)%ring.length]);
      const al = .10 + .10*((a2.z+1.4)/2.8);
      ctx.strokeStyle = 'rgba(148,163,255,' + al.toFixed(3) + ')';
      ctx.beginPath(); ctx.moveTo(a2.x, a2.y); ctx.lineTo(b2.x, b2.y); ctx.stroke();
    }
    const P = pts.map(proj);
    for(const [ai, bi] of edges){
      const a = P[ai], b = P[bi];
      const depth = (a.z + b.z)/2;
      const al = .05 + .22*((depth + 1)/2);
      ctx.strokeStyle = 'rgba(120,135,255,' + al.toFixed(3) + ')';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for(let i = 0; i < N; i++){
      const p = P[i];
      const depth = (p.z + 1)/2;
      const r = (0.8 + depth*1.9) * p.s * .9;
      const col = i % 3 === 0 ? '129,140,248' : i % 3 === 1 ? '34,211,238' : '244,114,182';
      ctx.fillStyle = 'rgba(' + col + ',' + (.25 + depth*.6).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill();
    }
    ctx.textAlign = 'left';
    for(const [i, tp] of labAt){
      const p = P[i];
      if(p.z < .05) continue;
      const depth = (p.z + 1)/2;
      const fs = 11 + depth*3;
      ctx.font = '600 ' + fs.toFixed(1) + 'px "Segoe UI","Microsoft YaHei",system-ui,sans-serif';
      ctx.strokeStyle = 'rgba(165,180,252,' + (.3 + depth*.5).toFixed(3) + ')';
      ctx.beginPath(); ctx.moveTo(p.x + 4, p.y - 4); ctx.lineTo(p.x + 14, p.y - 14); ctx.stroke();
      ctx.fillStyle = 'rgba(226,232,255,' + (.45 + depth*.55).toFixed(3) + ')';
      ctx.fillText(tp.name, p.x + 17, p.y - 17);
      ctx.font = '10px system-ui,sans-serif';
      ctx.fillStyle = 'rgba(140,150,200,' + (.35 + depth*.4).toFixed(3) + ')';
      ctx.fillText(KT('sp_count',{n:tp.count}), p.x + 17, p.y - 5);
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => { cancelAnimationFrame(raf);
    cv.removeEventListener('pointerdown', pd);
    removeEventListener('pointermove', pm);
    removeEventListener('pointerup', pu);
    removeEventListener('resize', onResize); };
}
/* R20-B3：ハッシュ付きで来たときはオープニング演出を出さない。
   実測（R20 擬似本番）：localStorage が空の初回訪問者が共有リンク
   #lab/experiment/<id> を開くと、#intro（z-index:99 / opacity:1）が
   目的の内容を覆い、画面中央は球体の canvas だった。演出を閉じれば
   正しい実験が開くので機能は壊れていないが、営業が客先に個別の実験を
   送ると、客先はまず演出を見てクリックしてから本題に着くことになる。
   ハッシュ付きの訪問は「その内容を見に来た」意思表示なので素通しする。
   kb_intro_seen も立てない（後でトップに来たとき 1 度だけ演出を見せる）。 */
const deepLinked = location.hash.length > 1;
if(!reduced && !deepLinked && !window.lsGet('kb_intro_seen', null)){
  mountIntro();
  window.lsSet('kb_intro_seen', '1');
}
const introBtn = $('#intro-btn');
if(introBtn) introBtn.onclick = () => mountIntro();
/* R20-B2：関連図を既定で開く。
   実測（R20 検査）：既定が折りたたみで、左カラム（説明＋ボタン）が 122px、
   右サイドバー（横断キーワード＋凡例）が 1346px だったため、関連分析タブの
   初回表示は約 1,200px の空白に見えていた。ボタンに気づかないと看板タブが
   白紙のまま終わる。drawGraph は canvas の width/height 属性（880x540）へ
   描くので、タブが表示される前に描いても寸法は崩れない。
   利用者が明示的に閉じたとき（'0'）だけ折りたたむ。 */
graphToggle(window.lsGet('kb_graph_open', null) !== '0');
let stopBG = null;
const startBG = () => {
  if(reduced) return;
  const c = $('#bgfx'); if(!c) return;
  if(stopBG) stopBG();
  stopBG = particles(c, 42, 110, .22, true);
};
startBG();
let rT; addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(startBG, 350); });
render();

/* Lab experiment badges (confidence/reproducible), used by card flow + detail view.
   Defined before the hash-routing bootstrap below, which may render the lab detail
   on first load via #lab/experiment/<id>. */
/* R1: 信頼度バッジを多言語化。あわせて low の表記を「可信度 低」→「探索段階 /
   Exploratory / 探索阶段」に変更した。
   理由：実験レポート 8 件すべてが low であり、赤い警告色で「信頼度 低」と並ぶと
   ラボ全体が信用できない印象を与えていた。段階を示す中立表現に改め、判定基準は
   「会社情報 → 調査手法と掲載基準」で公開している。色も赤（conf-l）から
   中立色（conf-x）に変更。 */
const confBadge = c => {
  const map = {high:['conf-h','conf_h'], medium:['conf-m','conf_m'], low:['conf-x','conf_l']};
  const m = map[c];
  return m ? '<span class="conf-badge '+m[0]+'">'+esc(KT(m[1]))+'</span>' : '';
};
const reproBadge = r => r === 'yes'
  ? '<span class="tagchip" style="color:var(--green);border-color:var(--green)">'+esc(KT('repro_y'))+'</span>'
  : '<span class="tagchip">'+esc(KT('repro_n'))+'</span>';

/* Top-level section state machine + hash routing (intel/lab/about).
   Without DATA.public the switcher is not rendered, section stays "intel",
   and the lab/about containers remain hidden. */
state.section = 'intel';
state.labExp = null;
/* R1: セクション名は i18n キーで持ち、描画時に KT() で解決する。 */
const SECTIONS = [['intel','sec_intel'],['lab','sec_lab'],['about','sec_about']];
function renderSectionNav(){
  if(!DATA.public) return;
  const el = document.createElement('div');
  el.id = 'section-nav';
  el.innerHTML = SECTIONS.map(([id, key]) =>
    '<button type="button" data-section="'+id+'" data-i18n="'+key+'" aria-pressed="'
    + (state.section===id ? 'true' : 'false') + '"'
    + (state.section===id ? ' class="on"' : '') + '>'+esc(KT(key))+'</button>').join('');
  el.querySelectorAll('button').forEach(b => b.onclick = () => {
    if(b.dataset.section === 'lab' && state.section === 'lab' && state.labExp) closeExperiment();
    else switchSection(b.dataset.section);
  });
  document.querySelector('header').appendChild(el);
}

/* ============================================================================
   R1: 言語切替（ja / en / zh）
   ・UI の器だけを差し替える。ナレッジ本文（notes / conclusions / entries）は
     執筆言語のまま表示し、UI 言語と異なる場合は .lang-note で明示する。
   ・静的マークアップは applyI18N() が data-i18n 系属性を走査して差し替え、
     JS 生成部分は render() / renderLab() の再実行で作り直す。
   ・選択は localStorage('kb_lang') に保存し、<html lang> も追随させる。
   ============================================================================ */
/* R2: 対応言語の一覧。ラベルはその言語自身の表記（自言語表記）にする——
   読めない言語のラベルを現在の UI 言語で書くと、探している人が見つけられない。 */
const LANGS = [
  ['ja','日本語'], ['en','English'], ['zh','中文'],
  ['ko','한국어'], ['de','Deutsch'], ['es','Español'], ['fr','Français']
];
const langLabel = code => (LANGS.find(l => l[0] === code) || ['', code])[1];

/* ヘッダーのドロップダウンとフッターのボタン列、両方の選択状態を同期する。 */
function syncLangButtons(){
  const lbl = document.getElementById('lang-dd-label');
  if(lbl) lbl.textContent = langLabel(window.KB_LANG);
  document.querySelectorAll('#lang-dd-list [role="option"]').forEach(o => {
    const on = o.dataset.lang === window.KB_LANG;
    o.setAttribute('aria-selected', on ? 'true' : 'false');
    o.classList.toggle('on', on);
  });
  /* R6: フッター側のボタン列は撤去したため、同期対象はドロップダウンのみ。 */
}

/* 選択肢の描画（ヘッダーの listbox とフッターのボタン列） */
function renderLangOptions(){
  const list = document.getElementById('lang-dd-list');
  if(list) list.innerHTML = LANGS.map(([code, label]) =>
    '<li role="option" tabindex="-1" data-lang="'+code+'" lang="'+code+'" aria-selected="false">'
    + '<span class="lang-check" aria-hidden="true">'
    + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7"/></svg></span>'
    + '<span>'+label+'</span></li>').join('');
  /* R6: フッターのボタン列を撤去したため、生成対象はドロップダウンの listbox のみ。 */
}
/* <title> / meta[description] / og:* を表示言語に合わせる。
   初回描画時（保存済み言語が ja 以外のケース）と言語切替時の両方から呼ぶ。 */
/* R16：SPA なのでビューを切り替えても <title> が変わらず、
   ブラウザの履歴やタブ一覧で画面を区別できなかった。
   「画面名 — サイト名」に組み立てる。state 未初期化のうちは素のサイト名。 */
function docTitleForView(){
  const base = KT('doc_title');
  let key = null;
  try{
    if(typeof state === 'undefined' || !state) return base;
    if(state.section === 'lab') key = 'sec_lab';
    else if(state.section === 'about') key = 'sec_about';
    else if(state.tab === 'search') key = 'tab_search';
    else if(state.tab === 'entity') key = null;
    else if(state.tab && state.tab !== 'overview') key = 'tab_' + state.tab;
  }catch(e){ return base; }
  if(!key) return base;
  const label = KT(key);
  return (label && label !== key) ? (label + ' — ' + base) : base;
}
function syncDocMeta(){
  document.title = docTitleForView();
  const setMeta = (sel, v) => { const m = document.querySelector(sel); if(m) m.setAttribute('content', v); };
  setMeta('meta[name="description"]', KT('doc_desc'));
  setMeta('meta[property="og:title"]', KT('doc_title'));
  setMeta('meta[property="og:description"]', KT('doc_desc'));
  setMeta('meta[property="og:locale"]', {ja:'ja_JP', en:'en_US', zh:'zh_CN', ko:'ko_KR', es:'es_ES', fr:'fr_FR', de:'de_DE'}[window.KB_LANG] || 'ja_JP');
}
function setLang(lang){
  if(!window.KB_I18N[lang] || lang === window.KB_LANG) { syncLangButtons(); return; }
  window.KB_LANG = lang;
  window.lsSet('kb_lang', lang);   /* 保存できない環境では黙って諦める */
  document.documentElement.lang = lang;
  syncDocMeta();
  window.applyI18N();
  syncLangButtons();
  renderSectionNavLabels();
  render();
  renderLab();
}
/* header のセクションナビは JS 生成のため、applyI18N の対象に入るよう data-i18n を
   付与済み。ラベルだけを貼り直すヘルパ（.on 状態を壊さない）。 */
function renderSectionNavLabels(){
  const nav = document.getElementById('section-nav');
  if(nav) window.applyI18N(nav);
}
/* R2: ドロップダウンの開閉・キーボード操作・フォーカス管理。
   閉じるトリガーは 3 つ：Esc / 外側クリック / 選択確定。いずれも閉じた後は
   トリガーボタンへフォーカスを戻す（キーボード利用者が迷子にならないように）。 */
function bindLangSwitch(){
  renderLangOptions();
  const btn  = document.getElementById('lang-dd-btn');
  const list = document.getElementById('lang-dd-list');
  if(!btn || !list){ syncLangButtons(); return; }

  const opts = () => [...list.querySelectorAll('[role="option"]')];
  const isOpen = () => !list.hidden;
  const open = () => {
    list.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    const cur = opts().find(o => o.dataset.lang === window.KB_LANG) || opts()[0];
    if(cur) cur.focus();
  };
  const close = (refocus) => {
    if(!isOpen()) return;
    list.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    if(refocus) btn.focus();
  };
  const move = (from, delta) => {
    const o = opts();
    const i = o.indexOf(from);
    const next = o[(i + delta + o.length) % o.length];
    if(next) next.focus();
  };

  btn.onclick = () => isOpen() ? close(true) : open();
  btn.onkeydown = e => {
    if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){ e.preventDefault(); open(); }
  };
  list.addEventListener('click', e => {
    const o = e.target.closest('[role="option"]');
    if(!o) return;
    close(true);
    setLang(o.dataset.lang);
  });
  list.addEventListener('keydown', e => {
    const o = e.target.closest('[role="option"]');
    if(!o) return;
    if(e.key === 'ArrowDown'){ e.preventDefault(); move(o, 1); }
    else if(e.key === 'ArrowUp'){ e.preventDefault(); move(o, -1); }
    else if(e.key === 'Home'){ e.preventDefault(); opts()[0]?.focus(); }
    else if(e.key === 'End'){ e.preventDefault(); opts().slice(-1)[0]?.focus(); }
    else if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); close(true); setLang(o.dataset.lang); }
    else if(e.key === 'Escape'){ e.preventDefault(); close(true); }
    else if(e.key === 'Tab'){ close(false); }
  });
  /* 外側クリックで閉じる。capture ではなく通常フェーズで、かつ #lang-dd 内は除外。 */
  document.addEventListener('click', e => {
    if(isOpen() && !e.target.closest('#lang-dd')) close(false);
  });

  syncLangButtons();
}

/* R1: 「調査手法を見る」導線。会社情報セクションの手法ブロックまでスクロールする。 */
function gotoMethod(){
  const el = document.getElementById('about-method');
  if(!el) return;
  requestAnimationFrame(() => el.scrollIntoView({behavior:'smooth', block:'start'}));
}

/* R1: フッターのサイト内リンク（セクション切替と手法へのジャンプ）。 */
function bindFooterNav(){
  document.querySelectorAll('[data-foot-sec]').forEach(a => a.onclick = e => {
    e.preventDefault();
    switchSection(a.dataset.footSec);
    if(a.hasAttribute('data-foot-method')) gotoMethod();
  });
  document.querySelectorAll('[data-foot-method]').forEach(a => a.onclick = e => {
    e.preventDefault(); switchSection('about'); gotoMethod();
  });
}
function switchSection(sec, hashTo){
  if(!SECTIONS.some(([id]) => id === sec)) sec = 'intel';
  const changed = state.section !== sec;
  state.section = sec;
  document.querySelectorAll('main > div[id^="section-"]').forEach(d =>
    d.hidden = d.id !== 'section-' + sec);
  if(DATA.public){
    const subnav = document.querySelector('nav');
    if(subnav) subnav.style.display = sec === 'intel' ? '' : 'none';
  }
  const nav = document.getElementById('section-nav');
  if(nav) nav.querySelectorAll('button').forEach(b => {
    const on = b.dataset.section === sec;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  if(changed){
    /* R21-1：直接 location.hash を書くと hashchange が再入するため、
       書き込みは syncHash に一本化する。hashTo（実験の深いパス）が
       渡されている場合はそれを優先する。 */
    if(hashTo && !_routing){
      try { history.pushState(null, '', location.pathname + location.search + '#' + hashTo); } catch(e){}
    } else {
      syncHash(true);
    }
    /* R16：セクションが変わったら <title> も追随させる */
    syncDocMeta();
    window.scrollTo({top:0});
  }
}
function applySectionFromHash(){
  const h = location.hash.replace(/^#/, '');
  const em = h.match(/^entity\/(.*)$/);
  if(em){
    let nm = em[1];
    try{ nm = decodeURIComponent(nm); }catch(_){ /* 畸形转义保留原串，走未知实体安全回退 */ }
    if(state.tab !== 'entity' || state.entity !== nm){
      if(state.section !== 'intel') switchSection('intel');
      openEntity(nm);
    }
    return;
  }
  if(state.entity != null){
    state.entity = null;
    if(state.tab === 'entity') switchTab(state.entityFrom || 'overview');
  }
  /* ==== R21-1：intel 内の状態を URL から復元する ====
     `''`（素の URL）も概要として扱う。ここを通さないと、#notes から
     「戻る」で素の URL に戻ったときにナレッジ画面のまま留まってしまう。 */
  const R21_TABS = ['overview','boards','notes','videos','graph'];
  const nm = h.match(/^note\/(.+)$/);
  const bm = h.match(/^board\/(.+)$/);
  const qm = h.match(/^search\/(.*)$/);
  if(nm || bm || qm || h === '' || R21_TABS.indexOf(h) >= 0){
    if(state.section !== 'intel') switchSection('intel');
    const clearQ = () => { if(state.q){ state.q = ''; const qe = $('#q'); if(qe) qe.value = ''; updateQCount(''); } };
    if(nm){
      let id = nm[1]; try{ id = decodeURIComponent(id); }catch(_){ /* 畸形はそのまま照合して外す */ }
      clearQ();
      state.sel = noteById(id) ? id : null;   /* 遮断済み・存在しない id は一覧のみ表示 */
      state.boardTopic = '';
      switchTab('notes'); renderNoteList(); renderDetail();
    } else if(bm){
      let t = bm[1]; try{ t = decodeURIComponent(t); }catch(_){}
      clearQ();
      state.boardTopic = (DATA.boards && DATA.boards[t]) ? t : '';
      state.sel = null;
      switchTab('boards');
    } else if(qm){
      let v = qm[1]; try{ v = decodeURIComponent(v); }catch(_){}
      const qe = $('#q'); if(qe) qe.value = v;
      state.q = v; state.srFull = {};
      if(!state.searchFrom) state.searchFrom = 'overview';
      if(v){ switchTab('search'); updateQCount(v); }
      else { switchTab('overview'); updateQCount(''); }
    } else {
      clearQ();
      state.sel = null; state.boardTopic = '';
      switchTab(h || 'overview');
    }
    return;
  }
  if(!DATA.public) return;
  const m = h.match(/^lab\/experiment\/(.+)$/);
  if(m){
    const want = noteById(m[1]) ? m[1] : null;
    if(state.section !== 'lab') switchSection('lab', h);
    if(state.labExp !== want){ state.labExp = want; renderLab(); }
    return;
  }
  const sec = SECTIONS.some(([id]) => id === h) ? h : 'intel';
  if(sec === 'lab' && state.section === 'lab'){
    if(state.labExp){ state.labExp = null; renderLab(); }
    return;
  }
  if(state.section !== sec) switchSection(sec);
  /* R21-1：どの経路にも当てはまらないハッシュ（打ち間違い・URL の切れ端）は
     画面を動かさず、URL だけ今の状態に合わせて書き戻す。
     これをしないと「表示は #note/abc のままなのに URL は #xxx」という
     ずれが残り、「リンクをコピー」が誤った URL を渡してしまう。
     履歴は増やさない（利用者の操作ではないので replaceState）。
     ページ内アンカーは TOC が scrollIntoView を使っており hash を触らないので、
     ここで書き戻しても目次の飛び先を壊さない（実測で確認）。 */
  if(h && !SECTIONS.some(([id]) => id === h)){
    const keep = _routing;
    _routing = false;
    syncHash(false);
    _routing = keep;
  }
}
renderSectionNav();
/* R21-1：ハッシュ → 状態の適用中は syncHash を止める（自分の書き込みで
   もう一度ここへ入ってこないように）。pushState は hashchange を出さないので
   「戻る / 進む」を拾うために popstate も同じ入口へ通す。 */
function applyRoute(){
  if(_routing) return;
  _routing = true;
  try { applySectionFromHash(); }
  finally { _routing = false; }
}
window.addEventListener('hashchange', applyRoute);
window.addEventListener('popstate', applyRoute);
applyRoute();
/* R1: 静的マークアップの多言語適用と言語切替・フッター導線の結線。
   renderSectionNav() の後に呼ぶこと（ヘッダーのセクションナビも適用対象に含めるため）。 */
window.applyI18N();
/* R32#A：applyI18N は data-i18n から静的な文言に戻すため、状態に追随する
   ラベルはこの後で貼り直す。初回表示だけ「開いているのに『開く』」に
   なっていたのはこれが無かったため。 */
syncGraphToggleLabel();
syncDocMeta();
bindLangSwitch();
bindFooterNav();
/* R9: 初回描画では switchTab を通らないため、ここでタブの ARIA を同期する */
syncTabAria();

/* R10: トップへ戻るボタン。
   ・400px 超で出現。hidden 属性で操作対象からも外し、
     見えないボタンに Tab フォーカスが当たらないようにする
   ・prefers-reduced-motion 時はスムーススクロールを使わず即時移動

   状態の更新は同期で行い、requestAnimationFrame は
   「hidden を外した次のフレームで .is-in を付けてトランジションを走らせる」
   ためだけに使う。
   当初は rAF を throttle のゲートにも使っていたが、
   ページが描画されていない状況（バックグラウンドタブ等）では rAF が発火せず、
   ゲート変数が解放されないまま表示状態が一切更新されなくなる作りだった。
   apply() は「変化が無ければ即 return」なので、scroll ごとに直接呼んでも十分軽い。 */
(function bindToTop(){
  const btn = document.getElementById('to-top');
  if(!btn) return;
  const THRESHOLD = 400;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let shown = null;                       /* null = 未初期化 */
  const apply = () => {
    const want = window.scrollY > THRESHOLD;
    if(want === shown) return;            /* 変化なし＝何もしない（呼び出しコストはほぼゼロ） */
    shown = want;
    if(want){
      btn.hidden = false;                 /* 状態は同期で確定させる */
      if(reduced()) btn.classList.add('is-in');
      else requestAnimationFrame(() => { if(shown) btn.classList.add('is-in'); });
    } else {
      btn.classList.remove('is-in');
      if(reduced()) btn.hidden = true;
      else setTimeout(() => { if(!shown) btn.hidden = true; }, 240);
    }
  };
  addEventListener('scroll', apply, {passive:true});
  btn.addEventListener('click', () => {
    window.scrollTo({top:0, behavior: reduced() ? 'auto' : 'smooth'});
  });
  apply();
})();
/* R9: セクション切替はトグルボタン群なので role="group" とラベルを与える
   （従来 role なしで、支援技術には「ただのボタン 3 つ」に見えていた）。 */
(function labelSectionNav(){
  const nav = document.getElementById('section-nav');
  if(!nav) return;
  nav.setAttribute('role', 'group');
  nav.setAttribute('aria-label', KT('sec_intel') + ' / ' + KT('sec_lab') + ' / ' + KT('sec_about'));
})();

/* R8: ロゴ → ホーム。
   修飾キー付き（Ctrl / Cmd / Shift / Alt）や中クリックは preventDefault せず、
   ブラウザ本来の「新しいタブで開く」を残す。通常の左クリックだけ画面内で処理する。 */
(function bindHomeLink(){
  const a = document.getElementById('home-link');
  if(!a) return;
  a.addEventListener('click', ev => {
    if(ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    ev.preventDefault();
    goHome();
  });
})();

/* Lab section content: experiment card flow (type=experiment, sorted by experiment
   date desc, confidence badge) + in-progress research candidates + a per-experiment
   detail view (hypothesis → method → result → badges → evidence chain).
   Only filled when DATA.public is set (same gating as the section switcher);
   without it the dynamic card grids stay empty while the static lab markup
   (hero, research directions, CTA) remains in the container. */
function renderExperimentDetail(){
  const el = document.getElementById('lab-detail');
  if(!el) return;
  const n = state.labExp ? noteById(state.labExp) : null;
  if(!n || n.type !== 'experiment'){
    el.hidden = true; el.innerHTML = '';
    const flow = document.getElementById('lab-flow');
    if(flow) flow.hidden = false;
    return;
  }
  const flow = document.getElementById('lab-flow');
  if(flow) flow.hidden = true;
  el.hidden = false;
  const evs = (n.evidence || []).map(noteById).filter(Boolean);
  el.innerHTML =
    '<p style="margin:0 0 14px"><button class="btn" id="lab-detail-back">' + esc(KT('exp_back')) + '</button></p>'
    + '<h1 style="font-size:24px;margin:0;letter-spacing:-.01em">' + esc(n.title) + '</h1>'
    + '<h2>' + esc(KT('exp_hypo')) + '</h2><p>' + inline(n.hypothesis || '—') + '</p>'
    + '<h2>' + esc(KT('exp_method')) + '</h2><p>' + inline(n.method || '—') + '</p>'
    + '<h2>' + esc(KT('exp_result')) + '</h2><p>' + inline(n.result || '—') + '</p>'
    + '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:14px 0 4px">'
    + confBadge(n.confidence) + reproBadge(n.reproducible)
    + '<span class="meta">' + esc(KT('exp_date', {d: n.date || '—'})) + '</span></div>'
    + '<h2>' + esc(KT('exp_evidence')) + '</h2>'
    + (evs.length
        ? '<div style="display:flex;flex-direction:column;gap:8px">'
          + evs.map((e, i) => '<div class="ev-link" data-note="' + esc(e.id) + '">'
            + '<span><span class="muted" style="margin-right:8px">' + String(i + 1).padStart(2, '0') + '</span>' + esc(e.title) + '</span>'
            + '<span class="m">' + esc(KT('exp_full')) + '</span></div>').join('') + '</div>'
        : '<p class="muted">—</p>')
    + '<p style="margin-top:18px"><button class="btn" id="lab-detail-full">' + esc(KT('exp_full')) + '</button></p>';
  $('#lab-detail-back').onclick = closeExperiment;
  $('#lab-detail-full').onclick = () => { switchSection('intel'); openNote(n.id); };
  el.querySelectorAll('.ev-link').forEach(x => x.onclick = () => {
    switchSection('intel'); openNote(x.dataset.note); });
}
function openExperiment(id){
  if(!DATA.public || !noteById(id)) return;
  state.labExp = id;
  const h = 'lab/experiment/' + id;
  if(state.section !== 'lab') switchSection('lab', h);
  else if(location.hash.replace(/^#/, '') !== h) location.hash = h;
  renderLab();
  window.scrollTo({top:0});
}
function closeExperiment(){
  state.labExp = null;
  renderLab();
  if(location.hash.replace(/^#/, '') !== 'lab') location.hash = 'lab';
  window.scrollTo({top:0});
}
function renderLab(){
  const box = document.getElementById('lab-experiments');
  if(!box || !DATA.public) return;
  /* R20-B8：実験詳細を開いている間は「AI ラボ」を h2 に落とす。
     renderExperimentDetail 側ではなくここで切り替えるのは、一覧に戻るときは
     state.labExp = null にして renderLab だけが呼ばれるため
     （詳細側に置くと h2 のまま戻ってしまう）。 */
  setHeadLevel(document.getElementById('h-view-lab'), state.labExp ? 'h2' : 'h1');
  /* 实验卡片流：type=experiment，按实验日期倒序 */
  const grid = document.getElementById('lab-exp-grid');
  const exps = DATA.notes.filter(n => n.type === 'experiment' && isPublishable(n)).slice()
    .sort((a,b) => String(b.date||'').localeCompare(String(a.date||''))
      || String(b.updated||'').localeCompare(String(a.updated||'')));
  const expCnt = document.getElementById('lab-exp-count');
  if(expCnt) expCnt.textContent = KT('unit_notes', {n: exps.length});
  if(grid){
    grid.innerHTML = exps.length ? exps.map(n =>
      /* R12-b2：進行中カード（data-lab-note）には role と tabindex があるのに、
         ラボの主役である実験カードには無く、キーボードだけでは開けなかった。 */
      '<div class="bcard" data-lab-exp="'+esc(n.id)+'" role="button" tabindex="0">'
      + '<div class="bcard-name">'+esc(n.title)+'</div>'
      + '<div class="exp-result">'+esc(n.result||'')+'</div>'
      + '<div class="exp-meta">'+confBadge(n.confidence)
      + '<span class="meta">'+esc(KT('exp_date', {d: n.date || '—'}))+'</span></div>'
      + '</div>').join('')
      : '<p class="muted" style="margin:0">'+esc(KT('lab_empty_exp'))+'</p>';
    grid.querySelectorAll('[data-lab-exp]').forEach(c => {
      const go = () => openExperiment(c.dataset.labExp);
      c.onclick = go;
      c.onkeydown = e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); go(); } };
    });
  }
  /* 进行中的实验：研究候选（research），保持按 updated 倒序 */
  const labs = DATA.notes.filter(n => n.type === 'research' && isPublishable(n))
    .sort((a,b) => String(b.updated||'').localeCompare(String(a.updated||'')));
  const cnt = document.getElementById('lab-count');
  if(cnt) cnt.textContent = KT('unit_notes', {n: labs.length});
  /* R29#3：0 件のときはパネルごと隠す。
     実測：遮断で research 20 件が全部非公開になり「進行中の実験 0 件 /
     準備中です。最初の実験を近日公開します。」が 110px 出ていた。
     看板セクションに 0 が並ぶのは、出さないより印象が悪い。
     件数が戻れば自動で再表示される。 */
  { const wip = box.closest('.panel'); if(wip) wip.hidden = labs.length === 0; }
  box.innerHTML = labs.length ? labs.map(n =>
    '<div class="bcard" data-lab-note="'+esc(n.id)+'" role="button" tabindex="0">'
    + '<div class="bcard-name">'+esc(n.title)+'</div>'
    + '<div class="bcard-meta">'+esc(n.summary||'')+'</div>'
    + '<div class="bcard-kw"><span>'+esc(KT('updated', {d: n.updated || '—'}))+'</span></div>'
    + '</div>').join('')
    : '<p class="muted" style="margin:0">'+esc(KT('lab_empty_wip'))+'</p>';
  box.querySelectorAll('[data-lab-note]').forEach(c => {
    const go = () => { switchSection('intel'); openNote(c.dataset.labNote); };
    c.onclick = go;
    c.onkeydown = e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); go(); } };
  });
  if(state.labExp) renderExperimentDetail();
  else {
    const det = document.getElementById('lab-detail');
    if(det){ det.hidden = true; det.innerHTML = ''; }
    const flow = document.getElementById('lab-flow');
    if(flow) flow.hidden = false;
  }
}
renderLab();
const labCta = document.getElementById('lab-cta');
if(labCta) labCta.onclick = () => switchSection('about');
}
/* 启动闸门：数据就绪后才进 kbMain；公开版远程拉取带加载/失败态 */
(function kbBoot(){
  const escH = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const hasInline = ((document.getElementById('kb-data')||{}).textContent||'').trim() !== '';
  if(hasInline){ kbLoadData().then(d => { DATA = d; kbMain(); }); return; }
  const ov = document.createElement('div');
  ov.id = 'kb-loading';
  /* R29#2：従来は inset:0 で全面を覆っていたため、1.2MB の JSON を待つ間
     ヘッダーもタブも隠れ、小さな絵文字と一行だけの白紙になっていた（実測）。
     ヘッダーとタブは静的マークアップなので即座に出せる。オーバーレイを
     ヘッダー下から始めることで、待っている間も「何のサイトか」が伝わる。
     位置は実測（ヘッダー＋セクションナビ＋タブ列）に合わせて算出し、
     取れないときは 0 に落として従来どおり全面を覆う。 */
  const _ovTop = (() => { try {
    const nv = document.querySelector('nav');
    if(nv){ const r = nv.getBoundingClientRect(); return Math.max(0, Math.round(r.bottom)); }
    const hd = document.querySelector('header');
    if(hd){ return Math.max(0, Math.round(hd.getBoundingClientRect().bottom)); }
  } catch(e){} return 0; })();
  ov.style.cssText = 'position:fixed;left:0;right:0;bottom:0;top:' + _ovTop + 'px;'
    + 'display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px;'
    + 'background:var(--bg,#f7f7fb);color:var(--ink2,#666);z-index:9999;font-size:14px';
  /* R1: 読み込み中／失敗時の文言も UI 言語に追随させる（KT は本スクリプトより前に定義済み）。 */
  ov.innerHTML = '<div style="font-size:26px">🪐</div><div>' + escH(window.KT('load')) + '</div>';
  document.body.appendChild(ov);
  kbLoadData().then(d => {
    DATA = d;
    /* R18：kbMain（描画）の例外まで下の .catch が拾うため、
       描画で落ちたときに「配信元に接続できません」という**誤った原因**が
       表示されていた（R17 で 1 件直したが、構造そのものは残っていた）。
       描画の失敗は取得の失敗と別物なので、ここで切り離す。 */
    try {
      kbMain();
      ov.remove();
    } catch(err){
      ov.innerHTML = '<div style="text-align:center;max-width:420px;line-height:1.9;padding:0 20px">'
        + '<div style="font-size:26px">⚠️</div>'
        + '<div>' + escH(window.KT('render_fail')) + '</div>'
        + '<div style="color:var(--ink3,#999);font-size:12px">' + escH(String((err && err.message) || err)) + '</div>'
        + '<button onclick="location.reload()" style="margin-top:12px;padding:8px 24px;border-radius:999px;border:1px solid var(--accent,#6366f1);background:none;color:var(--accent,#6366f1);cursor:pointer;font-size:14px">'
        + escH(window.KT('retry')) + '</button>'
        + '</div>';
    }
    return;
  }).catch(e => {
    ov.innerHTML = '<div style="text-align:center;max-width:420px;line-height:1.9;padding:0 20px">'
      + '<div style="font-size:26px">🛰️</div>'
      + '<div>' + escH(window.KT('load_fail', {e: (e && e.message) || e})) + '</div>'
      + '<div style="color:var(--ink3,#999);font-size:12px">' + escH(window.KT('load_fail_sub')) + '</div>'
      + '<button onclick="location.reload()" style="margin-top:12px;padding:8px 24px;border-radius:999px;border:1px solid var(--accent,#6366f1);background:none;color:var(--accent,#6366f1);cursor:pointer;font-size:14px">'
      + escH(window.KT('retry')) + '</button>'
      + '</div>';
  });
})();
