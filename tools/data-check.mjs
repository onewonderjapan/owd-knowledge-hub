/**
 * data-check — 公開ノート配信元（ow-open-knowledge/knowledge-notes/）に内部データが
 * 残っていないかを機械的に確かめる
 *
 * 背景（PR #6 でデータ源を切替）：
 *   旧 CDN の kb-data.json（index.html の __KB_DATA_URL__）は廃止。ページは
 *   window.__KB_NOTES_BASE__（既定は GitHub raw の ow-open-knowledge/knowledge-notes/）から
 *   manifest.json を読み、そこに載っている <topic>/<slug>.md だけを取得して組み立てる
 *   （app.data.js の kbLoadExport / kbBuildFromExport）。
 *   旧 data-check は kb-data.json 向けだったため「__KB_DATA_URL__ が見当たりません」で
 *   落ちていた。ここを新しい供給経路に対する検査として書き直す。
 *
 * 方針（旧工具から不変）：
 *   - 依存パッケージを入れない（Node の標準機能だけ）
 *   - **判定規則は app.data.js から読み込む**。frontmatter の解釈
 *     （kbParseFrontmatter）もノートのパス条件（KB_SAFE_PATH）もページと同一実装を
 *     使う。片方だけ直すと検査が嘘をつく
 *   - **取得先も index.html から読む**。ページが実際に取りに行く先を検査する
 *   - 禁止語・社内パスのリストは旧 data-check から継承（下の INTERNAL_WORDS /
 *     INTERNAL_PATTERNS）
 *   - ここはデータ側の検査。リポジトリの静的検査は pr-check.mjs、描画の回帰は
 *     render-check.mjs が見る
 *
 * 使い方：
 *   node tools/data-check.mjs                    … index.html の __KB_NOTES_BASE__ を全件検査
 *   node tools/data-check.mjs --url <BASE>       … 任意の BASE URL（末尾 / は無くてよい）
 *   node tools/data-check.mjs --file <DIR>       … 手元の knowledge-notes 検出ディレクトリ（ネットワーク不要）
 *   node tools/data-check.mjs --sample N         … ノート本文を無作為 N 件だけ検査（既定は全件）
 *
 *   内部データが残っていれば exit 1、取得・解析ができなければ exit 2。
 *
 * 注意：
 *   この検査が緑になっても「公開して良いか」の判断そのものは人の仕事。
 *   ここが見るのは「出さないと決めたものが出ていないか」だけ。
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
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
   トップレベルの const / function を読むために、vm の中で評価して末尾で返させる。
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
    '\nreturn {BLOCK_SCOPES, BLOCK_TYPES, isPublishable, KB_SCRUB, KB_SCRUB_BODY, KB_SCRUB_ANY,' +
    ' KB_SAFE_PATH, kbParseFrontmatter};})'
  ).runInNewContext({});
  RULES = fn({});
} catch (e) {
  console.error(`${DATA_JS} から判定規則を読めません: ${e.message}`);
  console.error('（名前を変えた場合はこの検査も直してください。二重管理を避けるためここで落としています）');
  process.exit(2);
}
const { isPublishable, KB_SCRUB, KB_SCRUB_BODY, KB_SCRUB_ANY, KB_SAFE_PATH, kbParseFrontmatter } = RULES;
info(`判定規則は ${DATA_JS} から読み込み（frontmatter 解析・パス条件・除去規則はページと同一実装）`);

/* ============================================================================
   2. 検査先を決める（index.html が実際に取りに行く先）

   --file は手元の knowledge-notes 検出（ow-open-knowledge の clone など）。
   raw GitHub はディレクトリ一覧が取れないため、「manifest に載っていないファイル」の
   検査（後述の孤児チェック）は --file でのみ行える。
   ========================================================================== */
