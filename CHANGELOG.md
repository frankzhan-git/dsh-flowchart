# Changelog

## 0.2.5 (2026) — 跨实例互通修复（移除 meta 缓存）

- **fix(跨实例)**：`listMeta`/`getMeta` 不再读「启动时扫描的内存 cache」——改为**每次实时读磁盘**（`readAllMeta`/`readMetaOf`）。此前单实例自写自读自洽，但**跨实例写入（如 :3080 写 → :3090）永远不可见**，导致「另一端口画的画布刷新后看不到」。移除后同一 `DSH_HOME` 下任一端口的写入，对所有端口的下一步读取立即可见（写入方落盘 = 全局可见点）。
- **fix(一致性)**：`saveMeta`/`saveBody`/`remove`/`clear` 不再维护 cache（读-改-写仍经写队列保证原子性）；损坏隔离/临时清扫行为不变。
- **chore**：verify 8 套件 + 网关级预验证全绿。
- **发布**：dsh-flowchart@0.2.5

## 0.2.4 (2026) — 存储管线贯通 + 官方范式重构

- **fix(新建崩溃)**：`useCanvasInteractions` 返回对象缺失 `setSnapLines`，导致「新建画布」即刻 TypeError（任何存储调用之前）——补齐导出。
- **fix(线协议调用形态)**：客户端按 rc.2 网关**位置参数范式**直调命名空间服务（`ns.listMeta(q)` / `ns.saveBody(id, patch)`）；此前传单对象导致 `getMeta`/`loadBody`/`saveBody` 的 zod 参数解码失败，`listMeta` 靠 strip 侥幸通过——「列表可见但点不开」的根因。
- **fix(宿主契约)**：`saveMeta`/`saveBody` 补齐 `return ok()`（网关结果边界校验）；`removeCanvas`（`implementation: remove`）经网关别名验证。
- **refactor(客户端)**：移除 `createDomainRemote` 适配层，`domainAdapter(ns)` 按官方消费范式（驻扎插件注入 `remote.flowchartStorage`）直调命名空间。
- **refactor(宿主)**：`typertRemote` 绑定内聚到服务自身（`createFlowchartService` 构造时完成）；`@deepseek-ai/dsh-typert-protocol` 升级 `0.1.0-rc.7 → 0.1.1-rc.2` 与运行时网关对齐。
- **feat(多实例)**：数据存储保持「每画布单文件 + 每次操作实时磁盘读」——经实证该设计天然支撑双 DSH 实例（:3080/:3090）共享 `~/.dsh/storages/` 的实时互通（官方 storageDomain 内存态实测无法支撑，架构决策已文档化于服务头部）。
- **chore**：verify 套件 8 项全绿 + 新增 `scripts/verify-live-gateway.mjs`（真实 TypertRegistry/Gateway 网关级预验证）。
- **发布**：dsh-flowchart@0.2.4

## 0.2.2 (2026) — 全面改名 dsh-flowchart + 数据迁移

- **命名统一**：源码/文档所有 `dsh-mermaid` 标识改为 `dsh-flowchart`——插件行 id、插件 `name`、线协议描述符（`dsh-flowchart#flowchartStorage/*`）、服务名 `flowchartStorage`、远程贡献名、存储命名空间、localStorage 键前缀、error 文案；组件文件同步改名（FlowchartModal/FlowchartButton/flowchart-service）
- **数据迁移**：旧命名空间 `storages/dsh-mermaid/`（v0.2.1 及之前）启动时整目录改名到 `storages/dsh-flowchart/`（目标已存在则不动作，不覆盖新数据）；旧 MANIFEST（plugin 标识 dsh-mermaid）被接受保留（不当作损坏）；localStorage 旧键 `dsh-mermaid:*` 一次性迁移到 `dsh-flowchart:*`（新键已存在则不迁移）
- **仓库**：GitHub 仓库重命名为 `frankzhan-git/dsh-flowchart`（旧地址自动 301 重定向）；本地目录/发布目录同步改名
- **发布**：dsh-flowchart@0.2.2

