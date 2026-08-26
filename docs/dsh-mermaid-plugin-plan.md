# dsh-mermaid 开发计划（M0–M8）

> 依据：《dsh-mermaid-plugin-design.md》（产品/交互/已确认决策 Q1–Q5）、《dsh-mermaid-plugin-architecture.md》（架构/数据模型/注册表/存储/里程碑）、《dsh-mermaid-plugin-dev-standards.md》（开发范式规范）
> 参照实现源码：dsh-wf-plugin（交互/存储/宿主半范式）、dsh-fm-plugin（正式版发布链路 + mermaid 内联）
> 目标：产出可安装、可验证、可交付的正式版插件 `dsh-mermaid`（npm 名），v1 = Flowchart

---

## 里程碑总览

| 里程碑 | 交付物 | 验证方式 |
|---|---|---|
| M0 骨架 | package.json / cordis.patch.yml / build.mjs / 槽位按钮+空浮层 | `npm run build` 成功；浏览器可见「流程图」按钮 |
| M1 页面与节点 | model / geometry / shapes / 绘制模式（建页/建节点）/ 移动 / 模式即语义 resize | verify-interactions + 手工清单 1–3 |
| M2 箭头 | ARROW_DRAW 状态机 / 吸附 / 跨页取消 / 选中删除 / 标签编辑 / 直弧判定 | verify-interactions + 清单 4–7 |
| M3 形状与菜单 | shapes 14 项 + NodeRenderer 分派 + 右键缩略图菜单 + 页面菜单 | verify-shapes + 清单 7 |
| M4 批量与撤销 | 框选 / 组移动 / 组边 / 组角 / 撤销重做 / 缩放还原 | verify-interactions + 清单 8 |
| M5 代码生成与预览 | codegen / 代码浮窗 / 渲染预览浮窗（内置渲染器）/ 复制 / 插入 | verify-codegen + verify-preview + 清单 0、9–12 |
| M6 设置面板 | config-schema 注册表 + SettingsPanel（右栏）+ front-matter 输出 | verify-codegen + 清单 9 |
| M7 宿主存储 | lib 四件套 + wire + @Remote + domainAdapter + localStorage 兜底 + 画布历史 | verify-storage / verify-host-storage / verify-adapter-contract + 清单 13 |
| M8 打包发布 | sync-release 复用（release 目录）+ 安装冒烟 + 交付说明 | `npm run verify` 全绿 + `dsh plugin add` 冒烟 |

## 任务拆解（每日粒度）

### 阶段一：工程与领域层（M0–M1）
1. `dsh-mermaid-plugin/` 脚手架：`package.json`（name dsh-mermaid，exports ./.client/./cordis.patch.yml，dsh.client.inject 四件套，dsh.bundle.patch，deps zod+mermaid+@deepseek-ai/dsh-typert-protocol，dev esbuild）
2. `cordis.patch.yml`：`- insert: [{ id: dsh-mermaid, name: dsh流程图 }]`；`scripts/build.mjs`：esbuild → lib/client.js（external react/@deepseek-ai/*，banner id=name）
3. `src/core/model.js`：Doc/Page/Node/Edge 工厂、id 前缀（p/n/e）+ reserveSeqs、clone、min 尺寸
4. `src/core/geometry.js`：相机（toLocal/zoomAt/computePan）、命中（handleMetrics/hitEdgeOf/hitPriority，模式即语义）、锚点换算（anchorToWorld）、包围盒、路径采样
5. `src/core/shapes.js`：14 形状注册表（id/label/syntax/minSize/render）+ shapeThumbs 派生
6. `src/core/edge-kinds.js`：4 边类型 → 语法；`src/core/page-types.js`：flowchart 注册（configSchema/buildCode 委托 codegen）；`src/core/config-schema.js`：文档/页面/节点/箭头配置注册表

### 阶段二：交互与渲染（M2–M4）
7. `src/core/interactions.js`：decidePointerDown/updateDrag/settleDrag 全 phase：CREATE_PAGE/CREATE_NODE/MOVE/RESIZE（draw 模式边+角）/ARROW_DRAW/MARQUEE/GROUP_EDGE_RESIZE/GROUP_CORNER_RESIZE/PAN + 直弧判定 edgeKind + 吸附 alg（node+page）+ 框选结算 + 快捷键命令
8. `src/hooks/useDocState.js`：doc 状态 + 撤销栈 + 800ms 自动保存调度；`useCanvasInteractions.js`：事件绑定 + 命令执行（含 Alt/空格键盘对账）；`useCanvasEdit.js`：文本编辑/右键菜单/形状菜单
9. `src/components/canvas/*`：CanvasStage（SVG 相机 + 图层序：页面底→EdgeLayer→NodeRenderer→SnapLines→ArrowGhost→SelectionOverlay→文本浮层）、CanvasOverlay（四角按钮 + floatTab 浮窗）、EdgeRenderer（直/弧 + 箭头头 + 标签）、ArrowGhost、SnapLines、SelectionOverlay、NodeRenderer（形状分派 + 居中多行文本）

### 阶段三：代码一等公民（M5–M6）
10. `src/core/codegen.js`：normalize→serialize→validate 三段；front-matter config；转义（引号/<br/>）；方向归一；多页分块；`src/core/pipeline.js`：doc→代码 + issues
11. `src/core/preview.js`：mermaid 封装（initialize strict / render 去临时 DOM / 错误清洗）
12. `src/components/preview/*`：CodeView（只读+高亮+行号+复制）、RenderPreview（防抖 500ms + 错误摘要）；`src/components/inspector/*`：SettingsPanel（右栏）+ PropField + ShapePicker（缩略图网格）
13. 插入管线：`buildInsertText`（引导语/仅代码两档）→ inputActions.setDraft（MermaidModal 接 useInput/inputActions，与 wf 一致）

### 阶段四：存储与宿主（M7）
14. `src/core/storage/*`：CanvasStore 接口 / schema / migrate / integrity / remote（contribution+createDomainRemote）/ adapters（domain + localStorage）
15. `lib/wire.js`（zod 单源 + MM_INVOCATIONS）/ `lib/typert.host.js` / `lib/mermaid-service.js`（目录文件原子写/meta 缓存/.corrupt/写链串行）/ `lib/index.js`（ctx.get('typert') 可选）
16. 右栏：RightPanel（设置 + 画布历史，高度可拖）+ DocumentPanel（最近打开/新建/重命名/删除/导出/导入）

### 阶段五：验证与交付（M8）
17. `scripts/verify-*.mjs`：shapes（语法表 + mermaid.parse smoke 尽力）、codegen（转义/方向/默认值省略/多页/孤儿边）、interactions（直弧/吸附/跨页取消/锚点随动/钳制/框选/组边组角/粘贴 id）、storage（patch 往返/损坏隔离/迁移/导入）、host-storage（内存 fs + smoke-storage 真 fs）、adapter-contract、perf（300 节点+200 边基线）、preview（mermaid.render 成功/错误不白屏）
18. `npm run build` + `npm run verify` 全绿 + 手工验收清单（产品设计第 5 章）逐项勾选
19. 交付：README（安装/使用/架构）、CHANGELOG v0.1.0、schema.json、安装冒烟（dsh plugin add + junction）

## 风险与决策（已定稿）
- 决策引用：Q1 模式即语义（选择=箭头无手柄；绘制=宽高/角手柄）、Q2 对接直弧、Q3 内置渲染器、Q4 仅 Flowchart、Q5 引导语+代码块、E1–E6
- 布局：CanvasOverlay 四角按钮 + 右栏（设置 + 画布历史），与 dsh-wf 完全对齐
