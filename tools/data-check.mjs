/**
 * data-check — 配信中の kb-data.json に内部データが残っていないかを機械的に確かめる
 *
 * 背景（PR #1 の指摘 3）：
 *   「页面侧过滤只是安全网，根治在 publish-data.sh。
 *     合并前请确认当前 CDN 产物已不含内部字段」
 *
 *   この「確認」を人の口約束にすると、(1) レビュアーが検証できない
 *   (2) 次にデータを再発行したとき黙って元に戻る、の 2 つで必ず破綻する。
 *   そこで確認そのものを再実行可能な検査にする。
 *
 * 方針：
 *   - 依存パッケージを入れない（Node の標準機能だけ）
 *   - **判定規則は app.data.js から読み込む**。ページ側の遮断定義と二重に持つと、
 *     片方だけ直したときに検査が嘘をつく
 *   - **URL も index.html から読む**。ページが実際に取りに行く先を検査する
 *   - ここはデータ側の検査。リポジトリの静的検査は pr-check.mjs が見る
 *
 * 使い方：
 *   node tools/data-check.mjs                  … index.html の配信先を検査
 *   node tools/data-check.mjs --url <URL>      … 任意の URL
 *   node tools/data-check.mjs --file <PATH>    … 手元の JSON（ネットワーク不要）
 *
 *   内部データが残っていれば exit 1。
 *
 * 注意：
 *   この検査が緑になっても「公開して良いか」の判断そのものは人の仕事。
 *   ここが見るのは「出さないと決めたものが出ていないか」だけ。
 */

import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import https from 'node:https';
import http from 'node:http';
import zlib from 'node:zlib';

const fails = [], warns = [], oks = [], notes_ = [];
const ok = (m) => oks.push(m);
const fail = (m) => fails.push(m);
const warn = (m) => warns.push(m);
const info = (m) => notes_.push(m);

/* 先頭 n 件だけ出す。100 件並べても読めないし、直す側は 1 件見れば同じ */
const few = (arr, n = 4) => arr.slice(0, n).join(' / ') + (arr.length > n ? ` …他 ${arr.length - n} 件` : '');

/* ============================================================================
   1. 判定規則を app.data.js から取り出す

   app.data.js はブラウザ用の classic script なので import できない。
   トップレベルの const を読むために、vm の中で評価して末尾で返させる。
   document を触るのは kbLoadData の中だけなので、読み込みだけなら副作用は無い。
   ========================================================================== */
const DATA_JS = 'app.data.js';
if (!existsSync(DATA_JS)) {
  console.error(`${DATA_JS} が見つかりません。リポジトリのルートで実行してください。`);
  process.exit(2);
}
let RULES;
try {
  const src = readFileSync(DATA_JS, 'utf8');
  const fn = new vm.Script(
    '(function(window){' + src +
    '\nreturn {BLOCK_SCOPES, BLOCK_TYPES, isPublishable, KB_SCRUB, KB_SCRUB_BODY, KB_SCRUB_ANY};})'
  ).runInNewContext({});
  RULES = fn({});
} catch (e) {
  console.error(`${DATA_JS} から判定規則を読めません: ${e.message}`);
  console.error('（名前を変えた場合はこの検査も直してください。二重管理を避けるためここで落としています）');
  process.exit(2);
}
const { BLOCK_SCOPES, BLOCK_TYPES, isPublishable } = RULES;
info(`判定規則は ${DATA_JS} から読み込み（遮断 scope: ${BLOCK_SCOPES.join(', ')} / type: ${BLOCK_TYPES.join(', ')}）`);

/* ============================================================================
   2. 取得先を決める（index.html が実際に取りに行く URL）
   ========================================================================== */
const argv = process.argv.slice(2);
const argOf = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const fileArg = argOf('--file');
let url = argOf('--url');

if (!fileArg && !url) {
  if (!existsSync('index.html')) { console.error('index.html が見つかりません。'); process.exit(2); }
  const m = readFileSync('index.html', 'utf8').match(/__KB_DATA_URL__\s*=\s*["']([^"']+)["']/);
  if (!m) { console.error('index.html に __KB_DATA_URL__ が見当たりません。--url で指定してください。'); process.exit(2); }
  url = m[1];
  info(`取得先は index.html の __KB_DATA_URL__ から: ${url}`);
}