## 0.2.1 (2026) — npm 修复：发布包缺失 src

- **修复**：宿主半区 `lib/mermaid-service.js` 运行时会 `import ../src/core/storage/integrity.js`，发布包 `files` 白名单补上 `src`（本地 link: 开发未暴露；npm 版 0.2.0 缺该文件，请升至 0.2.1）
- **发布**：dsh-flowchart@0.2.1

## 0.2.0 (2026) — npm 首发 + 改名

- **包名**：`dsh-mermaid` → `dsh-flowchart`（npm 上 `dsh-mermaid` 已被占用）；模块名 `dsh流程图` → `dsh-flowchart`（patch name + build.mjs banner id 同步）
- **package.json**：移除 `private`，新增 license（MIT）/repository/author/keywords/engines/files；`mermaid` 移至 devDependencies（client 已内联）
- **发布**：首次发布 npm（dsh-flowchart@0.2.0）

## 0.1.0 (2025-12)

正式版首个版本（对齐产品设计 Q1–Q5 定稿 + 七范式架构）：
- 双模式画布（选择 / 绘制，Alt 临时绘制 + 键盘对账）
- 页面（类型注册表预留，v1 仅 Flowchart）+ 14 种 mermaid 流程图形状（右键缩略图菜单）
- 箭头：选择模式贴边绘制、同页吸附、跨页红叉取消、锚点归一化随动、直/弧自动判定、标签双击编辑、可点选删除
- 模式即语义（Q1）：选择模式贴边=箭头；绘制模式贴边=宽高、右下角=resize
- 画布交互：平移/缩放/一键还原/撤销重做/框选/批量移动/批量宽高/批量等比
- 代码一等公民（C1–C3）：normalize→serialize→validate 管线，任意状态恒产出可解析代码；
  front-matter 配置（主题/方向/curve/间距/HTML 标签仅非默认值）
- 预览：代码浮窗（复制当前页/全部）+ 渲染预览浮窗（内置 mermaid 渲染器，500ms 防抖）
- 插入会话：引导语 + 代码块（可切「仅代码」）
- 存储：宿主命名空间目录（`~/.dsh/storages/dsh-mermaid/` 清单 + canvases 原子写）+ @Remote 网关（zod 线协议）+ localStorage 兜底
- 右栏（设置 + 画布历史）、文档管理（新建/重命名/删除/导出/导入）
- 验证：7 套件（shapes/codegen/interactions/storage/host-storage/adapter-contract/perf）全绿

### 体验迭代（首轮人工反馈）

- **落盘目录管理规范化（不滥用 .dsh）**：
  - 命名空间布局 `~/.dsh/storages/dsh-mermaid/{MANIFEST.json, canvases/}`——插件唯一子目录，
    不再与 `storages/` 顶层其它插件/官方域平铺混放
  - MANIFEST.json 命名空间清单（schemaVersion/插件标识/创建时间）缺失或损坏自动重建（损坏改名 .corrupt）
  - `canvases/{id}.json` 每画布原子写（同目录临时文件 + fsync + rename）；`.corrupt` 读时隔离；
    `.*.tmp` 残留启动扫描自动清扫
  - 旧目录 `storages/mermaid-canvases/` 启动一次性迁移：只入不覆盖；迁完删除空壳，
    有冲突残留改名 `.migrated` 标记
- 入口按钮改用 dsh 内置图标（`IconBranchOutline16`，对齐 wf SketchButton 形态与样式）
- 修复：节点/箭头组件不再拦截 mousedown——选择/绘制/箭头全部交由 core 交互状态机统一决策
  （此前节点上无法拖动、选中后无法从边带起笔绘制箭头）
