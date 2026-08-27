// dsh-flowchart components/canvas/NodeRenderer.js —— 节点渲染（形状注册表分派；纯展示）
// 事件约定：mousedown 不拦截（冒泡到 svg 由 core/interactions 统一决策——选择/箭头/移动），
//           本组件只处理双击（文本编辑）与右键（形状菜单）
import React from 'react'
import { shapeParts } from '../../core/shapes.js'

const el = React.createElement

// 形状描述子 → SVG 元素（fill/stroke 由 .mm-node-body 继承）
function shapeEls(shapeId, w, h) {
  return shapeParts(shapeId, w, h).map((p, i) => {
    const props = Object.assign({}, p.attrs)
    if (p.tag === 'polygon') props.points = String(props.points)
    return el(p.tag, { key: i, ...props })
  })
}

// 行高常量：与下方 tspan dy 一致（多行文本块整体垂直居中的基准）
const LINE_H = 14
// 组合矩形文本与顶边的间距（首行行盒顶 = 顶边 + PAD）
const GROUP_TEXT_PAD = 8

export function NodeRenderer(props) {
  const { node, selected, editing, drawMode, groupHover, creating, createCover, onStartEdit, onCtxMenu } = props
  const isEditing = editing && editing.type === 'node' && editing.id === node.id
  const lines = String(node.text || '').split('\n')
  // 普通控件多行垂直居中：<text> 锚定节点中心（dominant-baseline: central），逐行 tspan 从上到下排列；
  // 仅当首行 dy=0 时整块从中心向下悬挂（N 行偏离 (N-1)*LINE_H/2）——首行向上偏移半个块高，
  // 使文本块（1 行 / 2 行 / N 行）始终绕节点中心对称，横竖双居中。
  // 组合矩形（group）：文本显示在矩形顶部——左右居中（text-anchor: middle），首行行盒顶与顶边保留
  // GROUP_TEXT_PAD 间距，多行向下顺排（dy=0 起，逐行 LINE_H）。
  const isGroupNode = !!node.group
  const textY = isGroupNode ? GROUP_TEXT_PAD + LINE_H / 2 : node.h / 2
  const firstDy = isGroupNode ? 0 : -((lines.length - 1) * LINE_H) / 2
  const translate = 'translate(' + node.x + ' ' + node.y + ')'
  const cls = 'mm-node'
    + (selected ? ' mm-node-selected' : '')
    + (node.group ? ' mm-node-group' : '')
    + (groupHover ? ' mm-node-group-hover' : '')
    + (creating ? ' mm-node-create' : '')
    + (creating && createCover ? ' mm-node-create-cover' : '')
  return el('g', {
    transform: translate,
    className: cls,
    onDoubleClick: (ev) => { ev.stopPropagation(); onStartEdit(node) },
    onContextMenu: (ev) => { ev.preventDefault(); ev.stopPropagation(); onCtxMenu(ev, node) },
  },
    el('g', { className: 'mm-node-body' }, ...shapeEls(node.shape, node.w, node.h)),
    !isEditing ? el('text', { className: 'mm-node-label', x: node.w / 2, y: textY },
      lines.map((ln, i) => el('tspan', { key: i, x: node.w / 2, dy: i === 0 ? firstDy : LINE_H }, ln))) : null,
    // 绘制模式选中态：四角 resize 手柄（Q1——四角均可拖动缩放）
    (selected && drawMode) ? el('g', null,
      el('circle', { className: 'mm-node-handle', cx: 0, cy: 0, r: 4.5 }),
      el('circle', { className: 'mm-node-handle', cx: node.w, cy: 0, r: 4.5 }),
      el('circle', { className: 'mm-node-handle', cx: 0, cy: node.h, r: 4.5 }),
      el('circle', { className: 'mm-node-handle', cx: node.w, cy: node.h, r: 4.5 }),
    ) : null,
  )
}