/* HTTP GET（Node 標準のみ）。

   fetch を使わない理由が 2 つある。
     ① fetch は gzip を自動で展開したうえ Content-Encoding ヘッダも消すので、
        圧縮されていても「非圧縮」と誤報する
     ② 応答が 2xx でないときに process.exit すると、Windows の libuv が
        「Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)」で異常終了する
        （実測：exit 2 のはずが 127 になり、ツールが壊れて見える）
   自前で受ければ、配信ヘッダをそのまま見られて、後始末も自分で決められる。 */
const httpGet = (u, depth = 0) => new Promise((resolve, reject) => {
  let mod;
  try { mod = new URL(u).protocol === 'http:' ? http : https; }
  catch { return reject(new Error(`URL として解釈できません: ${u}`)); }
  const req = mod.get(u, { headers: { 'accept-encoding': 'gzip, deflate, br' } }, (res) => {
    const { statusCode, headers } = res;
    if (headers.location && depth < 3 && statusCode >= 300 && statusCode < 400) {
      res.resume();                      /* 読み捨てて接続を解放する */
      return resolve(httpGet(new URL(headers.location, u).toString(), depth + 1));
    }
    const chunks = [];
    res.on('data', c => chunks.push(c));
    res.on('end', () => {
      const buf = Buffer.concat(chunks);
      const enc = String(headers['content-encoding'] || '').toLowerCase();
      /* 展開は本文を読むためだけ。ヘッダは元のまま残すので圧縮の有無が分かる */
      const un = (fn) => { try { return fn(buf); } catch { return buf; } };
      const body = enc === 'gzip' ? un(zlib.gunzipSync)
                 : enc === 'deflate' ? un(zlib.inflateSync)
                 : enc === 'br' ? un(zlib.brotliDecompressSync)
                 : buf;
      resolve({ statusCode, headers: new Map(Object.entries(headers)), body, wire: buf.length });
    });
    res.on('error', reject);
  });
  req.on('error', reject);
  req.setTimeout(20000, () => { req.destroy(new Error('タイムアウト（20 秒）')); });
});

let raw, headers = null, wireBytes = null;
if (fileArg) {
  if (!existsSync(fileArg)) { console.error(`ファイルが無い: ${fileArg}`); process.exit(2); }
  raw = readFileSync(fileArg, 'utf8');
  info(`手元のファイルを検査: ${fileArg}`);
} else {
  let res;
  try { res = await httpGet(url); }
  catch (e) {
    console.error(`取得できません: ${e.message}`);
    console.error('（ネットワークが無い環境では --file で手元の JSON を渡してください）');
    process.exit(2);
  }
  if (res.statusCode !== 200) { console.error(`取得できません: HTTP ${res.statusCode} ${url}`); process.exit(2); }
  raw = res.body.toString('utf8');
  headers = res.headers;
  wireBytes = res.wire;
}

let D;
try { D = JSON.parse(raw); }
catch (e) { console.error(`JSON として読めません: ${e.message}`); process.exit(2); }

const notes = Array.isArray(D.notes) ? D.notes : [];
if (!notes.length) { console.error('notes が空です。取得先が違う可能性があります。'); process.exit(2); }

const pub = notes.filter(isPublishable);
const blocked = notes.filter(n => !isPublishable(n));
const pubIds = new Set(pub.map(n => n.id));
const blockedIds = new Set(blocked.map(n => n.id));
const pubTopics = new Set(pub.map(n => n.topic).filter(Boolean));

const bytes = Buffer.byteLength(raw, 'utf8');   /* raw.length は文字数。CJK は 1 文字 3 バイト */
info(`built_at ${D.built_at || '不明'} / ${bytes.toLocaleString()} B / notes ${notes.length} 件`);

