# owd-knowledge-hub

**OneWonder 知识中枢 · 公开站** — 对外公开信息的高光分析 + 自社 AI 实验室的实验产出。

- 主站（GitHub Pages）：<https://onewonderjapan.github.io/owd-knowledge-hub/>
- 吉祥物互动页「Wonder4ge 小屋」：<https://onewonderjapan.github.io/owd-knowledge-hub/mascot.html>

## 仓库结构

| 路径 | 内容 | 维护方 |
|---|---|---|
| `index.html` | 知识中枢主站（AI 情报观察 / AI 实验室 / 关于我们），单文件自包含 | S1（按内容生产线构建导出更新） |
| `mascot.html` | Wonder4ge 小屋（吉祥物互动页） | S1 |
| `mascot-assets/` | Wonder4ge 正典立绘与表情差分裁切图（**禁止 AI 重绘/改色，只许缩放展示**） | 总控受控资产 |
| `design/` | 设计稿目录 | **设计负责人** |

## 协作流程（本站更新方向由设计负责人主导）

1. **设计负责人**：产出新版设计稿（PNG / Figma 导出 / 设计说明 Markdown），上传到本仓库 `design/` 目录：
   - 文件命名：`YYYYMMDD-主题-vN`（例：`20260910-home-hero-v2.png`）
   - 每次上传在 `design/README.md` 的清单表中登记一行：日期、文件、变更要点、优先级
2. **S1（开发）**：定期 `git pull` 拉取 `design/` 最新设计稿 → 按稿开发 → 更新 `index.html` / `mascot.html` 等站点文件 → push 到 `main` 即自动发布（GitHub Pages）。
3. **职责边界**：设计负责人不改站点代码，S1 不改设计稿；实现与设计稿有出入时以设计稿为准。紧急内容修正（错字、数据错误）S1 可直接改，事后在 commit message 注明。

## 内容更新（知识库数据）

知识库笔记内容由内部生产线构建导出为单文件 `index.html`（含全部公开笔记数据，已通过泄漏检查）。更新方式：用最新构建产物整文件替换根目录 `index.html`，commit 说明数据窗口期即可。

## 架构方向（结构-内容分离）

- **本仓库 = 页面结构**：HTML/CSS/JS 与协作规范，部署在 GitHub Pages。
- **内容/媒体 = 指定 S3**：视频、图片、实验数据等由其他仓库的生产线更新，上传到指定 S3 bucket；本页面通过公开 URL 引用/拉取展示。
- **迁移计划**：`mascot-assets/`（约 20MB 正典立绘）暂存本仓库保证页面可用，S3 bucket 就绪后作为第一批媒体迁移对象，页面引用改为 S3 URL。
- **数据拆分（目标态）**：当前 `index.html` 内嵌全部公开笔记数据；后续将笔记数据抽为 S3 上的 `kb-data.json` + `manifest.json`（含版本号），页面启动时拉取渲染——内容更新不再改动本仓库。
- **S3 侧要求**：bucket 对 `onewonderjapan.github.io` 开 CORS（或绑自定义 CDN 域）、媒体文件用 hash 文件名配长缓存、manifest 短缓存、上传方用最小权限凭证。

## 已知占位项（上线前待办）

- 联系邮箱当前为 `contact@example.com` 占位，正式上线前替换为真实邮箱（涉及 index.html 内 3 处）。

## 红线

- 本仓库**只放公开内容**：客户项目资料、内部笔记源文件、内部编排记录一律不得进入本仓库。
- `mascot-assets/` 内为正典形象资产：禁止任何 AI 重绘、改色、二次创作，只允许缩放展示与按既有规范裁切。