- 选择模式贴边绘制箭头时：靠近目标控件边缘显示「吸附实心圆点」（起点锚点同款圆点反馈）
- 画布右下角操作区改为单行（撤销/重做/清空 + 缩放%），移除「插入」文字快捷按钮
- 底部「插入到会话」主按钮样式对齐「取消」按钮（accents 边框 + 同源可见文字，修复白底白字）
- 渲染预览：渲染 id 每次唯一 + 失败残留 DOM 清理（修复 mermaid.render 重复 id 报错导致的连续渲染失败）
- 画布历史完整对齐 dsh-wf DocumentPanel：标题+数量+新建/导入、行 hover「改名/导出/删除」、
  双击改名、行内删除二次确认、日期只显示日期、固定行高防抖动

### 锚点微调（第二轮人工反馈）

- **箭头首尾锚点可调**：点击选中箭头 → 两端出现实心圆点手柄（`ANCHOR_DRAG` 状态机）；
  按住圆点沿控件边挪动（投影归一化 `{side, t}`，支持跨边切换 side），箭头实时预览；
  **脱离控件边吸附并松开 = 取消连线**（删除箭头）；吸附态松开 = 按圆点位置确定锚点
- 命中优先级：选中箭头的锚点圆点 > 节点边带语义（贴边的圆点不再误触发「箭头起笔」）
- 选中/未选中箭头视觉差异化：未选中 = 细线低饱和（1.5px + 0.85 透明度）；选中 = accent
  粗线（3px）+ 首尾实心圆点，对比明显
- 按钮样式去白框：主题 accent/border 变量在部分 DSH 主题下解析为浅色导致主按钮白框、
  点击后系统 focus 白圈——所有底栏按钮改为「边框透明 + 同源背景文字 + 字重区分主次 +
  固定色 focus outline」
- 锚点微调修复：① 首尾锚点圆点改在**节点层之上**渲染（原在箭头层被控件盖住一半）；
  ② `useCanvasInteractions` 补上 `anchorDrag` 分支（此前决策返回后拖动从未启动，
  圆点按住无法移动）

### 第三轮修复

- **Delete/Backspace 删除失败率高防御**：删除键处理提前至 keyboard handler 最优先位置，
  `preventDefault` 恒执行（浏览器默认 Backspace=后退会触发 SPA 页面前退/重载——
  即「关闭弹窗且无法再启动」的根因）；删除逻辑 try/catch 包裹，异常 toast 提示不再静默崩溃
- **配置区只保留 mermaid code 范式支持项**：移除「页面类型」下拉（v1 仅 Flowchart，
  置灰项全部删除，改为只读「流程图」）；移除节点「宽/高」数值输入（mermaid 引擎自算尺寸，
  非 code 参数）；保留 theme/fontFamily/direction/curve/nodeSpacing/rankSpacing/padding/
  useMaxWidth/htmlLabels（flowchart.* 全部官方键）+ 形状/文本/边类型/边标签

### 第四轮修复

- **页面宽高调整**（参考 dsh-wf 能力，交互遵循 Q1 语义）：仅**绘制模式**（按住 Alt 或徽标进入）
  下，贴页面边拖 = 改单边宽高、右下角 = resize（最小 200×120）；选择模式页面边带不拦截
  （维持框选语义），页面移动仍走左上角标题条；新增 `pageResize` 状态机 + 命中层级
  （节点 > 箭头 > 页面标题条 > 页面边带/角）
- **空文本节点渲染报错修复**：`n1[""]` 空字符串 label 触发 mermaid SQE 语法错误
  （Parse error on line 2 ... got 'SQE'）——空文本统一输出 `[" "]`（单空格空标签，
  全部 14 形状语法均合法），verify-codegen 新增单节点空文本可解析断言

### 第五轮（hover 光标语义）

- **绘制模式下 hover 光标随操作区切换**：`core/interactions` 新增纯函数 `hoverCursorFor` ——
  节点/页面边带 → `ew-resize`（左右）/ `ns-resize`（上下）、右下角 → `nwse-resize`、
  空白 → 十字（crosshair 兜底）；选择模式点住选中箭头的锚点圆点 → `grab`；
  空格平移期间强制 `grab/grabbing`；拖动结束/离开画布自动清空回退
- verify-interactions 新增 9 条 hover 光标断言

