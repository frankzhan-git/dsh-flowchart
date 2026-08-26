# dsh-mermaid 研发架构方案

> 状态：设计稿 v1，与《dsh-mermaid-plugin-design.md》（产品设计）配套
> 总纲：**分层领域 + 注册表驱动 + 纯函数状态机 + 命令副作用隔离 + 单一数据所有权 + 宿主解耦 + 存储即服务**（沿 dsh-wf P1–P7 范式）
> 新增总纲：**代码一等公民**——`codegen` 是产品核心（画布 → 标准 Mermaid 代码的唯一出口），任何画布状态恒产出合法代码（C1–C3 红线见产品设计 0.1）；`verify-codegen` 为最高优先级测试套件，不可降级发布
> 参考实现源码：`dsh-wf-plugin/`（交互/存储/宿主半）、`dsh-fm-plugin/`（正式版发布链路）

---

## 第 1 章 总体架构

```
┌─ 宿主适配层（P6，DSH 知识仅在此层）───────────────────────────────────────┐
│  cordis.patch.yml 注册（name: dsh流程图）                                 │
│  lib/index.js   ctx.get('typert') 可选 → createMermaidService() →          │
│                 ctx.provide('mermaidStorage') + bindTypertRemote +          │
│                 typert.register(TYPERT_HOST)（@Remote 网关）→ 浏览器可调用 │
│  lib/wire.js    线协议单一来源（zod：记录 schema + invocations 双端共用）   │
│  src/client.js  样式注入 + slots.inject('conversation.input.left' /       │
│                 'conversation.input.overlay') + remote.$mount（失败降级）  │
└──────────────┬────────────────────────────────────────────────────────────┘
               ▼ 注入（useInput / inputActions.setDraft / theme tokens / onClose）
┌─ 应用层（hooks，唯一允许持有状态）──────────────────────────────────────────┐
│  useDocState      pages/nodes/edges + 撤销栈 + 自动保存调度（800ms 防抖）    │
│  useCanvasInteractions   DOM 事件 → interact()  → commands → 副作用          │
│  useCanvasEdit    编辑中文本（节点/箭头）/ 右键菜单 / 形状菜单 / 触发的浮层    │
│  useCanvasManager 文档列表 / 载入 / 新建 / 删除 / 导出 / 导入 / flushSave      │
│  usePreview       mermaid 代码（memo）→ 渲染预览（500ms 防抖 + 错误捕获）      │
└──────────────┬────────────────────────────────────────────────────────────┘
               ▼ 纯函数（core，零 React/DSH，可单测）
┌─ 领域层 core ─────────────────────────────────────────────────────────────┐
│  model.js        文档/页面/节点/边工厂 + id 分配 + reserveSeqs + 克隆        │
│  geometry.js     命中/包围盒/吸附/钳制/路径采样（直线、贝塞尔弧线）           │
│  interactions.js 交互状态机（decide→compute→settle，含 ARROW_DRAW 状态）     │
│  shapes.js       14 形状注册表（label/syntax/minSize/render 缩略图）         │
│  page-types.js   页面类型注册表（flowchart v1；其余预留 + configSchema）      │
│  edge-kinds.js   边类型注册表（solid/dotted/thick/open → 语法映射）          │
│  config-schema.js 设置面板配置注册表（文档级/页面级/节点级/边级）             │
│  codegen.js      buildMermaidCode(doc) → { code, issues }（纯函数）          │
│  pipeline.js     派生编排：pages/nodes/edges → 每页代码 + 文档 issues        │
│  storage/        CanvasStore 接口 + probeAdapters + domain/localStorage 适配器│
│  i18n / css      文案表（zh 默认）/ --mm-* token 样式                        │
└──────────────┬────────────────────────────────────────────────────────────┘
               ▼（宿主半，Node 进程）
┌─ lib/（产物目录）─────────────────────────────────────────────────────────┐
│  index.js  wf-service 同款（目录文件 + 原子写 + meta 缓存 + .corrupt 隔离）  │
│  wire.js   typert.host.js  client.js（esbuild 构建产物，不手改）            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 1.1 数据流

```
DOM 事件 → useCanvasInteractions.onPointer* 
  → core/interactions.interact(state, event, ctx) → { state, commands }
  → 副作用执行（setState / 吸附线 / 历史 commit / toast / flushSave 调度）
  → React 渲染（CanvasStage SVG + Overlay + RightPanel）
  → core/codegen.buildMermaidCode(doc)（useMemo）
      ├→ 代码面板（只读 + 高亮）
      └→ usePreview：mermaid.render（500ms 防抖）→ SVG / 错误
  → 自动保存：dirty 增量（pages/nodes/edges set+remove+order）→ CanvasStore → 宿主文件 / localStorage
