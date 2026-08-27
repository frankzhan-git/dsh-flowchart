# Mermaid Flowchart 配置矩阵（官方支持 × 插件实现）

> 依据：插件内联渲染器 mermaid `11.17.2`（`mermaid/dist/config.type.d.ts` 官方类型定义）++
> 官方文档。分「业务语义」「呈现/排版配置」两栏；`✅`=已实现、`⚠️`=部分、`◻`=未实现。

## 一、业务语义（由画布直接编辑，与配置无关）

| 业务语义 | 承载形式 | 实现 |
|---|---|---|
| 节点是什么 | 形状（diamond=判定、cylinder=数据库…） | ✅ 14 种注册表 |
| 节点讲什么 | 节点文本（双击编辑） | ✅ |
| 谁连谁 | 边连接关系（画线） | ✅ |
| 流转含义 | 边类型（solid/dotted/thick/open） | ✅ 4 种 |
| 边上写什么 | 边标签（双击编辑） | ✅ |
| 图命名 | front-matter `title`（=页面名） | ✅ |

## 二、figchart 专属配置（flowchart.xxx）

| 键 | 说明 | 实现 |
|---|---|---|
| `nodeSpacing` | 同层节点间距 | ✅ 面板平铺外（含码生成） |
| `rankSpacing` | 层级间距 | ✅ |
| `curve` | 连线曲线（13 种：basis/bumpX/bumpY/cardinal/catmullRom/linear/monotoneX/monotoneY/natural/step/stepAfter/stepBefore/rounded） | ⚠️ 支持 7 种 |
| `padding` | 标签-形状间距（仅新实验渲染） | ◻ 面板已移除（数据层保留） |
| `htmlLabels` | HTML 标签（已 deprecated，改用全局） | ⚠️ 功能有，输出在 flowchart 层 |
| `diagramPadding` | 整图外边距 | ◻ |
| `titleTopMargin` | 图标题上边距 | ◻（title 已支持） |
| `subGraphTitleMargin` | 子图标题边距 | ◻（v1 无子图） |
| `arrowMarkerAbsolute` | 箭头 marker 绝对定位 | ◻ |
| `defaultRenderer` | 渲染引擎（dagre-d3/dagre-wrapper/elk） | ◻ |
| `wrappingWidth` | 文本换行宽度 | ◻ |
| `inheritDir` | 子图继承全局方向 | ◻（v1 无子图） |
| `useMaxWidth`（继承） | 自适应宽度 | ✅（面板此前提供，后随呈现项移除；数据层保留） |
| `useWidth`（继承） | 固定宽度 | ◻ |

## 三、全局配置（与 flowchart 渲染相关）

| 键 | 说明 | 实现 |
|---|---|---|
| `theme` | 11 主题（default/base/dark/forest/neutral/neo/neo-dark/redux*/null） | ⚠️ 面板曾提供 5 种（已随呈现项移除，数据层保留） |
| `fontFamily` / `fontSize` | 字体 / 字号 | ⚠️ fontFamily 数据层有；fontSize ◻ |
| `themeVariables` / `themeCSS` | 主题变量 / 自定义 CSS | ◻（config.advanced 透传位预留） |
| `look` + `handDrawnSeed` | 手绘风格（classic/handDrawn/neo） | ◻（v0.2 候选） |
| `layout` + `elk.*` | ELK 布局引擎参数 | ◻ |
| `htmlLabels`（全局推荐位） | HTML 标签 | ⚠️ 同 flowchart.htmlLabels |
| `maxTextSize` / `maxEdges` | 渲染保护上限 | ◻（引擎默认） |
| `wrap` / `markdownAutoWrap` | markdown 自动换行 | ◻ |
| `securityLevel` | 安全级别 | ✅ 固定 strict（不暴露） |

## 四、图级语法（非 config）

| 项 | 说明 | 实现 |
|---|---|---|
| `direction` | TD/TB/BT/LR/RL | ✅ |
| front-matter `title` | 图命名 | ✅ |
