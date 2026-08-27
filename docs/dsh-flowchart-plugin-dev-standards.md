# dsh-flowchart 开发范式规范

> 适用：dsh-flowchart-plugin 全部代码提交（源码、脚本、文档）。
> 基准：dsh-wf-plugin 的七范式（P1–P7）实施记录 + dsh-fm-plugin 的正式版发布规范。
> 原则一句话：**新能力 = 注册表加一行；新交互 = 状态机加一个 phase；新副作用 = 命令加一个 op**。

---

## 1. 分层与依赖（P1 / P6）

### 1.1 四层边界（依赖单向，禁止反向）

| 层 | 目录 | 允许 | 禁止 |
|---|---|---|---|
| 领域层 | `src/core/` | 纯 JS 数据/函数；可 import 同层与 `lib/wire.js`（双端共用例外）、`zod` | React、DOM、`@deepseek-ai/*`、Node API、`fetch`、`localStorage`、`window` |
| 应用层 | `src/hooks/` | React hooks、状态持有、core 纯函数调用、命令副作用执行 | 业务判断逻辑（进 core）、渲染（进 components） |
| 表现层 | `src/components/` | 纯渲染 + 回调转发；DSH 图标组件（视为展示资源，wf 审计豁免同款） | 业务判断、状态机、存储调用 |
| 宿主适配层 | `src/client.js`、`src/components/FlowchartButton.js`、`lib/*` | 槽位注册、props 读取、样式注入、i18n 表、@Remote 挂载、线协议 | 画布应用逻辑 |

### 1.2 依赖红线（`grep` 审计脚本守护）

```
core/** 出现 React|useState|window|document|localStorage|@deepseek-ai → 构建失败
components/** 出现 setElements|store|storage 直调 → 构建失败
外层 import 内层只允许：components → hooks → core；严禁 core 被反向依赖
src/ 是唯一手写源：lib/client.js 只由 scripts/build.mjs 生成，禁止手改
```

### 1.3 模块头注释（每个文件必写）

```js
// dsh-flowchart core/codegen.js
// 职责：Doc → Mermaid 代码（front-matter + 语句）纯生成器
// 边界：零 React/DSH；只依赖 shapes/edge-kinds/config-schema 注册表；字符串输出可单测
// 导出：buildMermaidCode / validateCode
```

---

## 2. 注册表驱动（P2）

- 新增形状 / 页面类型 / 边类型 / 配置项 = **只在对应注册表加一项**，禁止修改注册表以外的业务逻辑（渲染分派、设置面板、代码生成器均按注册表遍历）。
- 每个注册项结构固定，注册表导出 `verify-registry` 断言：id 唯一、label 非空、`syntax()` 可被 `mermaid.parse` 解析、render/thumb 键存在、minSize 合法。
- `schema.json` 保持与 core 注册表一致性（数组/字段级测试，防漂移）。

## 3. 纯函数状态机（P3）

- 交互 = `interact(state, event, ctx) → { state, commands }`；`decide → compute → settle` 三阶纯函数。
- 状态机内**禁止**出现：`setState`、DOM、`localStorage`、`Date.now()` 副作用（当前时间等状态由调用方注入）。
- 副作用只经 `commands` 由 `useCanvasInteractions` 执行；命令 op 清单见 ARCHITECTURE.md 4.1（新增命令 = 状态机返回 + 执行层一个 case，两者同一次提交）。
- 拖动多帧：**只提交本帧增量**（`delta − lastDx/lastDy`），吸附修正并入「应用累计」——这是 wf 的两个已修复 bug，作为注释模板写入 compute 函数头。

## 4. 单一数据所有权（P4）

- `pages/nodes/edges/config` 是唯一事实源；codegen 结果、issues、预览渲染全部纯函数 + `useMemo` 派生；**禁止**把派生结果写回事实源。
- 历史快照不可变：撤销/重做 = 深拷贝替换整个 doc（JSON 序列化即可，纯数据）；预算 300 节点 + 200 边 < 50ms。
- 元素 id：`p1/n1/e1` 前缀 + 模块 seq；所有载入路径必须 `reserveSeqs()`（复制粘贴 id 冲突是 wf 已踩事故，注释保留）。

## 5. 容错契约（P5）

- 解析/读取/渲染**永不抛**：读文件 → `.corrupt` 隔离；sanitize 逐记录；代码生成失败 → issue 收集；`mermaid.render` 失败 → 错误面板。
- 迁移：`migrateFile` 版本链只入不覆盖；未知字段保留；写回总是最新版本。
- 导入：重新分配 id 新建（绝不覆盖现有画布）；导入前 sanitize + 校验。

## 6. 存储即服务（P7）

- 业务代码**只认 `CanvasStore` 接口**（`src/core/storage/index.js` 导出）；禁止业务直读写 localStorage/文件。
- 适配器：`domainAdapter`（现役，@Remote 宿主目录文件）→ `indexedDBAdapter`（预留）→ `localStorageAdapter`（兜底）；`probeAdapters` 能力探测 + 安全降级，业务零改动。
- 自动保存：dirty 集合 → 800ms 防抖 → 增量 patch → 关闭 `flushSave`；宿主侧写链串行（读-改-写原子性接口不变）。
- 线协议：`lib/wire.js` 单一来源；host 与 client 双端共用；**禁止**在 typert.host.js / remote.js 里手写第二个 schema。