const argv = process.argv.slice(2);
const argOf = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const fileArg = argOf('--file');
let url = argOf('--url');
let sampleN = null;
if (argv.includes('--sample')) {
  sampleN = Number(argOf('--sample'));
  if (!Number.isInteger(sampleN) || sampleN < 1) {
    console.error('--sample の指定が不正です（例: --sample 3）');
    process.exit(2);
  }
}

if (!fileArg && !url) {
  if (!existsSync('index.html')) { console.error('index.html が見つかりません。'); process.exit(2); }
  const m = readFileSync('index.html', 'utf8').match(/__KB_NOTES_BASE__\s*=\s*["']([^"']+)["']/);
  if (!m) { console.error('index.html に __KB_NOTES_BASE__ が見当たりません。--url で指定してください。'); process.exit(2); }
  url = m[1];
  info(`検査先は index.html の __KB_NOTES_BASE__ から: ${url}`);
}

/* HTTP GET（Node 標準のみ）。

   fetch を使わない理由が 2 つある。
     ① fetch は gzip を自動で展開したうえ Content-Encoding ヘッダも消すので、
        圧縮されていても「非圧縮」と誤報する
     ② 応答が 2xx でないときに process.exit すると、Windows の libuv が
        「Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)」で異常終了する
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

/* ============================================================================
   3. manifest.json を取る（URL または手元のディレクトリ）
   ========================================================================== */
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

let manifestRaw, manifestHeaders = null, manifestWire = null;
/** (relPath) => Promise<{text, buf, headers}> — URL と --file を同じ形で扱う */
let fetchDoc;
if (fileArg) {
  if (!existsSync(fileArg)) { console.error(`ディレクトリが無い: ${fileArg}`); process.exit(2); }
  const manifestPath = path.join(fileArg, 'manifest.json');
  if (!existsSync(manifestPath)) { console.error(`manifest.json が無い: ${manifestPath}`); process.exit(2); }
  manifestRaw = readFileSync(manifestPath, 'utf8');
  info(`手元のディレクトリを検査: ${fileArg}`);
  fetchDoc = async (rel) => {
    const p = path.join(fileArg, rel);
    if (!existsSync(p)) throw new Error(`ファイルが無い: ${rel}`);
    const buf = readFileSync(p);
    return { text: buf.toString('utf8'), buf, headers: null, wire: buf.length };
  };
} else {
  const base = /\/$/.test(url) ? url : url + '/';
  info(`manifest の取得先: ${base}manifest.json`);
  let res;
  try { res = await httpGet(base + 'manifest.json'); }
  catch (e) {
    console.error(`取得できません: ${e.message}`);
    console.error('（ネットワークが無い環境では --file で手元の knowledge-notes 検出を渡してください）');
    process.exit(2);
  }
  if (res.statusCode !== 200) { console.error(`取得できません: HTTP ${res.statusCode} ${base}manifest.json`); process.exit(2); }
  manifestRaw = res.body.toString('utf8');
  manifestHeaders = res.headers;
  manifestWire = res.wire;
  fetchDoc = async (rel) => {
    const r = await httpGet(base + rel);
    if (r.statusCode !== 200) throw new Error(`HTTP ${r.statusCode} ${rel}`);
    return { text: r.body.toString('utf8'), buf: r.body, headers: r.headers, wire: r.wire };
  };
}

let M;
try { M = JSON.parse(manifestRaw); }
catch (e) { console.error(`manifest.json を JSON として読めません: ${e.message}`); process.exit(2); }

const mNotes = Array.isArray(M.notes) ? M.notes : [];
if (!mNotes.length) { console.error('manifest の notes が空です。取得先が違う可能性があります。'); process.exit(2); }
const mFiles = Array.isArray(M.files) ? M.files : [];

/* source_commit / source_repo は PR #6 の設計で manifest が載せる公開項目
   （ページの組立にも使う）。旧検査が fail にしていた today.head（社内 pipeline の
   commit ハッシュ）とは違い、ここでは情報として出すだけに留める。 */
