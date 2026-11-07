# ROADMAP — owd-knowledge-hub

> **定位**：OneWonder 知识中枢公开站（正式站 hub.onewonder.co.jp，CloudFront + GitHub Pages 备用镜像）——本仓只承载页面结构（index.html / mascot.html 单文件自包含），知识数据由 S1 生产线发布到 CDN `data/kb-data.json` 页面启动时拉取；push main 经 OIDC 自动部署。

## P0 事故残留收口与数据链核实（零成本）

- [ ] P0-1 核实并处置 Issue #5（2026-09-15 泄漏事件残留，关闭条件已写明）：在可联网环境跑 `node tools/data-check.mjs`（CDN 实际产物）——全绿则在 issue 附输出关闭；仍红则按 ai-ops `runbooks/2026-09-15-khub-cdn-internal-leak/` 续办并报告机主——验收：issue #5 有 data-check 输出附件并进入 closed，或红结果上报
- [ ] P0-2 data-check 全量基线固化：把 conclusions / boards / heat / today / watchlist 抽取文本检查跑出的当前结果（绿）存入 `tools/fixtures/` 作为回归 fixture——验收：`node tools/data-check.mjs --file tools/fixtures/<新基线>.json` 可复现全绿，断网也能验
- [ ] P0-3 页面对旧数据的降级兼容实测：构造缺 `verified` 字段 / 缺 `stats.claims_verified` 的 kb-data.json 副本，本地打开 index.html 验证「未验证/按 0 处理」口径（README 部署顺序约定）——验收：实测截图或记录入 PR，两种缺失均不抛错、不夸大
- [ ] P0-4 GitHub Pages 备用镜像与正式站一致性核对：对比 `onewonderjapan.github.io/owd-knowledge-hub/` 与 `hub.onewonder.co.jp` 的 index.html 版本（页面结构与 CDN 数据口径）——验收：差异结论（一致/滞后 N commit）记入本 ROADMAP 或 PR
- [ ] P0-5 design/ 断供处置：design/README.md 清单自 2026-09-11 初始化后 0 条设计稿（仅示例行），而协作流程约定「更新方向由设计负责人主导」——向机主出裁定请求（续等设计稿 / 改为 S1 自主迭代 + 事后报备），按裁定更新 README「协作流程」节——验收：README 与实际工作方式一致

## P1 站点质量与门禁（零成本）

- [ ] P1-1 `tools/pr-check.mjs` 补三件「本番に入ると困るもの」：外链 CDN 资源可达性（构建时静态列表）、`index.html` 内嵌数据与 CDN 字段名 drift 检测、mascot.html 图片引用全为 `cdn.onewonder.co.jp` 前缀——验收：三类故意坏例在本地跑 pr-check 均被拦，CI 绿
- [ ] P1-2 i18n 文案抽查：app.i18n.js（7 语言）抽 2 语言对首页导语做母语级复查（沿 2026-09-27 文案排查先例，防「全部经数据验证」式过度表述回流）——验收：修订（如需）走 PR 并附前后对照
- [ ] P1-3 og.png / SNS 卡片实效核验：deploy.yml 注释记载过 og:image 404 被 SNS 缓存的事故——用 Twitter/Facebook/Line 的卡片调试器各验一次当前 URL——验收：三大平台卡片均渲染，结果记入 PR
- [ ] P1-4 `manifest.json`（CDN）版本号与 git 部署记录对齐检查：页面每次 deploy 后 CDN manifest 版本是否随数据/媒体更新——验收：对齐规则写成一篇检查清单入 `tools/` 同级文档

## P2 站点能力扩展（需机主授权 / 花钱项标注）

- [ ] P2-1 站内搜索（前端索引 kb-data.json 的 client-side 搜索）——零成本可做；若接云端搜索服务需机主批 API key
- [ ] P2-2 多语言子路径（/en /ja /zh 独立 URL）+ hreflang——设计工作量需设计负责人立项；实现零成本
- [ ] P2-3 CDN WAF / 访问分析（CloudFront 标准日志入分析）——AWS 侧配置需机主授权（infra 为 Terraform 内部管理）；日志分析可能产生少量费用
- [ ] P2-4 mascot.html 新内容（新表情/场景）——正典形象新素材须设计负责人产出源文件，AI 只做缩放裁切（红线），不可 AI 生成

## 冻结项（不做）

- 本仓只放公开内容：客户项目资料、内部笔记源文件、内部编排记录一律不入仓
- 正典形象资产（CDN `media/mascot/` 与内部源文件）禁止任何 AI 重绘、改色、二次创作，只允许缩放展示与按规范裁切
- 知识数据不经本仓发布：内容更新只走 S1 `kb.py build` + `publish-cdn`；上传内容视同公开，先过泄漏扫描
- 设计负责人不改站点代码，S1 不改设计稿；Bot 协作轨三分支默认不合入 main（例外须机主令），专管 Bot 禁止 push main

## 依据（2026-11-08 读仓）

- 开放 issue：#5（2026-09-15 CDN 泄漏残留，关闭条件=`node tools/data-check.mjs` 全绿，处置见 ai-ops runbooks/2026-09-15-khub-cdn-internal-leak/）
- 工具链现状：tools/（data-check.mjs、pr-check.mjs、render-check.mjs + 1 fixture）、CI deploy.yml（OIDC→AWS）与 pr-check.yml；design/ 清单自初始化后 0 条设计稿
- 红线来源：README「红线」「协作流程」「架构」三节与 deploy.yml/pr-check.yml 头注释（og:image 404 事故记录）

<!-- draft by knowledge-ops expert agent, 待机主圈改 -->
