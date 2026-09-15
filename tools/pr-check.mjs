/**
 * pr-check — プルリクエストで走らせる静的検証
 *
 * 背景（PR #1 の指摘 5）：
 *   deploy.yml は `on: push / branches:[main]` だけなので、PR では一度も検証されず、
 *   壊れた HTML がそのまま本番へ入り得る状態だった。
 *
 * 方針：
 *   - 依存パッケージを入れない（npm install なし＝ネットワーク事情で落ちない）
 *   - Node の標準機能だけで、「本番に入ると困るもの」だけを止める
 *   - 設計の良し悪しは人のレビューに任せる。ここは壊れているかどうかだけ見る
 *   - **誤検知を出さない**。毎回赤くなる CI は、無い CI より害がある
 *
 * 使い方：
 *   node tools/pr-check.mjs      … 失敗があれば exit 1
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import vm from 'node:vm';

const fails = [], warns = [], oks = [];
const ok   = (m) => oks.push(m);
const fail = (m) => fails.push(m);
const warn = (m) => warns.push(m);

/* ============================================================================
   共通：静的マークアップだけを取り出す

   この index.html は 1 ファイルに HTML / CSS / JS が同居していて、JS の中で
   HTML 文字列を組み立てている。素の全文を数えると、JS 文字列やコメントの中の
   `id="..."` や `<footer>` まで数えてしまい、実在しない重複・不一致を報告する
   （最初の版で実際に 3 種類の誤検知を出した）。
   検査の前に <script> / <style> / コメントを落とす。
   ========================================================================== */
const staticMarkup = (html) => html
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<!--[\s\S]*?-->/g, '');

/* ---------------------------------------------------------------- 1. 配布物 */
/* deploy.yml が S3 へ送るファイル。欠けたまま main に入ると本番が 404 になる。
   og.png は「無いまま push すると SNS 側に 404 がキャッシュされ、後から直しても
   反映されない」という実害が出たことがあるので、存在だけでなく中身も見る。 */
/* R36：PR #1 指摘 1 への対応で index.html から切り出した 2 ファイルも配布物。
   片方だけ配信されると本体が動かないので、存在と deploy.yml への登録を必ず見る。 */
const REQUIRED = ['index.html', 'app.css', 'app.js', 'app.i18n.js', 'app.data.js', 'mascot.html', 'og.png'];
for (const f of REQUIRED) {
  if (!existsSync(f)) { fail(`配布物が無い: ${f}`); continue; }
  const size = statSync(f).size;
  if (size === 0) { fail(`配布物が空: ${f}`); continue; }
  ok(`配布物あり: ${f} (${size.toLocaleString()} B)`);
}

if (existsSync('og.png')) {
  const buf = readFileSync('og.png');
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!sig.every((b, i) => buf[i] === b)) fail('og.png が PNG ではない（シグネチャ不一致）');
  else {
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    if (w === 1200 && h === 630) ok('og.png 1200x630');
    else warn(`og.png の寸法が 1200x630 ではない: ${w}x${h}`);
  }
}

/* ---------------------------------------------------- 2. deploy.yml との整合 */
/* 配布物を増やしたのに deploy.yml の paths へ足し忘れると、
   その変更だけでは本番に反映されない（しかも気づきにくい）。 */
const DEPLOY = '.github/workflows/deploy.yml';
if (existsSync(DEPLOY)) {
  const y = readFileSync(DEPLOY, 'utf8');
  const missing = REQUIRED.filter(f => !y.includes(`"${f}"`) && !y.includes(`'${f}'`));
  if (missing.length) fail(`deploy.yml の paths に無い配布物: ${missing.join(', ')}`);
  else ok(`deploy.yml の paths が配布物 ${REQUIRED.length} 点すべてを網羅`);
  for (const f of REQUIRED) {
    if (!new RegExp(`aws s3 cp ${f.replace('.', '\\.')}`).test(y))
      warn(`deploy.yml に ${f} の S3 コピーが見当たらない`);
  }
}

