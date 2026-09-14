# Grok 建议 · 2026-09-14 · 追上 main、回写旧 inbox、收口 PR 与结构红线

- 条目 ID：GK-20260914-01
- 仓：onewonderjapan/owd-knowledge-hub
- 分支：grok/knowledge
- 模型：grok-4.6 / xhigh
- 专管 Bot：管知识中枢的
- 类：建议
- 机密分级：L1
- 状态：待开发阅读

## 摘要

本周知识轨可执行工作只有五件，且顺序固定：先把 `grok/knowledge` 追上已含 09-13 机主合入的 `main`，再在追上后的 tip 上落本条目；回写 GK-20260911-01 / GK-20260912-01 的阅读状态（文件进 main ≠ 建议被采纳）；处理 `design/` 空窗（仅 README、登记表无实稿）；把 PR #1 / #2 从过期 base 与过期「三轨永不进 main」表述里拉出来，并与 CR P0 边界对齐；全程守住「本仓=页面结构、知识数据走 CDN、正典形象禁止 AI 重绘改色、默认不 push main」。新建议默认仍只推 `grok/knowledge` 的 `grok-inbox/`。inbox 历史条目已在 `main` 可见，不改变今后默认轨。

本周自动化因无法在 push 前改写分支历史，**有意在落后 tip `eda08b74` 续写**；开发 agent 追上 `main@785d256` 后需再对齐，不要静默分叉。

## 依据（可核对引用；未核实须标明）

1. 已核实分支 tip（2026-09-14）：`main@785d256`；`grok/knowledge@eda08b74`；`claude/review@632c098`；`grok/feedback@20de8ba`；`feature/home-redesign@015eacf`；`chore/bot-collab-track-20260911@b408f86`。`main` 超前于 `grok/knowledge` tip。
2. 已核实：2026-09-13 机主下令后，`main` 已 merge 合入 `grok/knowledge` 与 `grok/feedback`（merge commits 在 `main` 历史）。此为机主例外合入，不是专管 Bot 今后可自行 push `main` 的授权。
3. 已核实：`main` 根目录现含 `index.html`、`mascot.html`、`design/`、`.github/`、`grok-inbox/`、`grok-feedback/`。inbox 历史条目在 `main` 可见，但今后新建议默认仍只推 `grok/knowledge`。
4. 已核实：`design/` 仅 `README.md`，登记表无实稿。设计轨目前是空窗，不是「已有设计稿待评审」。
5. 已核实 README 硬边界：本仓=页面结构；知识数据 CDN 为 `https://cdn.onewonder.co.jp/data/kb-data.json`；禁止内部笔记源进本仓；正典形象禁止 AI 重绘改色；push `main` 触发 Actions→AWS。
6. 已核实：GK-20260911-01、GK-20260912-01 状态仍为「待开发阅读」；本周截至本条目写作为止尚无更新的状态回写。两份文件出现在 `main` 只证明「建议原文被机主合入可见」，不证明其中条款已被开发 agent 执行。
7. 已核实开放 PR：#1 `feature/home-redesign`（tip `015eacf`，base 仍指旧 `main@c6da622`）；#2 Bot 协作轨文档（`chore/bot-collab-track-20260911@b408f86`，PR 正文仍写「三轨不合并进 main」）。#2 表述与 09-13 机主合入例外并存，文档已过期，需澄清「默认三轨不进 main / 机主可例外合入 / 专管不得把例外当常规」。
8. 已核实多 Bot §8–§9：专管只写 `grok/knowledge` 的 `grok-inbox/`；开发 agent 把 inbox 当建议而非工单强制；默认不因本规则 push `main`。
9. 【未核实假设】GK-20260911-01 / GK-20260912-01 正文中哪些条款已落地、哪些仍未做，本条目未逐条打开原文核对；回写「已采纳 / 部分采纳 / 未采纳」必须以对照 `main@785d256` 实际文件与行为为准，不得因「文件已在 main」批量改成已采纳。
10. 【未核实假设】PR #1 的视觉/结构改动是否触碰正典形象、是否把知识正文或内部笔记源塞进本仓、是否与 CR P0 冲突，需开发 agent 在 rebase 到当前 `main` 后对照 diff，不在本条目里预先定罪或放行。
11. 【未核实假设】CR P0 的完整清单若写在 `claude/review@632c098` 或未进本仓的评审记录中，本条目未核对其全文；执行时以仓库内可核对的评审结论为准，缺失则先补引用再改代码。
12. 【未核实假设】CDN `kb-data.json` 的现场内容、Actions→AWS 的具体 workflow 文件名与目标环境，本条目未拉取核对；只重申 README 已写明的红线。

## 建议开发 agent 下一步

按下列顺序做，不要并行打乱依赖。

1. 先同步知识轨，再吸收本条目。
   - 以 `main@785d256` 为上游，把 `grok/knowledge` 从 `eda08b74` 追上（rebase 或 merge，选能保留 inbox 历史、且不改写 `main` 的方式）。
   - 本周自动化已在落后 tip 落盘 `GK-20260914-01`；追上后核对本文件仍在、无冲突，再继续后续步骤。
   - 推送目标仅 `grok/knowledge`。不要 push `main`，不要打开「由专管直接合入 main」的 PR，除非机主当场再下一道与 09-13 同级的明确令。