```

### 1.2 包与构建

- 包名 `dsh-mermaid`；`package.json`：
  - `main: lib/index.js`；`exports: { ".", "./client", "./package.json" }`（另加 `./cordis.patch.yml`，与 wf 一致）
  - `dsh.client.inject`: `@deepseek-ai/dsh-client-ui-primitives / -ui-slots / -client-runtime / -client-locale`
  - `dsh.bundle.patch: ./cordis.patch.yml`
  - `dependencies`: `zod ^4`、`mermaid ^11.4.1`（与 dsh-fm 同版本线）；`devDependencies`: `esbuild ^0.24`
- esbuild：entry `src/client.js` → `lib/client.js`；`external: ['react','react/jsx-runtime','react-dom','@deepseek-ai/*']`，第三方（mermaid/zod）内联（dsh-fm 已验证该策略）；banner id `dsh流程图` 与 cordis.patch.yml `name` 严格一致。
- 正式版发布链路完全对齐 dsh-fm：`dsh-mermaid-plugin/`（源码仓）→ `scripts/sync-release.mjs` → `dsh-mermaid-release/`（免构建安装包：`install.ps1` + `README.md` 专属 + 源码/构建产物同步）；`CHANGELOG.md`、`LICENSE`、`schema.json`（代码/数据契约 schema，与注册表一致性由测试守护）。

---

## 第 2 章 仓库结构

```
dsh-mermaid-plugin/
├── package.json            # 入口 lib/index.js；scripts: build / verify
├── cordis.patch.yml        # - insert: [{ id: dsh-mermaid, name: dsh流程图 }]
├── schema.json             # 画布数据契约 Schema（与 core 注册表一致性测试）
├── src/                    # ★ 唯一手写源
│   ├── client.js           # 宿主适配层入口（样式注入 + 两槽位注册 + remote.$mount）
│   ├── core/               # 领域层（禁 React/DOM/DSH，P1）
│   │   ├── model.js  geometry.js  interactions.js  shapes.js
│   │   ├── page-types.js  edge-kinds.js  config-schema.js
│   │   ├── codegen.js  pipeline.js  preview.js（mermaid 封装：受限参数/错误清洗）
│   │   └── storage/
│   │       ├── index.js          # CanvasStore 接口 + 装配（probeAdapters / defaultStore）
│   │       ├── remote.js         # contribution + createDomainRemote（@Remote 网关）
│   │       ├── schema.js  migrate.js  integrity.js
│   │       └── adapters/ domain.js（现役） localStorage.js（兜底） indexedDB.js（预留）
│   ├── hooks/              # useDocState  useCanvasInteractions  useCanvasEdit
│   │                       # useCanvasManager  usePreview  useToasts
│   ├── components/         # 表现层（纯渲染 + 回调）
│   │   ├── MermaidButton.js        # 槽位按钮（适配层组件）
│   │   ├── MermaidModal.js         # 浮层外壳（编排，≤300 行）
│   │   ├── canvas/  CanvasStage  CanvasOverlay(四角按钮+浮窗)  NodeRenderer
│   │   │            EdgeLayer  EdgeRenderer  SelectionOverlay  SnapLines  ArrowGhost
│   │   ├── inspector/ SettingsPanel(=wf InspectorPanel 同款)  PropField  ShapePicker
│   │   ├── preview/  CodeView  RenderPreview      # 浮窗内容（wf-float-panel 同款）
│   │   ├── RightPanel.js            # 右栏编排：设置 + 画布历史（同 wf RightPanel，高度可拖）
│   │   ├── docs/     DocumentPanel   # 画布历史：最近打开/新建/重命名/删除/导出/导入
│   │   └── common/   Toast  shapeThumbs（从 shapes 注册表派生）
│   ├── i18n/index.js      # t(key, params) + zh 表
│   └── css/               # base canvas rightpanel preview + index 聚合（--mm-* token）
├── lib/                   # 宿主半（手写）+ client.js（构建产物）
│   ├── index.js  wire.js  mermaid-service.js  typert.host.js
├── scripts/               # build.mjs + verify-*（见第 9 章测试矩阵）
├── test/                  # codegen / interactions / storage 单测（node --test）
├── README.md  CHANGELOG.md  LICENSE  ARCHITECTURE.md
└── docs/                  # 发布/安装说明
```

---

## 第 3 章 领域模型（数据契约）

### 3.1 运行时元素（单一事实源）

```js
// 文档 Doc（useDocState 持有；三类集合 + 配置）
{
  pages: Page[]      // { id, type:'flowchart', name, x,y,w,h, direction:'TB'|'TD'|'BT'|'LR'|'RL',
                     //   config: { curve?, nodeSpacing?, rankSpacing?, padding?, useMaxWidth?, htmlLabels? } }
  nodes: Node[]      // { id, pageId, shape:'rectangle', x,y,w,h, text:string }（text 含 '\n' 原文）
  edges: Edge[]      // { id, pageId, from, to, fromAnchor, toAnchor, label:'', kind:'solid' }
  config: DocConfig  // { theme:'default', fontFamily? }（themeVariables/advanced 透传位，v1 数据保留）
}
// 锚点：{ side:'l'|'r'|'t'|'b', t:0..1 }（t = 沿该边的归一化位置；DOM 坐标由几何函数换算）
```

- 元素 id：`p1`（页面）/ `n1`（节点）/ `e1`（边），模块级 seq + `reserveSeqs(doc)`（载入推进，防复制粘贴冲突——wf 教训）。
- 派生不落盘：`codegen` 结果、issues、渲染预览全部 memo 派生。
- 不可变历史：撤销栈 = 文档快照数组（`{ past: Doc[], future: Doc[] }`，JSON 深拷贝；预算 <500 记录 <50ms）。

### 3.2 落盘契约 CanvasFile（schemaVersion 1）

```js
{
  schemaVersion: 1,
  id, name, createdAt, updatedAt,
  pages: Page[], nodes: Node[], edges: Edge[],
  config: DocConfig,
  meta?: { source?: 'canvas'|'import' }
}
```

- 迁移：`migrateFile(raw)` 版本链逐级升级；未知字段保留（前向兼容）；写回总为最新版本。
- 完整性：`sanitizeDoc(raw)` 逐记录校验（页面/节点引用、锚点归一化、边引用存在性），非法记录丢弃 + `dropped` 计数上报；宿主读时同样清洗（P5 双保险）。

### 3.3 存储契约 CanvasStore（P7）

```js
interface CanvasStore {
  ping(): Promise<{ok, storage}>
  listMeta(q?: {page?, pageSize?, keyword?}): Promise<{ok, items, total}>
  getMeta(id): Promise<{ok, meta|null}>
  loadBody(id): Promise<{ok, body:{pages,nodes,edges,config,schemaVersion,dropped}|null}>
  saveMeta(meta): Promise<{ok}>
  saveBody(id, patch): Promise<{ok}>     // patch: { pages:{set,remove}, nodes:{set,remove}, edges:{set,remove}, order? }
  remove(id): Promise<{ok}>
  clear(): Promise<{ok}>
  close(): Promise<void>
}
// patch.set 为完整记录（增量 = 业务层只在 dirty 时发送变更记录；适配器可退化为全量快照）
// order（可选）：三类记录各自的 z/顺序数组（画布渲染顺序 = 数组顺序；本产品 z 序仅节点互相覆盖时使用）
```

- 业务层只认此接口；`probeAdapters()` 按优先级装配：`domainAdapter`（现役，@Remote 宿主文件）→ `indexedDBAdapter`（预留）→ `localStorageAdapter`（兜底，旧键迁移）。
- 自动保存管线：dirty 集合（自上次保存变更的记录 id：pages/nodes/edges）→ 800ms 防抖 → `saveBody(id, patch)` → 更新 meta（updatedAt/elementCount）→ 关闭 `flushSave`。
- 宿主介质: **命名空间目录管理**——`~/.dsh/storages/dsh-mermaid/{MANIFEST.json, canvases/{id}.json}`（插件唯一命名空间，不污染 storages 顶层；每文档一 JSON，`writeAtomic` = 临时文件 + fsync + rename；写链串行读-改-写；损坏 `readCanvasFile` 改名 `.corrupt` 隔离；临时文件残留启动清扫；meta 缓存启动扫描，文件权威；旧目录 `mermaid-canvases/` 启动一次性迁移，只入不覆盖）。**无媒体**（flowchart 无图片控件），故 v1 无 putMedia/getMedia——接口预留位，未来按 wf 同款补。

### 3.4 传输（@Remote 网关，S 同 wf 现役形态）

- `lib/wire.js`：zod 单源（`META_SCHEMA`/`BODY_SCHEMA`/`MM_INVOCATIONS`：ping/listMeta/getMeta/loadBody/saveMeta/saveBody/remove/clear，全部 `strict` codec + `sourceLocation`）。
- `lib/typert.host.js`：`TYPERT_HOST` 描述符（gateway 严格路径）。
- `lib/index.js`：`const typert = ctx.get('typert'); if (!typert) return`（可选依赖，非 web profile 无效果）→ `ctx.effect(createMermaidService → provide + bindTypertRemote + typert.register + close)`。
- `src/core/storage/remote.js`：`mermaidRemoteContribution`（descriptors= MM_INVOCATIONS）+ `createDomainRemote(remote)`（卸载 `ok/error` 载体信封）。
- `src/client.js` apply 时 `await remote.$mount(...)` 成功 → `defaultStore(createDomainRemote(remote))`；失败 → localStorage 兜底（不阻塞槽位注册）。

---

## 第 4 章 交互状态机（core/interactions.js，P3）

### 4.1 状态

```js
DocState = {
  phase: 'IDLE'|'PAN'|'MOVE'|'RESIZE'|'CREATE_PAGE'|'CREATE_NODE'|'MARQUEE'
        |'GROUP_MOVE'|'GROUP_EDGE_RESIZE'|'GROUP_CORNER_RESIZE'|'ARROW_DRAW'|'EDIT_LABEL',
  drag: DragInfo|null,      // 每 phase 一个形状（含箭头绘制专用：sourceNode/fromAnchor/ghostTarget/crossPage）
  selection: string[],      // 节点 id（箭头单独 selectedEdge）
  selectedEdge: string|null,
  snapLines: SnapLine[], marquee: Rect|null,
}
// ctx = { doc, zoom, pan, mode, selectedIds, spaceDown, constants }
```

### 4.2 事件 → 迁移（节选，完整表随实现落 ARCHITECTURE.md）

| 事件 | 条件 | 迁移 | 命令 |
|---|---|---|---|
| pointer.down | space→PAN；draw+页面外空白→CREATE_PAGE；draw+页面内空白→CREATE_NODE；draw+命中节点边带→RESIZE（贴边拖=调宽高）；draw+命中节点角手柄→RESIZE；draw+命中节点主体→select+move；select+Ctrl→toggle；**select+命中节点边带→ARROW_DRAW**（选择模式无手柄）；select+命中主体/多选集内→MOVE；select+空白→MARQUEE；多选≥2+命中组框边→GROUP_EDGE_RESIZE；+角→GROUP_CORNER_RESIZE | 见上 | selection/snap/history 命令 |
| pointer.move | 各 phase 计算（compute* 纯函数，每帧增量 = 应用累计 − lastDx/lastDy，防重复累加——wf 修复点） | 见上 | patches + snaps + lastDx/lastDy |
| pointer.up | 结算 settle | 见 4.4 | commit/selection/remove |
| shortcut | undo/redo/copy/paste/delete/escape/mode | – | 命令 |
| wheel | zoomAt（视口中心锚定，0.25–3） | – | view |
| key.alt.down/up | 临时绘制切换（+ 对账） | – | mode |

### 4.3 箭头绘制专用计算（纯函数）

```
arrowGhost(state, sx, sy, x, y, ctx) → {
  path: SVG d,             // 直/弧按 edgeKind 判定（Q2 规则）
  kind: 'straight'|'curve',
  target: {node, side, t}|null,   // 吸附候选（同页，距离 ≤ 10/zoom）
  crossPage: boolean,             // 指针已离开 source 页面
}
pathFor(sourceNode, fromAnchor, toNode|null, x, y):
  几何 = 锚点→世界坐标（edge 边 + t）→ 直线 or cubic bezier（控制点沿法向 max(24, 0.35d)）