/* ------------------------------------------------------------- 3. HTML 各種 */
const htmlFiles = REQUIRED.filter(f => f.endsWith('.html') && existsSync(f));

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const markup = staticMarkup(html);

  /* 3-1 インライン JS の構文。
     実例：正規表現のエスケープが 1 文字崩れて SyntaxError になり、
     ページが真っ白になったことがある。構文エラーは必ず止める。
     type が JavaScript 以外のもの（JSON-LD など）は JS として読まない。 */
  const isJsType = (attrs) => {
    const m = /\stype\s*=\s*["']([^"']+)["']/i.exec(attrs);
    if (!m) return true;                       /* 未指定は JS */
    return /^(text\/javascript|application\/javascript|module)$/i.test(m[1].trim());
  };
  const blocks = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(m => !/\ssrc\s*=/i.test(m[1]));
  let jsCount = 0, jsonldCount = 0, bad = 0;
  for (const m of blocks) {
    const [full, attrs, code] = m;
    if (!code.trim()) continue;
    const line = html.slice(0, m.index).split('\n').length;
    if (isJsType(attrs)) {
      jsCount++;
      try { new vm.Script(code, { filename: `${file}#L${line}` }); }
      catch (e) { bad++; fail(`${file}: <script>（${line} 行目付近）に構文エラー — ${e.message}`); }
    } else if (/json/i.test(attrs)) {
      /* 構造化データ（application/ld+json）。JSON として壊れていれば
         検索エンジンに読まれないので、こちらは JSON として検証する。 */
      jsonldCount++;
      try { JSON.parse(code); }
      catch (e) { bad++; fail(`${file}: 構造化データ（${line} 行目付近）が不正な JSON — ${e.message}`); }
    }
  }
  if (!bad) ok(`${file}: インライン JS ${jsCount} ブロック＋構造化データ ${jsonldCount} 件、いずれも構文 OK`);

  /* 3-2 id の重複。querySelector('#x') が別物を掴む事故のもと。
     JS が組み立てる HTML は分岐ごとに同じ id を書くのが正常（同時に 1 つしか
     描画されない）ので、静的マークアップだけを見る。 */
  const ids = [...markup.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  const dup = [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))];
  if (dup.length) fail(`${file}: 静的マークアップの id が重複 — ${dup.slice(0, 8).join(', ')}`);
  else ok(`${file}: id 重複なし（静的 ${ids.length} 個）`);

  /* 3-3 lang 属性。多言語サイトなので、空だと読み上げが言語を決められない。 */
  const langs = [...markup.matchAll(/<html[^>]*\slang="([^"]*)"/gi)].map(m => m[1]);
  if (!langs.length) fail(`${file}: <html lang> が無い`);
  else if (!langs[0].trim()) fail(`${file}: <html lang> が空`);
  else ok(`${file}: <html lang="${langs[0]}">`);

  /* 3-4 主要タグの開閉。全文パースはしないが、数が合わなければ構造が壊れている。 */
  let tagBad = 0;
  for (const tag of ['html', 'head', 'body', 'main', 'header', 'footer', 'nav', 'table']) {
    const o = (markup.match(new RegExp(`<${tag}(\\s|>)`, 'gi')) || []).length;
    const c = (markup.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
    if (o !== c) { tagBad++; fail(`${file}: <${tag}> の開閉が不一致（開 ${o} / 閉 ${c}）`); }
  }
  if (!tagBad) ok(`${file}: 主要タグの開閉が一致`);
}

/* --------------------------------------------------- 3-4b app.css の健全性 */
/* 全文パースはしないが、波括弧の対応が崩れていれば以降の規則がすべて死ぬ。
   index.html から切り出したので、ここが壊れると画面が素の HTML になる。 */
