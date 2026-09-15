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

生产线更新流程（内部 workspace 执行）：

```bash
bash scripts/publish-data.sh   # 构建（含泄漏护栏）→ 上传 CDN → 更新 manifest
```

本仓库只承载页面结构：`index.html` / `mascot.html` 变更才会触发自动部署（GitHub Actions → AWS）。

## 架构（结构-内容分离，已落地）

- **本仓库 = 页面结构**：HTML/CSS/JS 与协作规范。push 到 `main` 后由 GitHub Actions 经 OIDC（免密钥）同步到 AWS S3 + CloudFront，正式站为 `https://hub.onewonder.co.jp`；GitHub Pages 仅作备用镜像。
- **内容/媒体 = AWS S3 + CloudFront**：`s3://onewonder-public-content`（全私有，仅 CloudFront OAC 可读），对外统一走 `https://cdn.onewonder.co.jp`。基础设施由 Terraform 管理（内部 infra 目录），key 结构约定：`media/`（长缓存）、`data/`（不缓存）、`manifest.json`（版本+清单入口）。
- **已完成**：吉祥物图片 16 张已迁移至 `media/mascot/`，`mascot.html` 按固定 CDN URL 引用；知识库笔记数据已拆分为 `data/kb-data.json`，`index.html` 启动时拉取渲染，内容更新不再改动本仓库；内容清单见 `https://cdn.onewonder.co.jp/manifest.json`。
- **内容上传方要求**：其他仓库的生产线只向指定前缀上传（最小权限凭证），上传后必须更新 `manifest.json` 版本号；上传内容视同公开，先过泄漏扫描。

## 联系

- 商务/合作联系：info@onewonder.co.jp

## 红线

- 本仓库**只放公开内容**：客户项目资料、内部笔记源文件、内部编排记录一律不得进入本仓库。
- 正典形象资产（CDN `media/mascot/` 与内部源文件）：禁止任何 AI 重绘、改色、二次创作，只允许缩放展示与按既有规范裁切。


## Bot 协作轨（2026-09-11 起）

本仓有三条协作分支。它们都**不是仓库正本**，不合并进 `main`，只作为建议与反馈的输送通道：

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
