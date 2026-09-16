# Grok 建议 · 2026-09-16 · 合入后卫生：回写旧 GK、核 P0/拆分闭环、README 过期句

- 条目 ID：GK-20260916-01
- 仓：onewonderjapan/owd-knowledge-hub
- 分支：grok/knowledge
- 模型：grok-4.6 / xhigh
- 专管 Bot：管知识中枢的
- 类：建议
- 机密分级：L1
- 状态：待开发阅读

## 摘要

`main@db5cf53`（2026-09-15）已收口 home-redesign、claude/review、bot-collab-track 与再次整合 grok/knowledge；页面已拆为 `app.css` / `app.data.js` / `app.i18n.js` / `app.js`；CI 已有 `pr-check.yml` 与 `tools/data-check.mjs`、`pr-check.mjs`；政策已改为「默认三轨不进 main，机主可例外合入」。PR #1–#4 均已 MERGED，当前无开放 PR。知识轨已 fast-forward 到该 tip 后落本条，未改 `main`。

本周只做五件可核对卫生，不新开功能：①回写 GK-20260911-01 / GK-20260912-01 / GK-20260914-01 状态（进 main ≠ 已采纳）；②对照 CR-KHUB-20260911-01 的 P0（数据侧 scope 过滤、页面拦截）与拆分后页面 / CI 是否闭环；③`design/` 仍空窗（无实稿），已合入的 home-redesign 不视为设计债已结；④核 README 是否仍写「单文件自包含」；⑤专管继续只写 `grok/knowledge`。知识数据仍走 CDN，不 push `main`。

## 依据（可核对引用 / 未核实假设须标明）

1. 已核实：`main` tip `db5cf53`（2026-09-15）。近两周机主下令内容 review 后例外合入：09-13 合入 grok/knowledge 与 grok/feedback；09-15 合入 home-redesign、claude/review、bot-collab-track、以及再次整合 grok/knowledge。另有单文件拆分、CI 增补、自进化知识库可操作性改动、政策句改为「默认三轨不进 main，机主可例外合入」。例外合入 ≠ 专管可常态 push `main`。
2. 已核实：本轮开始前 `grok/knowledge` tip 为 `310736c`（GK-20260914-01）；专管已将该分支 fast-forward 到 `main@db5cf53` 再落本条目。仅推进知识轨 tip，未改 `main`。
3. 已核实：`main` 根目录现含 `index.html`、`mascot.html`、`app.css`、`app.data.js`、`app.i18n.js`、`app.js`、`og.png`、`design/`、`claude-review/`、`grok-inbox/`、`grok-feedback/`、`tools/`、`.github/`。
4. 已核实：`design/` 仍仅 `README.md`，登记表无实稿。home-redesign 已进 `main` 与「设计登记无实稿」同时成立。
5. 已核实：PR #1/#2/#3/#4 均已 MERGED；当前无开放 PR。GK-20260914-01 所提「追上 main、收口 PR #1/#2」的外部状态已发生，不等于 inbox 状态字段已被回写。
6. 已核实 README 仍强调：内容更新走 CDN `kb-data.json` + `publish-data.sh`；本仓只放公开内容；正典形象禁止 AI 重绘改色；Bot 只写 `grok/knowledge`，禁止专管 push `main`。
7. 已核实：`grok-inbox` 已有 GK-20260911-01、GK-20260912-01、GK-20260914-01 及 README。【未核实假设】这些条目 header「状态」是否已由开发回写为已采纳 / 部分采纳等。
8. 已核实：CR-KHUB-20260911-01 已在 `main` 的 `claude-review/`。【未核实假设】其 P0（数据侧 scope 过滤、页面拦截）是否已全部落地于线上 CDN / 当前 `main` 页面逻辑（拆分后的 `app.data.js` / `app.js`）以及 `tools/data-check.mjs` / `pr-check.mjs`。
9. 已核实：`main@db5cf53` 的 README 仓库结构表仍写 `index.html`「单文件自包含」，相对已拆分的 `app.css` / `app.data.js` / `app.i18n.js` / `app.js` 过期，应改表述。
10. 【未核实假设】线上 `https://cdn.onewonder.co.jp/data/kb-data.json` 现场是否已做 scope 过滤，本条目未拉取。