edgeKind(srcSide, dstSide, isHorizontalDominant):
  对峙边且主轴同向 → 'straight'；否则 'curve'
```

- 吸附规则：目标 = 同页、非 source、命中其边框带（±10/zoom）→ `t` = 最近点投影；同页多候选取距离最近。
- 跨页判定：指针（或吸附点）不在 source 页面矩形内 → `crossPage=true`（红叉视觉）。
- 结算：up 时 `target` 有效且非跨页 → 创建 edge（`fromAnchor`/`toAnchor` 归一化）+ commit；否则无操作取消。

### 4.4 结算与历史

| phase | 结算 | 命令 |
|---|---|---|
| CREATE_NODE | 过小(≤4)取消；否则 patch + selection + commit | elements/selection/history |
| CREATE_PAGE | 同左（默认 480×320） | 同左 |
| MOVE/GROUP_* | 吸附线清空；commit | history |
| ARROW_DRAW | 见 4.3；创建边后自动选中新边 | elements + selection + history |
| MARQUEE | 完全包含结算 → 多选（含箭头？**不含**：箭头按"两端点节点都在框内"才入选） | selection + history |
| RESIZE | commit | history |
| EDIT_LABEL | 双击回调进入，文本浮层提交/取消 | patch + commit |

### 4.5 复用映射（dsh-wf → dsh-mermaid）

| wf 纯函数 | 复用方式 |
|---|---|
| `toLocal/zoomAt/computePan` | 原样移植（相机不变） |
| `handleMetrics/hitEdgeOf/hitGroupEdge/hitPriority` | 移植：移除按钮/箭头端点分支，命中语义**按模式**（0.4 Q1）：选择模式边带 → ARROW_DRAW（无手柄）；绘制模式边带 → RESIZE、角手柄 → RESIZE |
| `computeMove/computeResize/computeGroupEdgeResize/computeMarquee/groupBounds` | 移植（吸附目标 = 同页节点 + 页面边界；多选移动排除组内） |
| `computeGroupResize`（四角等比） | **恢复启用**（wf 已移除，本产品 R8 要求批量 resize） |
| `decidePointerDown/updateDrag/settleDrag` | 扩展 ARROW_DRAW / CREATE_PAGE / CREATE_NODE / EDIT_LABEL 分支 |
| `buildPaste/collectCopySet` | 移植（复制节点连带其边？**不连带**：v1 复制节点不复制边（跨引用复制语义复杂）；粘贴仅节点 +24 偏移） |

---

## 第 5 章 注册表规格（P2）

### 5.1 形状注册表 `core/shapes.js`

```js
interface ShapeDef {
  id, label,                      // 中文名 / 菜单标签
  syntax(label) => string,        // 'A[text]' 等（代码生成 + 测试同源）
  minSize: { w, h },              // 画布最小尺寸（小形状 32×24，随形状适配）
  render: RenderKey,              // NodeRenderer 分派（rect/ellipse/path 模板）
  thumb: RenderKey,               // 12px 缩略图 SVG（ShapePicker 网格共用）
}
// 14 项全量注册（见产品设计 3.1）；派生：shapeOptions()/canChangeShape() 等规则不手写
```

### 5.2 页面类型注册表 `core/page-types.js`

```js
interface PageTypeDef {
  id, label,                      // 'flowchart' → '流程图'
  configSchema: ConfigKey[],      // 设置面板字段（flowchart: direction/curve/nodeSpacing/...）
  buildCode(page, doc) => string, // 代码生成（v1 flowchchart 实现；其它类型未注册 → 占位提示）
  interactive: boolean,           // v1 仅 flowchart=true
}
// 未来：sequence / class / state / er / pie / journey / mindmap / timeline / sankey /
//       quadrantChart / gitGraph / kanban / packet — 每类型 = 注册表加一行 + 自己的 buildCode
```

### 5.3 边类型注册表 `core/edge-kinds.js`

```js
{ solid:'A --> B', dotted:'A -.-> B', thick:'A ==> B', open:'A --- B' }
edgeSyntax(kind, from, to, label) → 'A -- label --> B'（空 label 省略；label 与 kind 语法组合表注册）
```

### 5.4 配置注册表 `core/config-schema.js`

```js
// 层级：doc(theme/fontFamily) → page(direction + flowchart.*) → node(shape/size/text) → edge(kind/label)
// 每项：{ key, label, type:'select'|'number'|'boolean'|'text', options?, default, toMermaid(value) }
// 设置面板 PropField 注册表驱动渲染；codegen 从注册表取值序列化（仅非默认值输出）
```

---

## 第 6 章 代码生成器（core/codegen.js）

> **一等公民红线（C1）**：管线为 `normalize → serialize → validate` 三段——
> `normalize`（归一回退：非法文本转义、孤儿边剔除、空 shape 回退 rectangle、缺失引用补占位、非法 id sanitize）、
> `serialize`（走注册表语法）、`validate`（`mermaid.parse` 实际解析，失败 → 修正重试 → 仍失败输出 issues 而不出脏代码）。
> 任何画布状态（编辑中途/半成品/异常数据）都从此管线产出**可解析代码**——verify-codegen 断言该不变量。

```js
buildMermaidCode(doc) → { pages: [{ pageId, code, issues: Issue[] }], issues: Issue[] }

