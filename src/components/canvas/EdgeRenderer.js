// dsh-flowchart components/canvas/EdgeRenderer.js —— 单条箭头渲染（直/弧 + 箭头头 + 标签）
// 事件模型（0.2.8）：选择/双击/右键全部由 svg 层按坐标决策路由（core/hitPriority）——
//   本组件纯展示，不注册任何指针/菜单事件（组合矩形不再抢占成员箭头的事件面）
import React from 'react'
import { edgeGeom, nodeById, edgeLabelRect } from '../../core/geometry.js'
import { edgeKindOf } from '../../core/edge-kinds.js'

const el = React.createElement

export function EdgeRenderer(props) {
  const { edge, doc, selected, editing } = props
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
  const lr = hasLabel && !isEditing ? edgeLabelRect(g, edge.label) : null
  return el('g', null,
    el('path', attrs),
    lr ? el('g', null,
      el('rect', {
        className: 'mm-edge-label-bg',
        x: lr.x, y: lr.y, width: lr.w, height: lr.h, rx: 5,
      }),
      el('text', { className: 'mm-edge-label', x: g.mid.x, y: g.mid.y }, edge.label),
    ) : null,
  )
}
