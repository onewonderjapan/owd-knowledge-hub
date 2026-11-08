/**
 * render-check — データ由来の値が HTML の属性から抜け出さないかを確かめる小さな回帰テスト
 *
 * 背景（2026-09-27 grok レビュー HIGH）：
 *   テーマ詳細の出来事カードが recent_events[].change_type を class 属性へ素のまま
 *   連結しており、`"><img src=x onerror=alert(1)>` のような値で任意の HTML を差し込めた。
 *   修正後は evCardHTML（app.js のトップレベル）が閉じた対応表で class を決め、
 *   文字はすべてエスケープする。ここではその関数を DOM 無しで直接呼んで確かめる。
 *
 *   あわせて data-check.mjs が「JSON のどこに社内名が入っても落ちる」ことを、
 *   わざと漏らした fixture（tools/fixtures/leak-boards-kw.json）で確かめる。
 *
 * 使い方：node tools/render-check.mjs   （リポジトリのルートで実行。失敗なら exit 1）
 * 依存パッケージなし（Node 標準のみ）。
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';

const fails = [];
const oks = [];

/* ---------------------------------------------- 1. evCardHTML の属性エスケープ */
{
  const ctx = vm.createContext({ window: {}, console });
  try {
    /* app.js 末尾の起動処理（kbBoot）は document が無いので例外になるが、
       トップレベルの関数宣言と、それより前の const はその時点で定義済み。 */
    vm.runInContext(readFileSync('app.js', 'utf8'), ctx, { filename: 'app.js' });
  } catch (e) { /* 想定内（DOM が無い） */ }
  let fn;
  try { fn = vm.runInContext('typeof evCardHTML === "function" ? evCardHTML : null', ctx); } catch (e) { fn = null; }
  if (!fn) {
    fails.push('app.js のトップレベルに evCardHTML が見つからない（名前を変えたらこの検査も直すこと）');
  } else {
    const PAYLOAD = '"><img src=x onerror=alert(1)>';
    const cases = [
      { change_type: PAYLOAD, date: '2026-09-27', title: 't' },
      { change_type: 'new', date: PAYLOAD, title: PAYLOAD },
      { change_type: 'new" onmouseover="alert(1)', date: '', title: '' },
    ];
    for (const c of cases) {
      const html = String(fn(c));
      if (/<img/i.test(html)) fails.push(`evCardHTML: <img が出力された — ${html}`);
      const cls = /class="([^"]*)"/.exec(html);
      if (!cls || !/^evcard (new|updated|watch|ev-other)$/.test(cls[1])) fails.push(`evCardHTML: class が対応表の外 — ${html}`);
      /* タグは自前の div 2 組（開き 2・閉じ 2）だけのはず。値からタグや属性が生えていないか */
      if ((html.match(/</g) || []).length !== 4) fails.push(`evCardHTML: 余分なタグがある — ${html}`);
      if ((html.match(/"/g) || []).length !== 4) fails.push(`evCardHTML: 属性の引用符が増えている（属性から脱出） — ${html}`);
    }
    const known = String(fn({ change_type: 'updated', date: 'd', title: 't' }));
    if (!/class="evcard updated"/.test(known)) fails.push(`evCardHTML: 既知の change_type が対応する class にならない — ${known}`);
    if (!fails.length) oks.push('evCardHTML: 攻撃的な change_type / date / title でも <img や属性の脱出が起きない');
  }
}

/* ------------------------------------- 2. data-check が漏れ fixture で落ちるか */
{
  const r = spawnSync(process.execPath, ['tools/data-check.mjs', '--file', 'tools/fixtures/leak-boards-kw.json'], { encoding: 'utf8' });
  if (r.status !== 1) fails.push(`data-check: 漏れ fixture で exit 1 にならない（exit ${r.status}）`);
  else if (!/boards\.t\.kw\[0\]\[0\]: ark-harness/.test(r.stdout)) fails.push('data-check: 漏れ fixture の検出箇所（boards.t.kw）が報告されない');
  else oks.push('data-check: boards.t.kw に社内名を入れた fixture を検出（exit 1）');
}

for (const m of oks) console.log(`  OK    ${m}`);
for (const m of fails) console.log(`  失敗  ${m}`);
console.log(`OK ${oks.length} / 失敗 ${fails.length}`);
process.exit(fails.length ? 1 : 0);