info(`generator ${M.generator || '不明'} / exported_at ${M.exported_at || '不明'} / notes ${mNotes.length} 件`
   + (M.source_commit ? ` / source_commit ${M.source_commit}` : ''));

/* ============================================================================
   4. manifest 自体の形（構造検査の前半）
   ========================================================================== */
if (typeof M.count === 'number') {
  if (M.count === mNotes.length) ok(`manifest.count が notes と一致（${M.count}）`);
  else fail(`manifest.count が notes と一致しない（count ${M.count} / 実際 ${mNotes.length}）`);
} else {
  warn('manifest.count が無い');
}

const badEntries = mNotes.filter(e => !e || typeof e.id !== 'string' || !e.id);
if (badEntries.length) fail(`notes に id の無いエントリが ${badEntries.length} 件`);
else ok('notes の全エントリに id がある');

/* ページは KB_SAFE_PATH に合わない path を黙って読み飛ばす（kbLoadExport）。
   載せたのに読まれない＝「manifest にあるのに画面に出ない」なのでここで落とす。 */
const badPaths = mNotes.filter(e => e && !KB_SAFE_PATH.test(String(e.path || '')));
if (badPaths.length) fail(`path が <topic>/<slug>.md 形式でないエントリが ${badPaths.length} 件 — ${few(badPaths.map(e => e.path))}`);
else ok(`path はすべて <topic>/<slug>.md 形式（../ や絶対パス無し）`);

const ids = mNotes.map(e => e && e.id).filter(v => typeof v === 'string');
const dupIds = ids.filter((v, i) => ids.indexOf(v) !== i);
if (dupIds.length) fail(`id の重複: ${[...new Set(dupIds)].join(' / ')}`);
else ok(`id の重複なし（${ids.length} 件）`);

const paths = mNotes.map(e => e && e.path).filter(v => typeof v === 'string');
const dupPaths = paths.filter((v, i) => paths.indexOf(v) !== i);
if (dupPaths.length) fail(`path の重複: ${[...new Set(dupPaths)].join(' / ')}`);
else ok('path の重複なし');

/* ============================================================================
   5. ノートを取得する（既定は全件。--sample N なら無作為 N 件）

   禁止語の走査は 1 件でも漏れれば意味が無いので、CI では全件（既定）で回す。
   --sample は手元での速い目視確認用で、使った場合は警告を出す。
   ========================================================================== */
let targets = mNotes;
if (sampleN) {
  const pool = [...mNotes];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  targets = pool.slice(0, sampleN);
  warn(`--sample ${sampleN}：本文は無作為 ${targets.length} / ${mNotes.length} 件のみ検査（全件は --sample 無し）`);
}

const docs = [];   /* {entry, text?, buf?, fm?, body?, error?} */
for (const e of targets) {
  if (!e || typeof e.id !== 'string' || !KB_SAFE_PATH.test(String(e.path || ''))) { docs.push({ entry: e, skipped: true }); continue; }
  try {
    const r = await fetchDoc(e.path);
    docs.push({ entry: e, ...r });
  } catch (err) {
    docs.push({ entry: e, error: err });
  }
}

const missing = docs.filter(d => d.error);
if (missing.length) fail(`manifest に載っているノートが ${missing.length} 件取れない — ${few(missing.map(d => `${d.entry.path}（${d.error.message}）`))}`);
else ok(`manifest のノート ${docs.length} 件すべて取得できた`);

/* sha256 は export が書いた内容の指紋。実物と食い違う＝エクスポート後の手直しや
   部分更新が起きているので、配信されている内容が検証済みの内容と同じだと言えない。 */
const shaTargets = docs.filter(d => d.buf && d.entry.sha256);
const shaBad = shaTargets.filter(d => sha256(d.buf) !== d.entry.sha256);
if (shaBad.length) fail(`sha256 が manifest と食い違うノートが ${shaBad.length} / ${shaTargets.length} 件 — ${few(shaBad.map(d => d.entry.path))}`);
else if (shaTargets.length) ok(`sha256 が manifest と一致（${shaTargets.length} 件）`);
else warn('manifest に sha256 が無い（内容の指紋が検証できない）');

