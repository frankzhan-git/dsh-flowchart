// dsh-flowchart components/canvas/EdgeRenderer.js —— 单条箭头渲染（直/弧 + 箭头头 + 标签）
// 事件约定：mousedown 不拦截（冒泡到 svg 由 core/interactions 统一决策——箭头点选），
//           本组件只处理双击（标签编辑）；选中态锚点圆点由 CanvasStage 在节点层之上渲染（不被控件遮挡）
import React from 'react'
import { edgeGeom, nodeById } from '../../core/geometry.js'
import { edgeKindOf } from '../../core/edge-kinds.js'

const el = React.createElement

export function EdgeRenderer(props) {
  const { edge, doc, selected, editing, onStartEdit, onCtxEdge } = props
  const from = nodeById(doc, edge.from)
  const to = nodeById(doc, edge.to)
  if (!from || !to) return null
  const g = edgeGeom(from, edge.fromAnchor || { side: 'r', t: 0.5 }, to, edge.toAnchor || { side: 'l', t: 0.5 })
  const k = edgeKindOf(edge.kind)
  const cls = 'mm-edge'
    + (edge.kind === 'dotted' ? ' mm-edge-dotted' : '')
    + (edge.kind === 'thick' ? ' mm-edge-thick' : '')
    + (selected ? ' mm-edge-selected' : '')
  const attrs = { d: g.d, className: cls, markerEnd: k.marker === 'arrow' ? 'url(#mm-arrow)' : undefined }
  const hasLabel = typeof edge.label === 'string' && edge.label.length
  const isEditing = editing && editing.type === 'edge' && editing.id === edge.id
  return el('g', {
    onDoubleClick: (ev) => { ev.stopPropagation(); onStartEdit(edge) },
    onContextMenu: (ev) => { ev.preventDefault(); ev.stopPropagation(); onCtxEdge(ev, edge) },
  },
    el('path', attrs),
    hasLabel && !isEditing ? el('g', null,
      el('rect', {
        className: 'mm-edge-label-bg',
        x: g.mid.x - (edge.label.length * 6.4 + 10) / 2,
        y: g.mid.y - 10, width: edge.label.length * 6.4 + 10, height: 20, rx: 5,
      }),
      el('text', { className: 'mm-edge-label', x: g.mid.x, y: g.mid.y }, edge.label),
    ) : null,
  )
}