### 第六轮（四角 resize）

- **控件与页面四角全部支持 resize**（原先仅右下角）：`geometry.hitCornerOf` 四角命中
  （内区 cin × 外扩 cout，多角重叠取距角点最近者；边带端头缩进让出角区）；
  `computeResize/computePageResize` 重构为「移动边集合」模型——四角 = 锚定对角的自由缩放
  （含左右/上下单边吸附、页面钳制、最小尺寸），四边行为不变
- 光标：左上/右下 → `nwse-resize`；右上/左下 → `nesw-resize`
- 绘制模式选中节点显示**四角手柄圆点**（原仅右下角）
- verify-interactions 新增 20+ 条四角断言（命中 side / 锚定对角随动 / 页面四角 / 对角光标）

### 第七轮（面板收敛 + 右键优化）

- **修复「部分设置无法设置」**：页面配置项（curve/间距/padding 等）此前被写入 page 顶层而非
  page.config，codegen 读不到——统一写入 `page.config`（方向仍顶层），设置立即生效并进入
  front-matter 输出
- **设置区帮助文案**：config-schema 每项增加 `desc` 说明（PropField 渲染灰色小字）——
  主题/字体/方向/连线曲线/节点间距/层级间距/节点内边距/缩放适应宽度/HTML 标签均给出
  mermaid 语义解释
- **移除画布历史「新建」按钮**（全局右上角已有新建入口，避免重复）
- **设置面板移除节点区块**（形状/文本已由右键「更换形状」+ 双击文本承担，避免双入口）
- **右键「更换形状」优化**：hover 即展开形状菜单（移出收起，点击也可切换）；
  缩略图由 56×28 缩小为 **32×16、4 列网格、去掉文字标签**（hover title 显示中文名）

### 第八轮（Backspace 根修 + 页面选中删除）

- **Backspace 关闭弹窗根修**：改为 **window 捕获阶段**拦截 `keydown`
  （在 DSH 页面任何内部处理之前 `preventDefault + stopPropagation`）——
  此前 document 冒泡监听可能被外层处理抢先/吞掉，浏览器默认 Backspace=页面前退
  仍是「面板关闭」的直接来源；捕获监听与冒泡监听共用同一删除入口
- **Backspace/Delete 删除页面**：新增页面选中态（`selectedPage` 三通道选中：
  节点集/箭头/页面）——点击**页面标题条**即选中页面（虚线框变 accent 实线高亮）；
  删除优先级 **页面 > 箭头 > 节点**，页面删除连带节点与箭头（可撤销）；
  verify-interactions 新增标题条选中断言

### 第九轮（设置解释 → ⓘ hover 浮层）

- 字段解释从「字段下方常驻小字」改为**字段标题后的 ⓘ 图标**：hover（或键盘 focus）时
  在图标上方弹出解释浮层（React portal 渲染到 body，fixed 定位——不被右栏滚动容器裁剪）；
  鼠标移出/失焦自动消失；无 desc 的字段不显示图标
- 图标与浮层样式随主题（深色配色 + 边框阴影，help 光标），z-index 高于画板浮层
- **浮层主题一致性修复**：tooltip portal 到 body 后脱离 `.mm-mask` CSS 变量作用域导致
  背景/文字透明——浮层自带主题 token 定义（DSH alias + fallback），背景/边框/文字/
  阴影全部随主题；ⓘ 图标去掉底色圆形，改为次级文字色 + hover 品牌色（无白色）

### 第十轮（图命名 + 预览收敛）

- **Mermaid 图命名**：mermaid 官方支持 front-matter `title` 字段为图命名
  （PR mermaid-js/mermaid#3706「Title support via front matter ... graph diagrams」）——
  页面名即图名，codegen 输出 `title: <页面名>`（置于 config 之前，YAML 转义安全）；
  渲染预览图中上方显示标题，验证新增 title 断言
- **预览浮窗移除「复制当前页」按钮**（渲染预览仅展示；复制统一走「代码」浮窗的
  「复制全部」与底栏「插入到会话」）