/* ============================================================================
   6. 各ノートの中身 — frontmatter・遮断・禁止語・除去規則
   ========================================================================== */
const got = docs.filter(d => d.text != null);
for (const d of got) { const [fm, body] = kbParseFrontmatter(d.text); d.fm = fm; d.body = body; }

/* ページ側の二重の安全網（kbBuildFromExport）：scope === 'public' かつ
   fm.id === manifest の id で無いノートは画面に出ない。export に載る時点で
   この条件を満たしていないと「manifest にあるのに見えない」だけではなく、
   scope の付け忘れ＝非公開ノートの混入そのものなので fail。 */
const scopeBad = got.filter(d => d.fm.scope !== 'public');
if (scopeBad.length) fail(`scope: public でないノートが ${scopeBad.length} 件 — ${few(scopeBad.map(d => `${d.entry.path}（scope=${JSON.stringify(d.fm.scope) || 'なし'}）`))}`);
else ok(`全ノートが scope: public（${got.length} 件）`);

const idMismatch = got.filter(d => d.fm.id !== d.entry.id);
if (idMismatch.length) fail(`frontmatter の id が manifest と食い違うノートが ${idMismatch.length} 件 — ${few(idMismatch.map(d => `${d.entry.path}（manifest=${d.entry.id} / fm=${d.fm.id || 'なし'}）`))}`);
else ok('frontmatter の id はすべて manifest と一致');

/* 旧検査から継承：ページ側の遮断規則（BLOCK_SCOPES / BLOCK_TYPES）に引っかかるものは
   「安全網が仕事をしている」＝export する前に出してはいけないものが出ている。 */
const blocked = got.filter(d => !isPublishable({ scope: d.fm.scope, type: d.fm.type }));
if (blocked.length) fail(`遮断対象のノートが ${blocked.length} 件入っている — ${few(blocked.map(d => `${d.entry.path}（scope=${d.fm.scope} / type=${d.fm.type || 'なし'}）`))}`);
else ok(`遮断対象（scope ${RULES.BLOCK_SCOPES.join('/')}・type ${RULES.BLOCK_TYPES.join('/')}）のノート 0 件`);

const noTitle = got.filter(d => !String(d.fm.title || '').trim());
if (noTitle.length) warn(`title の無いノートが ${noTitle.length} 件（ページは id で代用する）— ${few(noTitle.map(d => d.entry.path))}`);
else ok('全ノートに title がある');

/* 禁止語・社内パス。旧 data-check からリストを継承する。
   本文だけでなく frontmatter（summary / tags / source など）も同じ面なので、
   ノートの全文（frontmatter 含む）に当てる。 */
const INTERNAL_WORDS = [
  /* 社内アカウント呼称 */ '白菜咕咕', '社畜狗',
  /* 内部の情報収集タスク名 */ '知识波',
];
const INTERNAL_PATTERNS = [
  ['scripts/import-intelhub.py', /scripts\/import-intelhub\.py/],
  ['ark-harness', /ark-harness/],
  ['orchestration/lab-backlog.md', /orchestration\/lab-backlog\.md/],
  ['review_server', /review_server/],
];
const pathHits = [], wordHits = [];
for (const d of got) {
  const t = d.text;
  const ph = INTERNAL_PATTERNS.filter(([, re]) => re.test(t)).map(([l]) => l);
  if (ph.length) pathHits.push(`${d.entry.path}: ${ph.join(',')}`);
  const wh = INTERNAL_WORDS.filter(w => t.includes(w));
  if (wh.length) wordHits.push(`${d.entry.path}: ${wh.join(',')}`);
}
if (pathHits.length) fail(`公開ノートに社内パス: ${pathHits.length} 件 — ${few(pathHits)}`);
else ok(`公開ノートに社内パスなし（${got.length} 件を走査）`);
if (wordHits.length) fail(`公開ノートに社内呼称: ${wordHits.length} 件 — ${few(wordHits)}`);
else ok(`公開ノートに社内呼称なし`);

