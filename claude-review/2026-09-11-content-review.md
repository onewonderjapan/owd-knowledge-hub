# Claude 内容 review · 2026-09-11 · owd-knowledge-hub

- 条目 ID：CR-KHUB-20260911-01
- 仓：onewonderjapan/owd-knowledge-hub
- 分支：claude/review
- 写入方：Claude（开发侧 review）
- 机密分级：L1（本仓 PUBLIC；完整版含数据侧细节，存于内部 ops 仓同名条目）
- 状态：待机主阅读

## 仓定位
- 公开站 hub.onewonder.co.jp 的「页面结构」仓：index.html（2349 行单文件）、mascot.html（402 行）、design/README.md、README.md、.github/workflows/deploy.yml。
- 知识数据不在仓内：index.html:505 写死 `window.__KB_DATA_URL__` 指向 CDN `data/kb-data.json`；index.html:509-518 优先读内嵌 `#kb-data`（仓内不存在），否则 `fetch(url,{cache:'no-store'})`。mascot.html 无 fetch，只引用 CDN 12 张图（mascot.html:194-238）。
- 部署：push main → Actions OIDC → `aws s3 cp` 两个 HTML → CloudFront 失效。线上 index.html 与 main 一致。
- **仓可见性为 PUBLIC**。README 措辞与此一致，但舰队登记曾按私有仓处理，本条已按 L1 撰写。

## 发现
1. **[P0] 页面对数据源的 `scope` 字段只做展示标记、不做过滤。** index.html:1505 仅给 `customer-confidential` 打徽章；其余 scope 值一律按普通笔记渲染。数据源中是否只含可公开条目，取决于数据生产侧脚本（`publish-data.sh`，不在本仓）。本次核对结果与处置细节见内部完整版；结论是**数据侧需要先过滤再发布**，页面侧过滤只是安全网。
2. **[P0 关联] `feature/home-redesign` 已实现页面侧拦截**（该分支 index.html 约 3440-3496 行，`BLOCK_SCOPES` / `BLOCK_TYPES`），注释明确写「页面侧只是安全网，恒久对策在 publish-data.sh」。该分支尚未合并，线上仍是无过滤版。
3. **[P1] deploy.yml 硬编码 S3 桶名与 CloudFront 分配 ID**（.github/workflows/deploy.yml:27-28、:31）。非机密，但仓为 PUBLIC，属可见信息。触发条件 `push.branches:[main]` + `paths:[index.html, mascot.html]`，改 deploy.yml 自身不触发部署。
4. **[P1] 页面引用但 JSON 不存在的字段 `notes[].editor_note`**（index.html:713），用 `||{}` 兜底，「点评位」功能永远为空。
5. **[P1] JSON 有但页面未用的字段**：顶层 `graph`（页面用 `entity_graph`）、notes 的 `entry_count` / `supersedes`、entries 的 `duration_label` / `date_label` / `category_raw`。
6. **[P1] 每次打开页面无条件下载约 1.2 MB JSON 且 `cache:'no-store'`**（index.html:514）；CDN 响应无 `Cache-Control`、未压缩传输。
7. **[P2] CSV 导出把 `n.path`（数据源内部目录结构）写入**（index.html:1405）；`DATA.review` / `DATA.validation` 元数据在公开页渲染（index.html:1257-1259）。
8. **[P2] 过期 TODO**：index.html:495 `TODO T-31` 已完成但注释未删。未发现 console.log / debugger / 内联密钥 / 第三方脚本。

## kb-data.json 字段对照（页面侧）
| 字段 | 页面引用位置（index.html） | JSON 中存在？ | 备注 |
|---|---|---|---|
| built_at / stats / notes / entries / conclusions / watchlist / today / review / actions / kw / boards / heat / entity_graph / validation / public | `DATA.*` 15 个 key，:509-2325 | 是（15/15） | 全部命中 |
| graph | 无引用 | 是 | 冗余，页面用 entity_graph |
| notes[].editor_note | :713 | **否** | 兜底后静默失效 |
| notes[].scope | :1405, :1505 | 是 | 页面不过滤（见发现 1） |
| notes[].entry_count / supersedes | 无引用 | 是 | 冗余 |
| entries[].duration_label / date_label / category_raw | 无引用 | 是 | 冗余 |

## feature/home-redesign 概况
- 头提交 015eacf（2026-09-10），相对 main c6da622：4 文件，+5934 / -917。index.html 2349→6939 行，mascot.html 402→825 行，新增 og.png，deploy.yml 追加 og.png 与 `--cache-control`。
- 性质：整页重写。lang zh-CN→ja、新增 og:* meta、新增页面侧 scope/type 拦截、新增语言切换。视觉不评审。线上 /og.png 目前 403（未部署，符合未合并状态）。

## 建议
### P0
- 数据生产侧 `publish-data.sh` 按 scope / type 过滤后重新发布 CDN，并升 manifest 版本号。这是唯一根治点。
- 在此之前尽快把 `feature/home-redesign` 的拦截段 cherry-pick 到 main 先上线止血。
### P1
- deploy.yml 桶名 / 分配 ID 改 `vars.*` 或 secrets；paths 加入 deploy.yml 自身。
- 数据侧删除冗余字段、`content` 按需加载或拆文件；CDN `data/` 开启压缩与短 `Cache-Control`。
- `editor_note`：数据侧输出该字段，或删除 index.html:712-713 死逻辑。
### P2
- 删过期 TODO（:495）；CSV 导出去掉 `n.path` 列（:1405）；评估 review / validation 元数据是否该公开渲染。
- mascot.html 补 canonical 与 og:* meta；两站均无 robots.txt / sitemap。
- README 顶部明确「PUBLIC 仓，一切内容视同公开」。

## 不建议做
- 不要靠更多页面侧正则清洗「隐藏」内容：JSON 直链一分钟内可绕过。
- 不要把 kb-data.json 改成鉴权接口：无后端是设计价值；正确路径是「不发布就不上 CDN」。
- 不要把 `#kb-data` 内嵌 payload 回到单文件模式。

## 未核实
- `publish-data.sh` 实际过滤逻辑（脚本不在本仓）。
- CDN 对 media/ 前缀的 Cache-Control。
- GitHub Pages 镜像是否与 main 同步（仅核实 200）。
