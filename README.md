# owd-knowledge-hub

**OneWonder 知识中枢 · 公开站** — 对外公开信息的高光分析 + 自社 AI 实验室的实验产出。

- 正式地址（AWS CloudFront）：<https://hub.onewonder.co.jp/>
- 吉祥物互动页「Wonder4ge 小屋」：<https://hub.onewonder.co.jp/mascot.html>
- 备用镜像（GitHub Pages）：<https://onewonderjapan.github.io/owd-knowledge-hub/>

## 仓库结构

| 路径 | 内容 | 维护方 |
|---|---|---|
| `index.html` | 知识中枢主站（AI 情报观察 / AI 实验室 / 关于我们），单文件自包含 | S1（按内容生产线构建导出更新） |
| `mascot.html` | Wonder4ge 小屋（吉祥物互动页），图片走 CDN（`https://cdn.onewonder.co.jp/media/mascot/`），本仓库不存图片 | S1 |
| `design/` | 设计稿目录 | **设计负责人** |

> 正典形象资产纪律：立绘与表情裁切禁止 AI 重绘/改色，只许缩放展示；源文件由内部受控管理，CDN 上的 `media/mascot/` 为发布副本。

## 协作流程（本站更新方向由设计负责人主导）

1. **设计负责人**：产出新版设计稿（PNG / Figma 导出 / 设计说明 Markdown），上传到本仓库 `design/` 目录：
   - 文件命名：`YYYYMMDD-主题-vN`（例：`20260910-home-hero-v2.png`）
   - 每次上传在 `design/README.md` 的清单表中登记一行：日期、文件、变更要点、优先级
2. **S1（开发）**：定期 `git pull` 拉取 `design/` 最新设计稿 → 按稿开发 → 更新 `index.html` / `mascot.html` 等站点文件 → push 到 `main` 即自动发布（GitHub Actions 经 OIDC 免密钥同步到 AWS，见 `.github/workflows/deploy.yml`，通常 1-2 分钟生效）。
3. **职责边界**：设计负责人不改站点代码，S1 不改设计稿；实现与设计稿有出入时以设计稿为准。紧急内容修正（错字、数据错误）S1 可直接改，事后在 commit message 注明。

## 内容更新（知识库数据）

**内容更新不再改动本仓库**。知识库笔记数据发布在 CDN：`https://cdn.onewonder.co.jp/data/kb-data.json`，页面打开时自动拉取最新版。

数据更新流程：

1. 在内部 workspace 运行数据发布脚本（本仓库不含该脚本）：构建 → 过泄漏护栏 → 上传 CDN → 更新 `manifest.json` 版本号。
2. 发布后在本仓库运行 `node tools/data-check.mjs`，确认线上产物不含内部数据（见下节）。
3. 页面侧的 `scope` / `type` 遮断只是安全网，不能替代第 1 步的数据侧过滤。

本仓库只承载页面结构：`index.html` / `mascot.html` 等页面文件变更才会触发自动部署（GitHub Actions → AWS）。

## 本地校验工具（`tools/*.mjs`）

两个脚本都只用 Node 标准库，不需要 `npm install`（Node 20+）。在仓库根目录执行：

```bash
node tools/pr-check.mjs     # 静态检查：产物齐全、HTML/CSS/JS 语法、i18n 键缺失
node tools/data-check.mjs   # 泄漏门禁：检查线上 kb-data.json 是否残留内部数据
```

`data-check` 的可选参数：

```bash
node tools/data-check.mjs --url <URL>     # 检查任意 URL
node tools/data-check.mjs --file <PATH>   # 检查本地 JSON（无需网络）
```

**遮断语列表不放在本仓库。** `data-check` 按以下顺序读取，两者都没有时只跳过「按词匹配」的那部分检查并给出警告（`scope` / `type` 结构性检查照常执行）：

1. 环境变量 `KHUB_INTERNAL_WORDS`：字符串的 JSON 数组，CI 从 secret 注入；
2. `tools/internal-words.local.json`：本地用，已加入 `.gitignore`。

格式见 `tools/internal-words.example.json`（占位符）。社内呼称、内部任务名、内部脚本路径等一律作为普通字符串放进同一个数组。检查失败时**不会输出词本身**（CI 日志是公开的），只给编号与命中次数。

页面侧（`app.data.js`）同样不内嵌词表：公开可见性只由数据里的 `scope` / `type` 决定；需要时可在加载脚本前提供 `window.KB_INTERNAL_WORDS`。

