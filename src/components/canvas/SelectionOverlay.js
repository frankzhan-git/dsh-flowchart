// dsh-flowchart components/canvas/SelectionOverlay.js —— 多选外框（组移动/组边批量/组角等比）
import React from 'react'
import { groupBounds } from '../../core/geometry.js'

const el = React.createElement

export function SelectionOverlay(props) {
  const { doc, selectedIds } = props
  if (!selectedIds || selectedIds.length < 2) return null
  const gb = groupBounds(doc.nodes, selectedIds)
  if (!gb) return null
  const S = 5
  return el('g', null,
    el('rect', { className: 'mm-group-box', x: gb.x, y: gb.y, width: gb.w, height: gb.h }),
    // 四边手柄（批量改宽高）
    el('rect', { className: 'mm-group-handle', x: gb.x + gb.w / 2 - S, y: gb.y - S, width: S * 2, height: S * 2 }),
    el('rect', { className: 'mm-group-handle', x: gb.x + gb.w / 2 - S, y: gb.y + gb.h - S, width: S * 2, height: S * 2 }),
    el('rect', { className: 'mm-group-handle', x: gb.x - S, y: gb.y + gb.h / 2 - S, width: S * 2, height: S * 2 }),
    el('rect', { className: 'mm-group-handle', x: gb.x + gb.w - S, y: gb.y + gb.h / 2 - S, width: S * 2, height: S * 2 }),
    el('rect', { className: 'mm-group-handle', x: gb.x + gb.w - S, y: gb.y + gb.h - S, width: S * 2, height: S * 2 }),
  )
}