// 一页输出
// ---
// config: { ...doc.config + page.config（非默认值） }   ← front-matter YAML（v11，仅输出非默认）
// ---
// flowchart TD
//     n1["申请"]
//     n2([审批])
//     n1 -- 提交 --> n2
//     %% 页面：首页
```

| 关注点 | 规则 |
|---|---|
| 节点语句 | `id + shapes.syntax(escape(label))`；label 转义：`"`→`#quot;`，`\n`→`<br/>`（htmlLabels）或 `\n`（非 htmlLabels），空格等自动引号 |
| 边语句 | `A -- label --> B`；孤儿边（from/to 不在本页）→ 跳过 + issue |
| 方向 | `direction` → 行首 `flowchart TD`（TD/TB 归一 TD；BT/RL/LR 原样） |
| 配置 | front-matter 仅输出非默认项；`htmlLabels:false` 时 label 转义策略切换 |
| 多页 | 页间 `%%` 注释 + 空行；单页无注释 |
| 校验 | `validateCode(code)`：括号/引用配对自检 + `mermaid.parse` 异步 smoke（错误 → issue + 预览错误面板） |

---

## 第 7 章 渲染（components/canvas）

- `CanvasStage`：SVG viewBox 相机（同 wf）+ 图层：`页面（底层虚线框）→ EdgeLayer（箭头，最底）→ NodeRenderer（节点，数组序）→ SnapLines → ArrowGhost → SelectionOverlay → 行内文本浮层`。
  - **箭头在节点之下**：节点命中永远优先，箭头只在无节点命中时可选（需求"箭头可点击选中"命中靠路径 8/zoom 采样）。