/* ---------------------------------------------------- 3. 遮断対象そのもの */
/* JSON を直接開けば全文が読めるので、ここが本丸。 */
if (blocked.length) {
  const byType = {};
  blocked.forEach(n => { byType[n.type] = (byType[n.type] || 0) + 1; });
  fail(`遮断対象のナレッジが ${blocked.length} 件入っている（${Object.entries(byType).map(([k, v]) => `${k} ${v}`).join(' / ')}）`
     + ` — 例: ${few(blocked.map(n => n.id), 3)}`);
} else {
  ok(`遮断対象のナレッジ 0 件（公開 ${pub.length} 件のみ）`);
}

/* ------------------------------------------------- 4. 内部運用のための欄 */
/* today.head は社内パイプラインの commit ハッシュ。公開画面では一切使わない。 */
if (D.today && D.today.head) fail(`today.head が入っている（${String(D.today.head).slice(0, 12)}）— 社内 pipeline の commit ハッシュ`);
else ok('today.head なし');

/* actions はページが既に使っていない。使わないものを配るのは面（めん）を広げるだけ。 */
if (Array.isArray(D.actions) && D.actions.length) fail(`actions が ${D.actions.length} 件入っている — ページは未使用`);
else ok('actions なし');

/* ------------------------------------- 5. 集計・参照が遮断対象を指さないか */
/* 本体を消しても、集計側に題名や本文が残っていれば同じこと。 */
const refCheck = (label, arr, idOf) => {
  const bad = (Array.isArray(arr) ? arr : []).filter(x => { const id = idOf(x); return id && !pubIds.has(id); });
  if (bad.length) fail(`${label}: 公開外のナレッジを ${bad.length} / ${(arr || []).length} 件参照している`);
  else ok(`${label}: 参照はすべて公開分（${(arr || []).length} 件）`);
};
refCheck('entries', D.entries, e => e && e.note_id);
refCheck('conclusions', D.conclusions, c => c && c.note_id);
refCheck('graph.nodes', D.graph && D.graph.nodes, n => n && n.id);
refCheck('review.orphans', D.review && D.review.orphans, x => (typeof x === 'string' ? x : x && x.id));
refCheck('review.deprecated', D.review && D.review.deprecated, x => (typeof x === 'string' ? x : x && (x.id || x.note_id)));
refCheck('review.unverified', D.review && D.review.unverified, x => (typeof x === 'string' ? x : x && x.id));
refCheck('review.stale', D.review && D.review.stale, x => (typeof x === 'string' ? x : x && x.id));
refCheck('today.changes', D.today && D.today.changes, x => (typeof x === 'string' ? x : x && (x.id || x.note_id)));
refCheck('today.modified', D.today && D.today.modified, x => (typeof x === 'string' ? x : x && (x.id || x.note_id)));

/* -------------------------------------------- 6. 分類語彙（closed 分类语汇） */
/* boards / heat のキーは topic。公開分に 1 件も無い topic が残っていると、
   「その名前の活動が社内にある」ことだけが外から読める。
   実測では 20 個中 10 個が公開分に存在しない語彙だった（ark-harness など）。 */
const topicLeak = (label, list) => {
  const bad = list.filter(t => t && !pubTopics.has(t));
  if (bad.length) fail(`${label}: 公開分に存在しない分類が ${bad.length} / ${list.length} 個 — ${few(bad)}`);
  else ok(`${label}: 分類はすべて公開分の語彙（${list.length} 個）`);
};
topicLeak('boards', Object.keys(D.boards || {}));
topicLeak('heat', (Array.isArray(D.heat) ? D.heat : []).map(h => h && h.topic).filter(Boolean));

/* watchlist はキー自体が監視語。社内アカウント呼称がキーになっていた（実測）。 */
const INTERNAL_WORDS = [
  /* 社内アカウント呼称 */ '白菜咕咕', '社畜狗',
  /* 内部の情報収集タスク名 */ '知识波',
];
const wlBad = Object.keys(D.watchlist || {}).filter(k => INTERNAL_WORDS.some(w => k.includes(w)));
if (wlBad.length) fail(`watchlist のキーに社内呼称: ${wlBad.join(' / ')}`);
else ok(`watchlist のキーに社内呼称なし（${Object.keys(D.watchlist || {}).length} 個）`);