### 第十一轮（设置面板 → 纯业务语义）

- **剔除非业务语义设置**：面板移除文档级（主题/字体）与页面级排版配置
  （方向/连线曲线/节点间距/层级间距/内边距/自适应宽度/HTML 标签）——
  全部纯呈现/风格，不改变图结构；codegen 数据层完整保留（旧数据/高级透传继续正确输出）
- **全局语义设置归入页面设置**：图命名（**图名**输入 = 页面名 = mermaid `title`）
  进入「页面」区，与类型/当前页面切换同节
- **连线语义设置归入箭头设置**：箭头区保留「连线类型」（实线/虚线/粗线/无箭头）
  +「标签」（连线语义）；节点语义（形状/文本）继续由画布直接编辑（右键/双击/手柄）

### 第十二轮（连线 hover 提示 + 漂移防御）

- **连线起点 hover 预览**：选择模式鼠标贴近节点边带/角（未按下）即在边缘最近点显示
  **半透明起点圆点** + 光标切 `crosshair`——“按住此处 = 开始连线”按下前即可感知；
  按下即以该锚点起笔（与先前决策一致）；页面标题条 hover = `move` 光标
- **控件漂移防御**（如 C 从流程页面飞到页面1）：
  ① 批量改宽高（组边）与批量等比（组角）结果按各节点**所属页面钳制**（不允许越页）；
  ② 载入清洗（sanitizeDoc）对**孤儿节点**（pageId 指向不存在的页面——缺失钳制的漂移根因）
  自动归属：中心在页面内 → 该页；否则归首页；不存在“无归属节点”

### 第十三轮（设置面板随选中联动 + 平铺单选）

- **业务管线梳理（选中对象 → 面板映射，三通道互斥选中）**：
  `选中页面 → 页面配置`｜`选中节点 → 节点配置`｜`选中箭头 → 箭头配置`｜`无选中 → 空态`
  ——修复「箭头选中后配置消失」（上轮仅页面有配置，其余落入空态）；
  面板与画布通道（右键形状/类型菜单、双击文本/标签、手柄尺寸）并存，不互相替代
- **取消下拉选框 → 平铺单选 + 图例**：
  - 页面「图类型」：16 种类型**平铺卡片**（二字符徽标图例 + 名称），单选高亮；
    v1 仅 Flowchart 可选，其余**标灰不可选**（title 提示「该类型将在后续版本提供」）
  - 控件「形状」：14 种**平铺缩略图卡片**（复用 shapeThumb 图例 + 名称），单选高亮
  - 箭头「连线类型」：4 种**平铺线型示意卡片**（实/虚线+箭头粗线/无箭头 SVG 图例），单选高亮
  - 右键「更换控件类型」功能保留（与面板平铺并存）

### 第十四轮（面板收敛 + 语义解释）

- **面板移除可画布编辑的字段**：图名（页面）、控件文本（节点）、箭头标签——全部由
  画布双击编辑承担；面板只保留**语义类型选择**（图类型 / 形状 / 连线类型）
- **选项语义解释（hover 浮窗）**：通用 `HoverTip` 组件（portal + fixed 定位，不被滚动容器裁剪）——
  页面类型 16 项、形状 14 项、连线类型 4 项全部补充 `desc`（业务语义 + 使用场景），
  鼠标划入对应平铺选项即浮窗显示，例如：菱形=条件判定/分支（决策点）、
  虚线箭头=可选流/数据流（非必经路径）、流程图=业务流转表达（审批/步骤/算法逻辑）

### 第十五轮（选择器视觉统一）

- **控件 / 箭头类型选择与图类型完全同规格**：统一 **2 列布局**、同卡片尺寸、
  同 16px 图例槽位；图例内容不变（形状=当前形状缩略图、箭头=当前箭头线型示例、
  图类型=徽标）
- **配色统一**：图例一律「无底色块 + currentColor」——常规次级文字色、悬停正文色、
  选中 accent（徽标去掉背景/边框，与形状/线型图例同规则）