- `EdgeRenderer`：`edgeGeom(e, doc) → { d, mid }`；直线 = `M x1 y1 L x2 y2`；弧线 = cubic bezier；箭头头 = 末端三角 path；标签 = 中点 `<text>` + 半透明底 `<rect>`（`getBBox` 或估算宽）。
- `ArrowGhost`：绘制中预览（虚线 + 吸附高亮 + 跨页红叉态）。
- `NodeRenderer`：形状注册表 render 分派；文本 `text-anchor: middle` + `dominant-baseline: central` 多行 tspans。
- `CanvasOverlay`：**画布内四角定位按钮（同 wf CanvasOverlay）**——左上角模式徽标（选择/绘制 + Alt kbd，点击切换）；右上角工具行「代码 | 预览 | 设置」（设置 = 右栏显隐开关）；右下角操作组（撤销/重做/清空）+ 缩放栏（百分比，点击一键还原 100%）；浮窗（wf-float-panel 同款：居中、头部「复制/关闭」、右下角拖拽 resize、多页面下拉切换），floatTab 状态承载「Mermaid 代码」/「渲染预览」两个浮窗。
- `RightPanel`：**右栏仅两区（同 wf RightPanel）**——`SettingsPanel`（文档/页面/节点/箭头设置）+ 高度拖拽触发区 + `DocumentPanel`（画布历史：最近打开/新建/重命名/删除/导出/导入）。
- `RenderPreview`：`usePreview` 防抖 500ms → `mermaid.render('mm-' + id, code)`（**渲染器内置，mermaid 内联于插件 bundle**）；`securityLevel:'strict'`；错误洁净（移除 mermaid 临时 DOM，展示错误摘要）；成功 SVG 注入 `dangerouslySetInnerHTML`。
- 样式：`--mm-*` token 别名（来自 DSH 主题 token，深浅色自适应）；BEM 类名；`canvas.css / rightpanel.css / preview.css`。

