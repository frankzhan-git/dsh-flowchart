// dsh-mermaid core/page-types.js
// 职责：页面类型注册表（v1 仅 flowchart 可交互；其它类型注册表预留，标灰不可选）
// desc：业务语义 + 使用场景（设置面板 hover 浮窗展示；未来新增类型 = 加一行注册）
export const PAGE_TYPES = [
  { id: 'flowchart', label: '流程图', interactive: true, keyword: 'flowchart',
    desc: '业务流转 / 步骤与分支的表达。适合流程审批、操作步骤、业务链路、算法逻辑。' },
  { id: 'sequence', label: '时序图', interactive: false, keyword: 'sequenceDiagram',
    desc: '对象间消息的先后顺序。适合接口调用、协议交互、用例时序。' },
  { id: 'class', label: '类图', interactive: false, keyword: 'classDiagram',
    desc: '类 / 属性 / 方法与它们的关系。适合领域建模、代码结构设计。' },
  { id: 'state', label: '状态图', interactive: false, keyword: 'stateDiagram-v2',
    desc: '状态机的状态迁移。适合订单状态、审批状态、设备状态。' },
  { id: 'er', label: 'ER 图', interactive: false, keyword: 'erDiagram',
    desc: '实体 / 属性 / 关系。适合数据库表结构设计。' },
  { id: 'gantt', label: '甘特图', interactive: false, keyword: 'gantt',
    desc: '任务时间排期。适合项目计划、里程碑。' },
  { id: 'pie', label: '饼图', interactive: false, keyword: 'pie',
    desc: '占比统计。适合分布构成分析。' },
  { id: 'journey', label: '旅行图', interactive: false, keyword: 'journey',
    desc: '用户体验旅程（阶段 + 情绪）。适合用户旅程设计。' },
  { id: 'mindmap', label: '思维导图', interactive: false, keyword: 'mindmap',
    desc: '主题发散与层级归纳。适合头脑风暴、知识梳理。' },
  { id: 'timeline', label: '时间线', interactive: false, keyword: 'timeline',
    desc: '按时间顺序的事件。适合里程碑、发展史。' },
  { id: 'sankey', label: '桑基图', interactive: false, keyword: 'sankey-beta',
    desc: '流量 / 能量流动量。适合资源流向分析。' },
  { id: 'quadrantChart', label: '象限图', interactive: false, keyword: 'quadrantChart',
    desc: '二维分布定位。适合优先级矩阵、四象限分析。' },
  { id: 'gitGraph', label: 'Git 图', interactive: false, keyword: 'gitGraph',
    desc: '分支与合并历史。适合版本演进说明。' },
  { id: 'kanban', label: '看板', interactive: false, keyword: 'kanban',
    desc: '任务列与卡片。适合工作流看板。' },
  { id: 'packet', label: '通讯图', interactive: false, keyword: 'packet-beta',
    desc: '协议报文结构。适合网络协议讲解。' },
  { id: 'requirement', label: '需求图', interactive: false, keyword: 'requirementDiagram',
    desc: '需求与关系（包含 / 依赖）。适合需求规范说明。' },
]

export function pageTypeOf(id) {
  return PAGE_TYPES.find((p) => p.id === id) || PAGE_TYPES[0]
}

export function pageTypeOptions() { return PAGE_TYPES }
