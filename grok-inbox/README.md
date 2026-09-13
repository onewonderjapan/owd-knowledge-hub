# grok-inbox · Grok 知识 / 建议收件箱

本目录位于分支 **`grok/knowledge`**，是 Grok 专属的知识与建议收件箱（knowledge inbox），供知识中枢仓 `onewonderjapan/owd-knowledge-hub` 使用。

## 用途

- 由专管 Bot **「管知识中枢的」** 定期写入可核对的知识、产品/结构建议与风险提醒。
- 开发 agent 与人类维护者应**定期阅读**本目录条目，并在条目 header 中更新「状态」字段（待开发阅读 / 已采纳 / 已拒绝 / 待验证）。
- **收件箱 ≠ 已合并事实**：此处内容默认是建议与输入，在被明确决策并合入 `main`（或走晋升门写入 CDN 知识数据）之前，不得当作线上实现或已落地需求。

## 路径约定

```
grok-inbox/
  README.md                          # 本说明
  YYYY-MM-DD-<slug>.md               # 单条 GK 条目（每周 ≥1）
```

条目文件名示例：`2026-09-11-structure-content-kickoff.md`。

## 本仓硬边界（结构 / 内容分离）

1. **本仓 = 页面结构**：`index.html` / `mascot.html` / `design/YYYYMMDD-主题-vN` 与协作规范。
2. **知识数据 = CDN**：`https://cdn.onewonder.co.jp/data/kb-data.json`；内容更新不改本仓。
3. Bot **不得**把内部笔记源文件推进本仓；**禁止**直写 CDN；未晋升内容不得进公开 KB。
4. 设计稿仅走设计负责人 → `design/` 登记流程；专管 Bot 不代写设计稿。

## 写入与推送规则（已锁定）

1. **只推 `grok/knowledge`**，永不因本规则直接修改或推送 `main`。
2. 未核实事实须在正文标明「【未核实假设】」；禁止编造不可核对的引用。
3. 条目使用简体中文（zh-CN），并遵循固定 header 格式（见各 GK 文件顶部）。
4. 脱敏 / 晋升门未决前，不得把 inbox 建议当作可 merge 的公开 KB / CDN 变更。

## 读者指引（开发 agent）

1. 打开最新 `YYYY-MM-DD-*.md`，阅读「摘要 / 依据 / 建议下一步 / 明确不要做什么」。
2. 将可执行项拆入自己的任务队列；采纳或拒绝后回写条目「状态」。
3. 需要落地改动时：结构类走正常 PR → `main`；知识数据走 CDN 生产线（`publish-data.sh`）与既有确认/晋升门。**不要**把 inbox 文件拷进站点路径或 CDN 冒充已交付。

## 所有者

- 专管 Bot：管知识中枢的
- 仓：onewonderjapan/owd-knowledge-hub
- 分支：grok/knowledge
