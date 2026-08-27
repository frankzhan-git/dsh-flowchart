// dsh-flowchart components/canvas/SnapLines.js —— 吸附虚线
import React from 'react'

const el = React.createElement

export function SnapLines(props) {
  const { lines, pan, vw, vh } = props
  if (!lines || !lines.length) return null
  return el('g', null,
    lines.map((l, i) => l.axis === 'v'
      ? el('line', { key: i, className: 'mm-snap', x1: l.pos, y1: pan.y, x2: l.pos, y2: pan.y + vh })
      : el('line', { key: i, className: 'mm-snap', x1: pan.x, y1: l.pos, x2: pan.x + vw, y2: l.pos })),
  )
}