---

## 第 8 章 设置面板与文档管理

- `SettingsPanel`：右栏设置区（同 wf InspectorPanel 模式），按选中项分节（无选中 = 文档 + 页面；选中节点 = +节点形状/文本/宽高；选中箭头 = +边类型/标签），`PropField` 注册表驱动。
- `ShapePicker`：右键级联子菜单 + 节点设置共用：`shapeThumbs` 14 项缩略图网格（2 列），选中高亮，hover tooltip 中文名。
- `DocumentPanel`（画布历史）：最近打开列表 / 新建 / 重命名 / 删除（二次确认）/ 导出 / 导入（重分配 id）；`listMeta` 不触 body；高度可拖（同 wf RightPanel histH）。
- `MermaidModal` 编排（≤300 行）：hooks 装配 + 左中布局（画布 + CanvasOverlay；右侧 = RightPanel 由「设置」按钮显隐）+ 顶栏（新建/全屏/关闭）+ 底栏（取消 /「插入到会话」主按钮 + 仅代码切换）+ toast 容器。

---

## 第 9 章 测试矩阵（`npm run verify` 一键全绿）

| 套件 | 覆盖 |
|---|---|
| verify-shapes | 14 形状注册完整性 + `syntax()` 与 `mermaid.parse` 逐项 smoke（语法漂移守卫） |
| verify-codegen | 形状语法/转义（空格、引号、`\n`→`<br/>`）、方向归一、默认值省略、多页输出、孤儿边 issue |
| verify-interactions | 直/弧判定、吸附（同页/跨页取消/红叉）、锚点归一化随动、移动钳制、框选含箭头规则、组边/组角批量、粘贴 id 唯一 |
| verify-storage | 三集合 patch 往返（pages/nodes/edges set+remove+order）、损坏隔离、schema 迁移、导入重分配 id |
| verify-host-storage | 宿主目录文件全流程（内存 fs + 真 fs 冒烟 `smoke-storage.mjs`）：原子写 / .corrupt / 启动扫描 / meta 一致性 |
| verify-adapter-contract | CanvasStore 契约形状（domain 现役 / localStorage 兜底 / indexedDB 预留降级） |
| verify-preview | mermaid.render 对生成代码的渲染结果非空 + 错误代码返回错误信息不抛白屏 |
| verify-perf | 300 节点 + 200 边：codegen < 50ms；patch 往返 < 100ms |