## 建议开发 agent 采取的下一步

按顺序做，短闭环；回写与核对优先于新功能。

1. **回写旧 GK 状态。** 打开 GK-20260911-01、GK-20260912-01、GK-20260914-01，逐条对照 `main@db5cf53` 路径与 PR #1–#4 已 MERGED 的事实。状态只允许：已采纳 / 部分采纳 / 未采纳 / 作废；每条写一句对照 SHA 或路径。可引用的已发生外部事实（供回写，本条不代填）：知识轨已 FF 到 `db5cf53`；PR #1–#4 已合；政策句已改；页面已拆分；CI 已加 pr-check。`design/` 空窗、结构/内容分离、禁止专管 push `main` 仍可能未结。「文件出现在 main」只记「原文已可见」，禁止整份改成已采纳。回写走 `grok/knowledge` 的 inbox 更新，不直接改 `main`。
2. **核 CR P0 与拆分后页面 / CI 是否闭环。** 打开 `claude-review/` 中 CR-KHUB-20260911-01，列出 P0：数据侧 scope 过滤、页面拦截。对照 `app.data.js` / `app.js` / `index.html`：拦截是否还在、是否随拆分丢失。对照 `tools/data-check.mjs`、`pr-check.mjs`、`.github` 的 `pr-check.yml`：CI 是否能拦住内部笔记 / 未过滤内容进本仓。CDN 侧只读核一次 `kb-data.json`（【未核实假设】）；缺失只记缺口，不要把笔记源推进本仓或直写 CDN。未闭环则只开结构/CI 修复 PR（范围仅缺口）；已闭环则写「对照路径 + SHA」，不要重复施工。
3. **处理 `design/` 空窗。** 现状仍仅 README、登记表无实稿。无 `YYYYMMDD-主题-vN` 实稿则不改首页 / 吉祥物 / 视觉，不补占位图。已合入的 home-redesign 若需补登记，由设计负责人补最小稿（问题、范围、非目标、正典约束），不要用 AI 出图充数，不要再开一轮 redesign。
4. **核 README 过期句。** 在 `main@db5cf53` 的 README 检索「单文件自包含」及「index.html 自包含」类表述。若仍写单文件：改为与现状一致——页面结构为 `index.html` + `app.css` / `app.data.js` / `app.i18n.js` / `app.js`；知识数据仍走 CDN + `publish-data.sh`；本仓仍只放公开内容。只改过期句，不借机扩 README、不把 inbox 正文抄进 README。
5. **专管边界不变。** 新建议只进 `grok/knowledge` 的 `grok-inbox/`。结构类改动走正常 PR → `main`（由有权限者合入）；知识数据走 CDN 生产线。09-13 / 09-15 机主例外合入不是专管常态 push `main` 的授权。

## 明确不要做什么

- 不要 `git push origin main`，不要因机主已例外合入就把本条当发布工单。
- 不要把内部笔记源、客户资料、`kb-data.json` 快照推进本仓；不要直写 CDN；不要代跑 `publish-data.sh`。
- 不要因 inbox 已在 `main` 可见，就把 GK-20260911-01 / GK-20260912-01 / GK-20260914-01 批量改成「已采纳」。
- 不要在 `design/` 无实稿时 AI 重绘 / 改色正典形象，或把生成图提交为页面资源；不要借 home-redesign 已合入再开一轮视觉重做。
- 不要把 CR P0 未核部分写成已落地；CDN 现场未拉就不声称数据侧过滤已生效。
- 不要再拆一次页面文件；拆分已在 `db5cf53` 发生。
- 不要把本条目写入 `index.html` / `app.*` 或 CDN。
- 不要扩大专管权限：本 Bot 只写 `grok/knowledge` 的 `grok-inbox/`。
