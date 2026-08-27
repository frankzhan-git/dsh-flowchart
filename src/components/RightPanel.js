// dsh-flowchart components/RightPanel.js —— 右栏编排：设置 + 画布历史（同 wf RightPanel，高度可拖）
import React from 'react'
import { SettingsPanel } from './inspector/SettingsPanel.js'
import { DocumentPanel } from './docs/DocumentPanel.js'

const el = React.createElement

const HIST_MIN = 90
const HIST_DEFAULT = 190
const HIST_KEY = 'mm.histH'

export function RightPanel(props) {
  const [histH, setHistH] = React.useState(() => {
    try {
      const v = Number(localStorage.getItem(HIST_KEY))
      return Number.isFinite(v) && v >= HIST_MIN ? v : HIST_DEFAULT
    } catch (e) { return HIST_DEFAULT }
  })
  const [dragging, setDragging] = React.useState(false)
  const rightRef = React.useRef(null)
  const dragRef = React.useRef(null)

  React.useEffect(() => {
    try { localStorage.setItem(HIST_KEY, String(histH)) } catch (e) { /* 存储不可用则忽略 */ }
  }, [histH])

  const startResize = (ev) => {
    ev.preventDefault()
    const right = rightRef.current
    if (!right || !ev.currentTarget.setPointerCapture) return
    ev.currentTarget.setPointerCapture(ev.pointerId)
    dragRef.current = { startY: ev.clientY, startH: histH, maxH: Math.max(HIST_MIN, right.clientHeight - 220) }
    setDragging(true)
  }
  const moveResize = (ev) => {
    const d = dragRef.current
    if (!d) return
    setHistH(Math.max(HIST_MIN, Math.min(d.maxH, d.startH + (d.startY - ev.clientY))))
  }
  const endResize = () => { dragRef.current = null; setDragging(false) }

  return el('div', { ref: rightRef, className: 'mm-right' + (dragging ? ' mm-resizing' : '') },
    el('div', { className: 'mm-right-section', style: { flex: '1 1 auto', overflow: 'auto' } },
      el(SettingsPanel, props),
    ),
    el('div', {
      className: 'mm-resizer',
      title: '拖动调整画布历史高度',
      onPointerDown: startResize,
      onPointerMove: moveResize,
      onPointerUp: endResize,
      onPointerCancel: endResize,
    }),
    el(DocumentPanel, Object.assign({}, props, { height: histH })),
  )
}