/* ------------------------------------------- 7. 公開分の本文に残る内部情報 */
/* 遮断が完璧でも、公開する 17 件の本文に社内パスが書いてあれば同じこと。 */
const INTERNAL_PATTERNS = [
  ['scripts/import-intelhub.py', /scripts\/import-intelhub\.py/],
  ['ark-harness', /ark-harness/],
  ['orchestration/lab-backlog.md', /orchestration\/lab-backlog\.md/],
  ['review_server', /review_server/],
];
const pubJson = JSON.stringify(pub);
const pathHits = INTERNAL_PATTERNS
  .map(([label, re]) => [label, pub.filter(n => re.test(JSON.stringify(n))).length])
  .filter(([, c]) => c > 0);
if (pathHits.length) fail(`公開分の本文に社内パス: ${pathHits.map(([l, c]) => `${l} ${c} 件`).join(' / ')}`);
else ok('公開分の本文に社内パスなし');

/* 社内呼称。ページ側は kbScrub で消しているが、それは表示だけの話。 */
const wordHits = INTERNAL_WORDS.map(w => [w, (pubJson.split(w).length - 1)]).filter(([, c]) => c > 0);
if (wordHits.length) fail(`公開分に社内呼称: ${wordHits.map(([w, c]) => `${w} ${c} 箇所`).join(' / ')}`);
else ok('公開分に社内呼称なし');

/* ページ側の scrub 規則がまだ当たるなら、それは「安全網が仕事をしている」＝
   データ側が直っていないということ。規則は app.data.js から来ているので、
   規則を足せばこの検査も自動的に強くなる。 */
const scrubRules = [].concat(RULES.KB_SCRUB || [], RULES.KB_SCRUB_BODY || [], RULES.KB_SCRUB_ANY || []);
/* 数えるのは「当たったナレッジの件数」。規則ごとに数えると、1 件の題名に
   複数の規則が当たっただけで件数が水増しされる（実測で 1 件が 3 と出た）。 */
const scrubHits = pub.filter(n => scrubRules.some(([re]) =>
  [n.title, n.summary, n.content].some(v => {
    if (v == null) return false;
    re.lastIndex = 0;                   /* g 付き正規表現は状態を持つ。毎回戻す */
    return re.test(String(v));
  })));
if (scrubHits.length) fail(`ページ側の除去規則がまだ ${scrubHits.length} 件のナレッジに当たる`
  + `（例: ${few(scrubHits.map(n => n.id), 3)}）— 安全網が働いている＝データ側が未修正`);
else ok('ページ側の除去規則に当たる箇所なし');

/* -------------------------------------------------------- 8. 配信の設定 */
/* 内容の話ではないので警告どまり。ただし 1.2MB を毎回素で配るのは効く。 */
if (headers) {
  const enc = headers.get('content-encoding');
  const cc = headers.get('cache-control');
  if (!enc) warn(`圧縮されていない（${bytes.toLocaleString()} B をそのまま配信）`);
  else ok(`Content-Encoding: ${enc}（回線上 ${wireBytes.toLocaleString()} B / 展開後 ${bytes.toLocaleString()} B）`);
  if (!cc) warn('Cache-Control が無い');
  else ok(`Cache-Control: ${cc}`);
} else if (!fileArg) {
  info('配信ヘッダは取得できませんでした（内容の検査には影響しません）');
}

/* ------------------------------------------------------------------ 出力 */
const line = '─'.repeat(70);
console.log(line);
for (const m of notes_) console.log(`  ・    ${m}`);
console.log(line);
for (const m of oks) console.log(`  OK    ${m}`);
for (const m of warns) console.log(`  警告  ${m}`);
for (const m of fails) console.log(`  失敗  ${m}`);
console.log(line);
console.log(`OK ${oks.length} / 警告 ${warns.length} / 失敗 ${fails.length}`);

if (fails.length) {
  console.log(`
配信中のデータに内部情報が残っています。
直す場所は publish-data.sh（このリポジトリには無い）で、ページ側では直せません。
ページ側の遮断は安全網として働きますが、JSON の URL を直接開けば読めます。`);
  process.exit(1);
}
console.log('\n配信中のデータに内部情報は見つかりませんでした。');