2. 回写旧条目状态（本周债，优先于新功能）。
   - 打开 GK-20260911-01、GK-20260912-01，逐条对照 `main@785d256` 已存在的页面结构、`design/`、`.github/`、开放 PR 与 README 红线。
   - 状态只允许写成：已采纳 / 部分采纳 / 未采纳 / 作废（机主例外导致前提变化）。每一条写一句「对照了什么 SHA / 什么路径」；禁止整份改成已采纳。
   - 「inbox 文件出现在 main」只记为「原文已可见」，单独一行即可，不要和「建议条款已执行」混为一谈。
   - 回写也走 `grok/knowledge` 的 inbox 更新，不直接改 `main`。

3. 处理 `design/` 空窗，不要假装有稿。
   - 现状：仅 `README.md` + 登记表无实稿。开发 agent 若要动首页/吉祥物/视觉，先补最小设计登记（问题、范围、非目标、正典约束），再改 `index.html` / `mascot.html`。
   - 空窗期间：不把 AI 生成图、改色、重绘正典形象、或「先做一版再补设计」当作设计稿。
   - 不把知识条目、内部笔记、CDN 应承载的内容写进 `design/` 充数。

4. 收口 PR #1：`feature/home-redesign`。
   - 先把 base 从旧 `main@c6da622` 变基/重对到当前 `main@785d256`，再谈合并。对着过期 main 评视觉与结构没有意义。
   - 变基后做一次红线 diff：是否只动页面结构；是否引入知识正文或内部笔记源；是否 AI 重绘/改色正典形象；是否误触会随 push `main` 上 AWS 的发布面。
   - 与 CR P0 对齐：P0 未关或变基后仍触发 P0，则 PR #1 保持开放、不合并；只修 P0 与结构问题，不顺手扩范围。
   - 【未核实假设】若 CR P0 原文不在本 PR 讨论区，先把可核对引用补进 PR 描述，再改代码。

5. 收口 PR #2：Bot 协作轨文档。
   - 文档必须改掉「三轨不合并进 main」这种已过期的绝对句，改为三层事实：默认三轨（`grok/knowledge`、`grok/feedback`、`claude/review` 等）不合并进 `main`；2026-09-13 机主已例外把 knowledge/feedback 合入，这是一次性（除非机主再令）；专管 Bot 与开发 agent 不得把该例外解释成常规发布权。
   - 写明 inbox 历史在 `main` 可见 ≠ 新建议可写 `main`。新建议仍只进 `grok/knowledge` 的 `grok-inbox/`。
   - 写明开发 agent 对 inbox 的义务：阅读、回写状态、按建议执行或标明不执行原因；不是把 inbox 当自动合入许可证。
   - PR #2 是文档轨，不要夹带 `index.html` / `mascot.html` / 设计实稿 / CDN 数据。

6. 守住结构/内容分离，作为本周所有 diff 的合并门。
   - 本仓可改：页面结构、导航/布局、设计登记与设计实稿（有稿之后）、Bot 协作说明、inbox/feedback 文本。
   - 本仓不可改：知识数据本体（走 `https://cdn.onewonder.co.jp/data/kb-data.json`）、内部笔记源、正典形象的 AI 重绘与改色。
   - 任何「把 kb 片段先塞进仓库方便预览」的捷径都拒绝。预览应对 CDN 或本地 mock，不落正典数据到 git。
   - 需要上线时由有权限的人 push/合入 `main`（会触发 Actions→AWS）；专管默认路径到 `grok/knowledge` 为止。

7. 本周明确不排期的事。
   - 不新开第三条功能 PR 去「顺便」重做首页或吉祥物。
   - 不把 `claude/review` 或 `grok/feedback` 的职责写进本条目当自己的执行项。
   - 不要求为本条目单独发布 AWS；inbox 不是发布物。

## 明确不要做什么

- 不要在 `grok/knowledge@eda08b74` 落后于 `main@785d256` 时静默追加新 inbox，造成第三份分叉历史（本条已标明「有意续写」；追上后需对齐）。
- 不要因 09-13 机主合入、或因 inbox 已在 `main` 可见，就 push `main`、对 `main` 直接提交、或把本条目当成发布工单。push `main` 会触发 Actions→AWS。
- 不要把 GK-20260911-01 / GK-20260912-01 仅因文件出现在 `main` 就改成「已采纳」。
- 不要在 `design/` 仍无实稿时用 AI 出图、改色、重绘正典形象，或把生成图提交为页面资源。
- 不要把内部笔记、知识正文、kb-data 快照、或 CDN 应承载的内容提交进本仓。
- 不要合并仍以 `c6da622` 为 base 的 PR #1；不要在未变基、未过红线 diff、未对齐 CR P0 时合入。
- 不要让 PR #2 继续宣称「三轨永不进 main」而不记载 09-13 例外；也不要把该例外写成专管可常规合入 `main`。
- 不要用本条目扩大专管权限（仍只写 `grok/knowledge` 的 `grok-inbox/`）；不要要求开发 agent 把建议当强制工单、不读就做、或做完不回写状态。
- 不要在同一 PR 里混装：inbox 文本 + 首页结构 + 吉祥物 + 协作文档 + 设计实稿。
- 不要把未核实项写成已核实。上文标了【未核实假设】的，先核对再执行。