## 所需 secrets / vars（GitHub Actions）

| 类型 | 名称 | 用途 | 不配置时 |
|---|---|---|---|
| secret | `AWS_ROLE_ARN` | OIDC 换取 AWS 临时凭证 | 部署失败 |
| secret | `KHUB_INTERNAL_WORDS` | 泄漏门禁的遮断语列表（字符串 JSON 数组） | `data-check` 只跳过按词匹配的检查并警告，不失败 |
| var | `KHUB_BUCKET` | 站点 S3 bucket 名 | 部署步骤报错中止 |
| var | `KHUB_DISTRIBUTION_ID` | CloudFront distribution ID | 缓存失效步骤报错中止 |

配置位置：仓库 **Settings → Secrets and variables → Actions**（secrets 与 variables 两个页签）。

`deploy.yml` 会在上传任何文件**之前**先跑 `node tools/data-check.mjs`，失败即中止发布。

## 架构（结构-内容分离，已落地）

- **本仓库 = 页面结构**：HTML/CSS/JS 与协作规范。push 到 `main` 后由 GitHub Actions 经 OIDC（免密钥）同步到 AWS S3 + CloudFront，正式站为 `https://hub.onewonder.co.jp`；GitHub Pages 仅作备用镜像。
- **内容/媒体 = AWS S3 + CloudFront**：内容 bucket（全私有，仅 CloudFront OAC 可读；bucket 名见仓库 variables），对外统一走 `https://cdn.onewonder.co.jp`。基础设施由 Terraform 管理（内部 infra 目录），key 结构约定：`media/`（长缓存）、`data/`（不缓存）、`manifest.json`（版本+清单入口）。
- **已完成**：吉祥物图片 16 张已迁移至 `media/mascot/`，`mascot.html` 按固定 CDN URL 引用；知识库笔记数据已拆分为 `data/kb-data.json`，`index.html` 启动时拉取渲染，内容更新不再改动本仓库；内容清单见 `https://cdn.onewonder.co.jp/manifest.json`。
- **内容上传方要求**：其他仓库的生产线只向指定前缀上传（最小权限凭证），上传后必须更新 `manifest.json` 版本号；上传内容视同公开，先过泄漏扫描。

## 联系

- 商务/合作联系：info@onewonder.co.jp

## 红线

- 本仓库**只放公开内容**：客户项目资料、内部笔记源文件、内部编排记录一律不得进入本仓库。
- 正典形象资产（CDN `media/mascot/` 与内部源文件）：禁止任何 AI 重绘、改色、二次创作，只允许缩放展示与按既有规范裁切。


## Bot 协作轨（2026-09-11 起）

本仓有三条协作分支。它们都**不是仓库正本**，默认不合并进 main；经机主内容 review 后可例外合入（先例：2026-09-13、2026-09-15 机主令合并），只作为建议与反馈的输送通道：

| 分支 | 目录 | 写入方 | 读取方 | 用途 |
|---|---|---|---|---|
| `grok/knowledge` | `grok-inbox/` | 专管 Grok Bot | 开发 agent | Bot 定期推送的知识 / 建议 / 风险提醒（条目 `GK-<仓>-YYYYMMDD-NN`） |
| `grok/feedback` | `grok-feedback/` | 开发 agent / 机主 | 专管 Grok Bot | 对 GK 条目的采纳 / 拒绝 / 修正要求（条目 `GF-<仓>-YYYYMMDD-NN`） |
| `claude/review` | `claude-review/` | Claude（开发侧 review） | 开发 agent / 机主 | 对仓内容本身的 review 建议（条目 `CR-<仓>-YYYYMMDD-NN`） |

开发 agent 每次会话开始：

```bash
git fetch origin grok/knowledge grok/feedback claude/review
git show origin/grok/knowledge --stat --oneline   # 看最新 GK 条目
```

- 读 `grok-inbox/` 最新条目当**建议输入**，不当已生效规则。
- 对 GK 的裁定写进 `grok/feedback`，**不直接写 `grok/knowledge`**（那是 Bot 专属写入分支）。
- 要落地的改动走正常 PR → `main`，PR 描述引用对应 GK / CR 条目 ID。
- 专管 Bot 只写 `grok/knowledge`，运行前读 `grok/feedback`；禁止 push `main`。