if (existsSync('app.css')) {
  const css = readFileSync('app.css', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');          /* コメントを除いて数える */
  const o = (css.match(/\{/g) || []).length;
  const c = (css.match(/\}/g) || []).length;
  if (o !== c) fail(`app.css: 波括弧の対応が不一致（{ ${o} / } ${c}）`);
  else ok(`app.css: 波括弧の対応が一致（${o} ブロック）`);
  if (/<\s*(script|html|body|style)\b/i.test(css)) fail('app.css に HTML が混入している');
}

/* ------------------------------------------- 3-5 分離した外部 JS の構文 */
/* index.html から切り出したので、こちらが壊れると本体ごと動かなくなる。 */
for (const f of REQUIRED.filter(x => x.endsWith('.js') && existsSync(x))) {
  try {
    new vm.Script(readFileSync(f, 'utf8'), { filename: f });
    ok(`${f}: 構文 OK`);
  } catch (e) {
    fail(`${f}: 構文エラー — ${e.message}`);
  }
}

/* -------------------------------------- 3-6 index.html が外部 JS を読んでいるか */
/* 切り出したのに <script src> を書き忘れる／順番を間違えると本体が動かない。
   i18n → データ層 → 本体 の順である必要がある（KT は i18n で定義される）。 */
if (existsSync('index.html')) {
  const h = readFileSync('index.html', 'utf8');
  const cssAt = h.indexOf('href="app.css"');
  const iAt = h.indexOf('src="app.i18n.js"');
  const dAt = h.indexOf('src="app.data.js"');
  const aAt = h.indexOf('src="app.js"');
  const headEnd = h.indexOf('</head>');
  if (cssAt < 0) fail('index.html が app.css を読み込んでいない');
  else if (headEnd >= 0 && cssAt > headEnd) fail('app.css は <head> 内に置くこと（ちらつき防止）');
  if (iAt < 0) fail('index.html が app.i18n.js を読み込んでいない');
  else if (dAt < 0) fail('index.html が app.data.js を読み込んでいない');
  else if (aAt < 0) fail('index.html が app.js を読み込んでいない');
  else if (!(iAt < dAt && dAt < aAt))
    fail('読み込み順が不正：app.i18n.js → app.data.js → app.js の順に置くこと');
  else ok('index.html の読み込み順: app.css(head) → app.i18n.js → app.data.js → app.js');
  /* type="module" は file:// で動かないので使っていないことを確認 */
  if (/<script[^>]*type\s*=\s*["']module["']/i.test(h))
    fail('type="module" は file:// で読み込めないため使わないこと');
}

/* ---------------------------------------------- 4. i18n 辞書のキー欠落 */
/* 既存の回帰テスト struct.js と同じ検査を、ブラウザ無しで行う。
   キーが 1 言語だけ欠けると、その言語で日本語がそのまま出る（KT は ja へ落ちる）。 */

/* 意図的に一部言語だけに置くキー。理由をここに残す。
   u_oku / u_man は「億」「万」。CJK は 1e8 / 1e4 で区切るが、英独西仏は
   1.1B / 800M と別の分岐で組み立てるため、そもそも参照されない。
   実測で en/de/es/fr の表示が 1.1B / 800M になっていることを確認済み。 */
const CJK_ONLY_KEYS = new Set(['u_oku', 'u_man']);

/* R36：辞書は app.i18n.js に移したので、そちらを読む。
   分離前の index.html でも動くよう、無ければ index.html を見る。 */
const I18N_FILE = existsSync('app.i18n.js') ? 'app.i18n.js' : 'index.html';
if (existsSync(I18N_FILE)) {
  const html = readFileSync(I18N_FILE, 'utf8');
  const LANGS = ['ja', 'en', 'zh', 'ko', 'de', 'es', 'fr'];
  const CJK   = new Set(['ja', 'zh', 'ko']);

  const sandbox = { window: {}, navigator: { languages: ['ja'] } };
  vm.createContext(sandbox);
  const dictBlocks = [...html.matchAll(
    /window\.(KB_I18N(?:_[A-Z0-9]+)?)\s*=\s*\{[\s\S]*?\n\};/g)];
  let loaded = 0;
  for (const m of dictBlocks) {
    try { vm.runInContext(m[0], sandbox, { timeout: 5000 }); loaded++; } catch { /* 読めないものは飛ばす */ }
  }

  /* 宣言されている辞書の数。正規表現が掴む「塊」は複数の宣言をまとめて
     含むことがあるので、塊の数ではなく**実際に定義されたオブジェクトの数**を
     宣言数と突き合わせる。ここがずれていたら検査が一部を見落としている。 */
  const declared = [...html.matchAll(/window\.KB_I18N(?:_[A-Z0-9]+)?\s*=\s*\{/g)].length;
  const defined = Object.keys(sandbox.window).filter(k => /^KB_I18N/.test(k)).length;
  if (!loaded) warn('i18n 辞書ブロックを 1 つも読み込めなかった（検査を飛ばす）');
  else if (defined !== declared) {
    fail(`i18n: 辞書 ${declared} 個のうち ${defined} 個しか読めていない（検査が不完全）`);
  }
  else {
    const merged = Object.fromEntries(LANGS.map(l => [l, {}]));
    for (const [name, obj] of Object.entries(sandbox.window)) {
      if (!/^KB_I18N/.test(name) || !obj || typeof obj !== 'object') continue;
      for (const l of LANGS) if (obj[l]) Object.assign(merged[l], obj[l]);
    }
    const jaKeys = Object.keys(merged.ja);
    if (!jaKeys.length) warn('ja の辞書が空（検査を飛ばす）');
    else {
      const problems = [];
      for (const l of LANGS) {
        if (l === 'ja') continue;
        const miss = jaKeys.filter(k => merged[l][k] === undefined)
          /* CJK 専用キーは、非 CJK 言語で欠けていて当然 */
          .filter(k => !(CJK_ONLY_KEYS.has(k) && !CJK.has(l)));
        if (miss.length) problems.push(`${l}: ${miss.length} 件（${miss.slice(0, 5).join(', ')}）`);
      }
      if (problems.length) fail(`i18n のキー欠落 — ${problems.join(' / ')}`);
      else ok(`i18n: ${jaKeys.length} キー × ${LANGS.length} 言語、欠落なし（${I18N_FILE} の辞書 ${defined}/${declared} 個）`);
    }
  }
}

/* ------------------------------------------------------------------ 出力 */
const line = '─'.repeat(70);
console.log(line);
for (const m of oks)   console.log(`  OK    ${m}`);
for (const m of warns) console.log(`  警告  ${m}`);
for (const m of fails) console.log(`  失敗  ${m}`);
console.log(line);
console.log(`OK ${oks.length} / 警告 ${warns.length} / 失敗 ${fails.length}`);

if (fails.length) {
  console.log('\n失敗があります。マージ前に直してください。');
  process.exit(1);
}
console.log('\n静的検証は通過しました。');
