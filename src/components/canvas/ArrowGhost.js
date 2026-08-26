// dsh-mermaid components/canvas/ArrowGhost.js —— 绘制中预览
// 两种模式：
//  - arrow（起笔画箭头）：吸附高亮 + 目标边缘实心圆点 + 跨页红叉
//  - anchor（锚点挪动）：完整箭头预览 + 两端圆点 + 脱离控件边的红叉（松开=取消连线）
import React from 'react'
import { anchorToWorld, edgeGeom } from '../../core/geometry.js'

const el = React.createElement

function crossMark(x, y) {
  return el('g', { transform: 'translate(' + x + ' ' + y + ')', className: 'mm-cross-mark' },
    el('path', { d: 'M-6 -6 L6 6 M6 -6 L-6 6', stroke: 'var(--mm-danger)', strokeWidth: 2.5, strokeLinecap: 'round' }),
  )
}

export function ArrowGhost(props) {
  const { ghost, mode } = props
  if (!ghost) return null

  // ---------- 锚点挪动预览 ----------
  if (mode === 'anchorDrag' && ghost.kind === 'anchor') {
    const g = edgeGeom(ghost.source, ghost.fromAnchor, ghost.target, ghost.toAnchor)
    const p0 = anchorToWorld(ghost.source, ghost.fromAnchor)
    const p1 = anchorToWorld(ghost.target, ghost.toAnchor)
    return el('g', null,
      el('path', { d: g.d, className: 'mm-edge-ghost' + (ghost.detach ? ' mm-edge-ghost-cross' : ''), markerEnd: 'url(#mm-arrow)' }),
      el('circle', { className: 'mm-anchor-handle', cx: p0.x, cy: p0.y, r: 4.5 }),
      el('circle', { className: 'mm-anchor-handle', cx: p1.x, cy: p1.y, r: 4.5 }),
      // 拖拽中的锚点圆点（跟随投影位置）
      el('circle', { className: 'mm-arrow-snap-dot', cx: ghost.dot.x, cy: ghost.dot.y, r: 5 }),
      ghost.detach ? crossMark(ghost.dot.x, ghost.dot.y) : null,
    )
  }

  // ---------- 起笔画箭头预览 ----------
  if (!ghost.source) return null
  const p0 = anchorToWorld(ghost.source, ghost.fromAnchor)
  let d = 'M' + p0.x + ' ' + p0.y
  let end = null
  if (ghost.target && ghost.toAnchor) {
    const g = edgeGeom(ghost.source, ghost.fromAnchor, ghost.target, ghost.toAnchor)
    d = g.d
    end = anchorToWorld(ghost.target, ghost.toAnchor)
  } else {
    d += ' L' + ghost.x + ' ' + ghost.y
    end = { x: ghost.x, y: ghost.y }
  }
  return el('g', null,
    el('path', { d, className: 'mm-edge-ghost' + (ghost.crossPage ? ' mm-edge-ghost-cross' : ''), markerEnd: ghost.crossPage ? undefined : 'url(#mm-arrow)' }),
    // 候选目标高亮 + 目标边缘最近点实心圆点（吸附可视反馈）
    ghost.target && !ghost.crossPage ? el('g', null,
      el('rect', {
        fill: 'none', stroke: 'var(--mm-accent)', strokeWidth: 2, strokeDasharray: '4 3',
        x: ghost.target.x, y: ghost.target.y, width: ghost.target.w, height: ghost.target.h,
        rx: 4, pointerEvents: 'none',
      }),
      el('circle', { className: 'mm-arrow-snap-dot', cx: end.x, cy: end.y, r: 4.5 }),
    ) : null,
    // 起点锚点圆点（起笔反馈）
    el('circle', { className: 'mm-arrow-snap-dot', cx: p0.x, cy: p0.y, r: 4 }),
    // 跨页取消红叉
    ghost.crossPage ? crossMark(end.x, end.y) : null,
  )
}