## 7. 命名与样式

| 项 | 规范 |
|---|---|
| 组件文件 | PascalCase（`EdgeRenderer.js`）；hook `useXxx.js`；纯函数文件小写（`geometry.js`） |
| CSS | BEM：`.mm-canvas`、`.mm-node__label`、`.mm-menu--sub`；样式文件按面拆分（base/canvas/rightpanel/preview + index 聚合，顺序=优先级基线） |
| 颜色/尺寸 | 一律 `--mm-*` token（DSH 主题 token 别名，`src/client.js` 注入），禁止硬编码色值 |
| i18n | 文案全部走 `t(key, params)` + `src/i18n/index.js` 的 zh 表（key 化预留多语言）；禁止组件内中文字符串字面量（工具文案/错误信息也要 key 化） |
| 图标 | 仅 DSH 内置图标库（`@deepseek-ai/dsh-client-ui-primitives`），禁止自绘图标 SVG 当按钮 |
| 中文名 | `cordis.patch.yml name` = `dsh-flowchart`；`scripts/build.mjs` banner id 必须与之一致；install.ps1 用 code point 构造中文名（防编码问题，同 dsh-fm） |

## 8. 安全

- `mermaid.initialize({ securityLevel: 'strict', startOnLoad: false })`——禁止 open trust（不允许点击跳转/外部链接、不允许 HTML 注入）。
- 标签转义全部走 codegen 的 `escapeLabel`（引号/`<br/>` 策略由注册表 `htmlLabels` 配置决定）；禁止直接把用户文本拼进 SVG `dangerouslySetInnerHTML`（渲染结果注入点仅 `mermaid.render` 产物）。
- 禁止 eval / new Function / 动态 require；禁止 fetch 任意 URL；mermaid 版本锁定 `^11.4.1`（同 dsh-fm，升级需过 verify-shapes smoke）。
- 宿主半路径：id 落文件前 sanitize（`^[A-Za-z0-9_-]+$`），防路径穿越。

## 9. 构建与产物

```
开发循环：编辑 src/ → npm run build（esbuild；必须 workspace-write 及以上沙箱，否则 spawn EPERM 静默失败）
产物：lib/client.js（ModuleLoader banner + factory；external: react/react-dom/@deepseek-ai/*；mermaid/zod 内联）
禁止：lib/client.js 手改；cordis.patch.yml 写逻辑；把 node_modules 提交进 git
```

## 10. 测试与验证闸门

- `npm run verify` 必须**全绿**才算完成：verify-shapes / verify-codegen / verify-interactions / verify-storage / verify-host-storage / verify-adapter-contract / verify-preview / verify-perf + 真 fs 冒烟（`smoke-storage.mjs`）。
- 新交互：先加纯函数单测（`test/` 或 verify-*），再写 UI；禁止"先 UI 后补测试"。
- 手工验收：产品设计第 5 章清单逐项勾选（提交 PR/commit message 中附勾选结果）。
- 性能回归：300 节点 + 200 边基准（codegen < 50ms、patch 往返 < 100ms）；发现劣化 >20% 即修。

## 11. Git 与版本

- 分支：`main`（可发布）→ 功能分支 `feat/<milestone>-<短名>` / `fix/<短名>`；提交信息：`<M|x.y.z> <动词> <对象>`（e.g. `M2 实现箭头吸附与跨页取消`）。
- 版本：semver；每次发布 = CHANGELOG.md 条目 + `package.json` version 提升 + `sync-release.mjs` 同步 release 目录。
- 里程碑合并需 2 人评审（或自评审说明会）——规则与 dsh-wf/dsh-fm 一致：review 重点 = 分层是否被污染、注册表是否开闭、状态机是否纯、存储是否走接口。

## 12. 发布清单（对齐 dsh-fm）

1. `npm run verify` 全绿
2. `npm run build` 成功（lib/client.js 重构后体积记录进 README）
3. `npm run test`（node --test）全绿
4. `node scripts/sync-release.mjs` 同步 `dsh-flowchart-release/`
5. release 目录：`install.ps1`（Windows 5.1 ASCII 兼容）/ `README.md` / `CHANGELOG.md` / `LICENSE` / `cordis.patch.yml`
6. 手工安装冒烟：`dsh plugin --profile web add "file:<release>"` → 重启 → 「流程图」按钮出现 → 绘制 → 刷新后文档还原
7. 版本号 + CHANGELOG 记录（日期、变更、兼容性说明）

## 13. 代码评审检查单（每 PR 逐项）

- [ ] core 零 React/DSH；hooks 无业务判断；components 零状态持有（grep 审计绿色）
- [ ] 新增能力走注册表，未改注册表外逻辑
- [ ] 交互变更 = 状态机纯函数 + 单测；命令 op 有执行 case
- [ ] 拖动算法无重复累加 / 吸附无抖动（对照 wf 修复点）
- [ ] 存储走 CanvasStore；wire 单源；无第二个 schema
- [ ] 颜色/文案/图标符合第 7 条；无硬编码中文串、无硬编码色值
- [ ] mermaid 相关：securityLevel strict、转义函数覆盖、错误不白屏
- [ ] 性能基准未劣化；`npm run verify` 全绿
- [ ] 文档同步：ARCHITECTURE.md 事件表/命令表/模块规格更新；README 功能表更新