---

## 第 10 章 实施里程碑

| 里程碑 | 交付 | 验收 |
|---|---|---|
| M0 骨架 | 包脚手架 + cordis.patch + build.mjs + 槽位按钮/浮层 + 浏览器可见 | `dsh plugin add` + 页面出现「流程图」按钮 |
| M1 页面与节点 | 模式机制 + 页面/节点创建（R1–R4）+ 移动/边带/右下角 resize（复用 wf 几何） | 手工对照清单 1–3 |
| M2 箭头 | ARROW_DRAW 状态机 + 吸附 + 跨页取消 + 选中/删除/标签编辑 + 直弧判定（R5 主体） | 手工对照清单 4–7 |
| M3 形状与菜单 | shapes 注册表 14 项 + NodeRenderer 分派 + 右键缩略图菜单 + 页面菜单 | 清单 7 |
| M4 批量与撤销 | 框选/组移动/组边/组角/撤销重做 + 一键还原（R8） | 清单 8 |
| M5 代码生成与预览 | codegen + 代码面板 + mermaid 渲染预览 + 复制 + 插入（R6/R7 + 服务 2/3） | 清单 0、9–12 + **C1 不变量：任意状态 → mermaid.parse 通过** |
| M6 设置面板 | config-schema 注册表 + SettingsPanel + front-matter 输出验证 | 清单 9 |
| M7 宿主存储 | lib 四件套 + wire + @Remote + domainAdapter + localStorage 兜底 + 文档面板 | 清单 13 + verify-* 全绿 |
| M8 发布 | sync-release + install.ps1 + README/CHANGELOG/schema.json + 版本 0.1.0 | dsh-fm 同款发布 checklist |

