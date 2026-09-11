# Grok 建议 · 2026-09-11 · 上线后一周：分离纪律、design 卫生、inbox 节奏

- 条目 ID：GK-20260911-01
- 仓：onewonderjapan/owd-knowledge-hub
- 分支：grok/knowledge
- 模型：grok-4.6 / xhigh
- 专管 Bot：管知识中枢的
- 类：建议
- 机密分级：L1
- 状态：待开发阅读

## 摘要

首轮公开站已上线（hub.onewonder.co.jp），本仓只承载页面结构；知识正文在 CDN `kb-data.json`。建议开发 agent 本周只做三件事：在 `grok/knowledge` 落盘本 inbox、保持 `design/` 空目录卫生、按只读建议节奏读 inbox。不改公开 KB、不碰 CDN、不 push `main`。

## 依据（可核对引用 / 未核实假设须标明）

1. README：公开站 `hub.onewonder.co.jp`；`mascot.html` 为 Wonder4ge 小屋；Pages 为备用镜像。
2. 本仓路径仅 `index.html`、`mascot.html`、`design/`、`.github`；`design/` 命名 `YYYYMMDD-主题-vN`；设计负责人主导 `design/`，S1 实现站点文件。
3. 结构/内容分离已落地：知识数据 `https://cdn.onewonder.co.jp/data/kb-data.json`；内容更新不改本仓；mascot 图走 CDN `media/mascot/`。
4. 红线：客户资料/内部笔记源文件不得进本仓；正典形象禁止 AI 重绘改色。
5. 2026-09-11 分支：`main`、`grok/knowledge`、`feature/home-redesign`；`grok/knowledge` 与 `main` 同提交 `c6da622`；尚无 `grok-inbox/`。
6. `design/` 目前仅 `README.md`，未见登记中的设计稿文件。
7. 多 Bot 计划 §8–§9：专管本仓、分支 `grok/knowledge`、路径 `grok-inbox/`；每周 ≥1；开发 agent 只读 inbox 当建议；晋升门未决前不得 merge 公开 KB；Bot 不得把内部笔记源推进本仓、禁止直写 CDN。
8. `push main` 经 Actions OIDC 部署 AWS；内容生产线用 `publish-data.sh` 上传 CDN。
9. 【未核实假设】`feature/home-redesign` 是否已有未合并的首页改动、以及晋升门的具体审批人，本条目未核。

## 建议开发 agent 采取的下一步

1. **只在 `grok/knowledge` 工作。** `grok-inbox/README.md` 与本条目应已落在该分支（文件名：`grok-inbox/2026-09-11-structure-content-kickoff.md`，条目 ID：GK-20260911-01）。不要开向 `main` 的 PR，不要 merge。
2. **本周节奏（只读建议）。** 开发 agent 打开 inbox 后：记录「已读 + 采纳/搁置 + 一行理由」到同目录后续条目或 PR 描述；不把建议写成已合并事实。专管 Bot 本周至少再补 1 条（满足每周 ≥1）。
3. **结构/内容分离检查清单（只核本仓，不改 CDN）。**
   - 本仓 PR/diff 不得新增知识正文、客户资料、内部笔记源文件。
   - 站点若要展示 KB，只引用 `https://cdn.onewonder.co.jp/data/kb-data.json`，不把 JSON 拷进本仓。
   - mascot 资源只引用 CDN `media/mascot/`；禁止提交重绘/改色图。
   - 内容变更走既有 `publish-data.sh` 生产线，不在本仓「顺便改一笔」。
4. **`design/` 空目录卫生。** 在 `design/README.md` 明确：无登记稿时目录只保留 README；新稿必须 `YYYYMMDD-主题-vN`，由设计负责人放入；S1 不得把未登记草稿、内部笔记、KB 正文丢进 `design/`。当前仅 README 视为卫生合格，不要为「看起来空」而塞占位文件。
5. **与 `feature/home-redesign` 的边界。** 首页结构改动留在该功能分支，由设计负责人 + S1 处理；知识 Bot / inbox 不把首页视觉当 KB 内容来改。【未核实假设】若该分支已有设计稿，应先按命名规范登记进 `design/`，再改站点文件。

## 明确不要做什么

- 不要 `git push origin main`，不要绕过 Actions OIDC 直接部署。
- 不要把内部笔记源文件、客户资料、KB JSON、mascot 原图推进本仓。
- 不要直写 CDN，不要在本仓 PR 里「代跑」`publish-data.sh` 当内容发布。
- 不要 AI 重绘或改色正典形象。
- 不要在晋升门未决前 merge 任何公开 KB / 把 inbox 建议当作已上线事实。
- 不要把本条目内容写进 `index.html` / `mascot.html` 或 CDN `kb-data.json`。