/* ページ側の除去規則（kbSanitize が当てる KB_SCRUB 系）がまだ当たるなら、
   それは「安全網が仕事をしている」＝データ側が直っていないということ。
   振り分けもページと同じにする：題名・要約には KB_SCRUB 全部、本文には
   KB_SCRUB_BODY、全体走査には KB_SCRUB_ANY。 */
const matchSome = (v, rules) => v != null && rules.some(([re]) => { re.lastIndex = 0; return re.test(String(v)); });
const TITLE_RULES = [].concat(KB_SCRUB || [], KB_SCRUB_BODY || [], KB_SCRUB_ANY || []);
const BODY_RULES = [].concat(KB_SCRUB_BODY || [], KB_SCRUB_ANY || []);
const scrubHits = got.filter(d =>
  matchSome(d.fm.title, TITLE_RULES) || matchSome(d.fm.summary, TITLE_RULES) || matchSome(d.body, BODY_RULES));
if (scrubHits.length) fail(`ページ側の除去規則がまだ ${scrubHits.length} 件のノートに当たる — ${few(scrubHits.map(d => d.entry.path))}＝安全網が働いている・データ側が未修正`);
else ok('ページ側の除去規則に当たる箇所なし');

/* related は kbBuildFromExport が manifest 内の id にだけ張る。外れの id は
   黙って落ちるので「書いたのに繋がらない」状態になる。内容の漏れではないので警告。 */
const idSet = new Set(ids);
const dangling = [];
for (const d of got) {
  const rel = Array.isArray(d.fm.related) ? d.fm.related : [];
  for (const id of rel) if (!idSet.has(id)) dangling.push(`${d.entry.id} → ${id}`);
}
if (dangling.length) warn(`manifest に無い related が ${dangling.length} 件（ページでは黙って無視される）— ${few(dangling)}`);
else if (got.length === mNotes.length) ok('related はすべて manifest 内の id');

/* ============================================================================
   6b. manifest.files の補助ファイル（INDEX.md / README.md など）

   ページは読まないが、同じ BASE URL で誰でも取れる＝公開面の一部。
   禁止語の面はノートと同じ規則で見る。sha256・存在も同じように確認する。
   ========================================================================== */
const SAFE_FILES_PATH = /^(?!.*\.\.)[A-Za-z0-9_][A-Za-z0-9_.\/-]*$/;
for (const f of mFiles) {
  const p = f && f.path;
  if (typeof p !== 'string' || !SAFE_FILES_PATH.test(p)) { fail(`files[] に不正な path: ${JSON.stringify(p)}`); continue; }
  let d;
  try { d = await fetchDoc(p); }
  catch (e) { warn(`files[] の ${p} が取れない（${e.message}）— ページは影響を受けない`); continue; }
  if (f.sha256 && sha256(d.buf) !== f.sha256) fail(`files[] の ${p} が sha256 不一致`);
  const ph = INTERNAL_PATTERNS.filter(([, re]) => re.test(d.text)).map(([l]) => l);
  const wh = INTERNAL_WORDS.filter(w => d.text.includes(w));
  if (ph.length || wh.length) fail(`files[] の ${p} に社内パス・社内呼称: ${[...ph, ...wh].join(',')}`);
  else ok(`files[] の ${p}: 社内パス・社内呼称なし`);
}

