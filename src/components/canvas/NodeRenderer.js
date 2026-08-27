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

export function NodeRenderer(props) {
  const { node, selected, editing, drawMode, onStartEdit, onCtxMenu } = props
  const isEditing = editing && editing.type === 'node' && editing.id === node.id
  const lines = String(node.text || '').split('\n')
  const translate = 'translate(' + node.x + ' ' + node.y + ')'
  return el('g', {
    transform: translate,
    className: 'mm-node' + (selected ? ' mm-node-selected' : ''),
    onDoubleClick: (ev) => { ev.stopPropagation(); onStartEdit(node) },
    onContextMenu: (ev) => { ev.preventDefault(); ev.stopPropagation(); onCtxMenu(ev, node) },
  },
    el('g', { className: 'mm-node-body' }, ...shapeEls(node.shape, node.w, node.h)),
    !isEditing ? el('text', { className: 'mm-node-label', x: node.w / 2, y: node.h / 2 },
      lines.map((ln, i) => el('tspan', { key: i, x: node.w / 2, dy: i === 0 ? 0 : 14 }, ln))) : null,
    // 绘制模式选中态：四角 resize 手柄（Q1——四角均可拖动缩放）
    (selected && drawMode) ? el('g', null,
      el('circle', { className: 'mm-node-handle', cx: 0, cy: 0, r: 4.5 }),
      el('circle', { className: 'mm-node-handle', cx: node.w, cy: 0, r: 4.5 }),
      el('circle', { className: 'mm-node-handle', cx: 0, cy: node.h, r: 4.5 }),
      el('circle', { className: 'mm-node-handle', cx: node.w, cy: node.h, r: 4.5 }),
    ) : null,
  )
}
