// dsh-flowchart core/edge-kinds.js
// 职责：边类型注册表（id/label/语法片段/渲染样式/语义描述）；未来 --o/--x/--* 等 = 加行即得
// desc：连线语义 + 使用场景（设置面板 hover 浮窗）
export const EDGE_KINDS = {
  solid: { label: '实线箭头', dash: null, width: 2, marker: 'arrow', open: false,
    desc: '默认控制流。步骤之间的主流转关系。',
    // A -- label --> B
    conn: (label) => (label ? [' -- ', ' --> '] : [' --> ']) },
  dotted: { label: '虚线箭头', dash: '4 3', width: 2, marker: 'arrow', open: false,
    desc: '可选流 / 数据流 / 提示关联。非必经路径或旁路关系。',
    // A -. label -.-> B
    conn: (label) => (label ? [' -. ', ' -.-> '] : [' -.-> ']) },
  thick: { label: '粗线箭头', dash: null, width: 3, marker: 'arrow', open: false,
    desc: '强调的主路径。关键的核心流转。',
    // A == label ==> B
    conn: (label) => (label ? [' == ', ' ==> '] : [' ==> ']) },
  open: { label: '无箭头连线', dash: null, width: 2, marker: 'none', open: true,
    desc: '无方向的关联。并列 / 从属关系，不表达流向。',
    // A --- B / A --- label --- B
    conn: (label) => (label ? [' --- ', ' --- '] : [' --- ']) },
}

export function edgeKindOf(id) {
  return EDGE_KINDS[id] || EDGE_KINDS.solid
}

export function edgeOptions() { return Object.keys(EDGE_KINDS) }

// 边语句：from + conn0 + label + conn1 + to（无 label 时合并为完整连接）
export function edgeStatement(fromId, toId, kindId, label) {
  const k = edgeKindOf(kindId)
  const has = typeof label === 'string' && label.length
  const c = k.conn(has ? label : null)
  return has
    ? fromId + c[0] + label + c[1] + toId
    : fromId + c[0] + toId
}