每里程碑：`npm run verify` 全绿 + 产品验收清单逐项勾选 + 构建成功（`lib/client.js` 产出）。

---

## 第 11 章 关键技术决策记录（架构级）

| # | 决策 | 理由 |
|---|---|---|
| A1 | 箭头元素渲染在节点层**之下** | 保证节点命中优先（箭头细、易误点）；箭头命中靠路径采样而非包围盒 |
| A2 | 边带语义（0.4 Q1）：**模式即语义**——选择模式边带=箭头入口（无手柄）；绘制模式边带=调宽高、角手柄=resize | 满足 R4（绘制模式改大小）+ R5（选择模式画箭头）且语义零冲突；改尺寸的兜底入口=设置面板/右键数值输入 |
| A3 | 锚点归一化（side+t）而非绝对坐标 | 节点移动/缩放箭头自动跟随——"连接"语义不变量；代码生成只用节点 id，锚点只影响画布几何 |
| A4 | 节点 id = 元素记录 id（非生成序号） | 撤销/存储/代码三处同 id 可寻址；id 生成规则保证 mermaid 语法安全 |
| A5 | front-matter（YAML config）而非 `%%{init}%%` | v11 官方推荐、可读性好；与 dsh-fm 的 mermaid ^11.4.1 兼容 |
| A6 | mermaid 内联进 client bundle | dsh-fm 已验证；v1.1 再评估独立 lazy bundle |
| A7 | 无需媒体存储（无 putMedia/getMedia） | flowchart 无图片节点；接口预留 |
| A8 | 复制节点不复制关联边 | 跨引用复制语义复杂且需求未列；v1 明确边界并写入 README |
| A9 | 页面类型注册表 `interactive:false` 即"未来类型"占位 | 新类型 = 加注册项 + buildCode；设置面板自动降级提示 |