/* ============================================================================
   6c. manifest 自体の文字列にも同じ規則を当てる（旧検査 7b の考え方）
   id / path / source_repo など、manifest が配るすべての文字列が対象。
   （scrub_patterns は Python 正規表現のリストでここでは評価しない。出どりの記録。） */
{
  const walk = (v, out) => {
    if (v == null) return out;
    if (typeof v === 'string') { out.push(v); return out; }
    if (Array.isArray(v)) { v.forEach(x => walk(x, out)); return out; }
    if (typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.push(k); walk(x, out); }
    return out;
  };
  const strs = walk(M, []);
  const ph = INTERNAL_PATTERNS.filter(([, re]) => strs.some(t => re.test(t))).map(([l]) => l);
  const wh = INTERNAL_WORDS.filter(w => strs.some(t => t.includes(w)));
  if (ph.length || wh.length) fail(`manifest の文字列に社内パス・社内呼称: ${[...ph, ...wh].join(',')}`);
  else ok(`manifest の文字列（${strs.length} 個）に社内パス・社内呼称なし`);
}

/* ============================================================================
   7. ディレクトリと manifest の一致（--file のみ）

   raw GitHub URL はディレクトリ一覧を取れないので、この検査は手元の检出でのみ可能。
   manifest に載っていない .md も URL を直打ちすれば誰でも読める＝公開面の一部。
   scope が public でないものが紛れていたら漏れそのものなので fail。
   ========================================================================== */
if (fileArg) {
  const listed = new Set([...paths, ...mFiles.map(f => f && f.path).filter(Boolean)].map(p => String(p).replace(/\\/g, '/')));
  const onDisk = [];
  const walkDir = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = path.join(dir, name);
      if (statSync(p).isDirectory()) walkDir(p);
      else if (/\.md$/i.test(name)) onDisk.push(path.relative(fileArg, p).replace(/\\/g, '/'));
    }
  };
  walkDir(fileArg);
  const orphans = onDisk.filter(p => !listed.has(p));
  if (!orphans.length) ok(`ディレクトリ内の .md ${onDisk.length} 個はすべて manifest に載っている`);
  else {
    const orphanBad = [];
    for (const p of orphans) {
      const [fm] = kbParseFrontmatter(readFileSync(path.join(fileArg, p), 'utf8'));
      if (fm.scope !== 'public') orphanBad.push(`${p}（scope=${JSON.stringify(fm.scope) || 'なし'}）`);
    }
    if (orphanBad.length) fail(`manifest に載っていない非公開 .md が ${orphanBad.length} 件 — ${few(orphanBad)}＝URL 直打ちで読める`);
    else warn(`manifest に載っていない .md が ${orphans.length} 件（画面には出ないが URL で直接読める）— ${few(orphans)}`);
  }
}

/* ============================================================================
   8. 配信の設定（URL モードのみ。内容の話ではないので警告どまり）
   ========================================================================== */
if (manifestHeaders) {
  const checkH = (label, headers, wire, bytes) => {
    const enc = headers.get('content-encoding');
    const cc = headers.get('cache-control');
    if (!enc) warn(`${label} が圧縮されていない（${bytes.toLocaleString()} B をそのまま配信）`);
    else ok(`${label}: Content-Encoding: ${enc}（回線上 ${wire.toLocaleString()} B / 展開後 ${bytes.toLocaleString()} B）`);
    if (!cc) warn(`${label} に Cache-Control が無い`);
    else ok(`${label}: Cache-Control: ${cc}`);
  };
  checkH('manifest.json', manifestHeaders, manifestWire, Buffer.byteLength(manifestRaw, 'utf8'));
  const withH = docs.find(d => d.headers);
  if (withH) checkH(`ノート（${withH.entry.path}）`, withH.headers, withH.wire, Buffer.byteLength(withH.text, 'utf8'));
} else {
  info('手元検査のため配信ヘッダは見ていない（内容の検査には影響しない）');
}

/* ==================================================================  出力 */
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
配信中のノートに内部情報が残っています。
直す場所は ow-open-knowledge 側（非公開 KB を直して kb export-public をやり直し、
main へ再 PR）で、ページ側では直せません。
manifest に載っていないファイルも URL を直打ちすれば読めるため、
检出全体の確認は --file で手元の knowledge-notes に対して行ってください。`);
  process.exit(1);
}
console.log('\n配信中のノートに内部情報は見つかりませんでした。');
