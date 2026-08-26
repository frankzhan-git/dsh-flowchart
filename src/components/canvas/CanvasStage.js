// dsh-mermaid components/canvas/CanvasStage.js —— SVG 相机 + 图层编排（纯展示 + 事件转发）
// 图层：页面底 → 箭头 → 节点 → 吸附/幽灵箭头 → 框选/多选 → 行内文本浮层（foreignObject）
import React from 'react'
import { CANVAS_W, CANVAS_H } from '../../core/model.js'
import { edgeGeom, anchorToWorld, nodeById } from '../../core/geometry.js'
import { NodeRenderer } from './NodeRenderer.js'
import { EdgeRenderer } from './EdgeRenderer.js'
import { SnapLines } from './SnapLines.js'
import { SelectionOverlay } from './SelectionOverlay.js'
import { ArrowGhost } from './ArrowGhost.js'

const el = React.createElement

export function CanvasStage(props) {
  const {
    doc, selectedIds, selectedEdge, selectedPage, editing, mode, zoom, pan, spaceDown, drag,
    svgRef, viewRef, canvasCursor, snapLines, hoverAnchor,
    onMouseDown, onMouseMove, onMouseUp, onMouseLeave,
    onStartEditNode, onStartEditEdge, onStartEditPage,
    onCtxNode, onCtxEdge, onCtxPage, onCtxCanvas, onEditChange, onEditDone,
  } = props

  const vw = CANVAS_W / zoom
  const vh = CANVAS_H / zoom
  const spaceCls = spaceDown
    ? (drag && drag.mode === 'pan' ? ' mm-canvas-pan' : ' mm-canvas-space')
    : ''
  const pageDir = { TD: '↓', TB: '↓', BT: '↑', LR: '→', RL: '←' }

  const nodesOf = (pageId) => doc.nodes.filter((n) => n.pageId === pageId)
  const edgesOf = (pageId) => doc.edges.filter((e) => e.pageId === pageId)

  return el('div', { className: 'mm-canvas-view', ref: viewRef },
    el('svg', {
      ref: svgRef,
      className: 'mm-canvas' + (mode === 'draw' ? ' mm-canvas-draw' : '') + spaceCls,
      viewBox: pan.x + ' ' + pan.y + ' ' + vw + ' ' + vh,
      preserveAspectRatio: 'xMidYMid meet',
      style: { cursor: canvasCursor },
      onMouseDown, onMouseMove, onMouseUp, onMouseLeave,
      onContextMenu: (ev) => { ev.preventDefault(); onCtxCanvas(ev) },
    },
      el('defs', null,
        el('marker', {
          id: 'mm-arrow', viewBox: '0 0 10 10', refX: 8.5, refY: 5,
          markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse',
        },
          el('path', { d: 'M0 0 L10 5 L0 10 Z', fill: 'context-stroke', stroke: 'none' }),
        ),
      ),
      el('rect', { x: pan.x - 2000, y: pan.y - 2000, width: vw + 4000, height: vh + 4000, className: 'mm-canvas-bg' }),
      doc.pages.map((page) => el('g', {
        key: page.id,
        className: 'mm-page-group' + (selectedPage === page.id ? ' mm-page-selected' : ''),
      },
        el('rect', {
          className: 'mm-page',
          x: page.x, y: page.y, width: page.w, height: page.h,
          onDoubleClick: (ev) => { ev.stopPropagation(); onStartEditPage(ev, page) },
          onContextMenu: (ev) => { ev.preventDefault(); ev.stopPropagation(); onCtxPage(ev, page) },
        }),
        el('rect', { className: 'mm-page-chip', x: page.x + 4, y: page.y + 4, width: 118, height: 16 }),
        el('text', { className: 'mm-page-name', x: page.x + 10, y: page.y + 15 }, page.name || '未命名页面'),
        el('text', { className: 'mm-page-dir', x: page.x + page.w - 10, y: page.y + 15, textAnchor: 'end' },
          pageDir[page.direction || 'TD'] || ''),
        edgesOf(page.id).map((e) => el(EdgeRenderer, {
          key: e.id, edge: e, doc,
          selected: selectedEdge === e.id,
          editing,
          onStartEdit: onStartEditEdge,
          onCtxEdge: onCtxEdge,
        })),
        nodesOf(page.id).map((n) => el(NodeRenderer, {
          key: n.id, node: n, doc,
          selected: selectedIds.indexOf(n.id) !== -1,
          editing,
          drawMode: mode === 'draw',
          onStartEdit: onStartEditNode,
          onCtxMenu: onCtxNode,
          onEditChange, onEditDone,
        })),
      )),
      // 选中箭头的首尾锚点圆点（节点层之上渲染，不被控件遮挡；命中由 core 决策计算）
      selectedEdge && !(drag && drag.mode === 'anchorDrag')
        ? (() => {
            const e = doc.edges.find((x) => x.id === selectedEdge)
            if (!e) return null
            const f = nodeById(doc, e.from)
            const t = nodeById(doc, e.to)
            if (!f || !t) return null
            const w1 = anchorToWorld(f, e.fromAnchor || { side: 'r', t: 0.5 })
            const w2 = anchorToWorld(t, e.toAnchor || { side: 'l', t: 0.5 })
            return el('g', { pointerEvents: 'none' },
              el('circle', { className: 'mm-anchor-handle', cx: w1.x, cy: w1.y, r: 5 }),
              el('circle', { className: 'mm-anchor-handle', cx: w2.x, cy: w2.y, r: 5 }),
            )
          })()
        : null,
      el(SnapLines, { lines: snapLines, pan, vw, vh }),
      // 连线起点 hover 预览：选择模式贴近节点边带 → 半透明圆点（按住此处 = 开始连线）
      hoverAnchor && !drag ? el('circle', {
        className: 'mm-hover-anchor',
        cx: hoverAnchor.wpt.x, cy: hoverAnchor.wpt.y, r: 4.5,
      }) : null,
      (drag && (drag.mode === 'arrow' || drag.mode === 'anchorDrag')) ? el(ArrowGhost, { ghost: drag.ghost, mode: drag.mode }) : null,
      drag && drag.mode === 'marquee' && drag.mq && drag.mq.w > 0 && drag.mq.h > 0
        ? el('rect', { x: drag.mq.x, y: drag.mq.y, width: drag.mq.w, height: drag.mq.h, className: 'mm-marquee' })
        : null,
      el(SelectionOverlay, { doc, selectedIds }),
      // 行内文本编辑浮层（foreignObject：坐标随 viewBox 自动换算）
      editing && editing.type === 'page' ? (() => {
        const p = doc.pages.find((x) => x.id === editing.id)
        if (!p) return null
        return el('foreignObject', { x: p.x + 4, y: p.y + 2, width: 140, height: 22, className: 'mm-edit-foreign' },
          el('div', { xmlns: 'http://www.w3.org/1999/xhtml', style: { width: '100%', height: '100%', display: 'flex' } },
            el('input', {
              className: 'mm-edit-input', defaultValue: editing.text, autoFocus: true,
              style: { flex: 1, width: '100%', boxSizing: 'border-box' },
              onKeyDown: (ev) => {
                ev.stopPropagation()
                if (ev.key === 'Enter') { ev.preventDefault(); onEditDone() }
                else if (ev.key === 'Escape') { ev.preventDefault(); onEditDone() }
              },
              onChange: (ev) => onEditChange(ev.target.value),
              onBlur: () => onEditDone(),
            }),
          ),
        )
      })() : null,
      editing && editing.type === 'node' ? (() => {
        const n = doc.nodes.find((x) => x.id === editing.id)
        if (!n) return null
        return el('foreignObject', { x: n.x, y: n.y, width: n.w, height: n.h, className: 'mm-edit-foreign' },
          el('div', { xmlns: 'http://www.w3.org/1999/xhtml', style: { width: '100%', height: '100%', display: 'flex' } },
            el('textarea', {
              className: 'mm-edit-input',
              defaultValue: editing.text,
              autoFocus: true,
              style: { flex: 1, width: '100%', boxSizing: 'border-box', resize: 'none', textAlign: 'center' },
              onKeyDown: (ev) => {
                ev.stopPropagation()
                if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); onEditDone() }
                else if (ev.key === 'Escape') { ev.preventDefault(); onEditDone() }
              },
              onChange: (ev) => onEditChange(ev.target.value),
              onBlur: () => onEditDone(),
            }),
          ),
        )
      })() : null,
      editing && editing.type === 'edge' ? (() => {
        const e = doc.edges.find((x) => x.id === editing.id)
        if (!e) return null
        const from = doc.nodes.find((n) => n.id === e.from)
        const to = doc.nodes.find((n) => n.id === e.to)
        if (!from || !to) return null
        const g = edgeGeom(from, e.fromAnchor || { side: 'r', t: 0.5 }, to, e.toAnchor || { side: 'l', t: 0.5 })
        const mid = g.mid
        return el('foreignObject', { x: mid.x - 80, y: mid.y - 15, width: 160, height: 30, className: 'mm-edit-foreign' },
          el('div', { xmlns: 'http://www.w3.org/1999/xhtml', style: { width: '100%', height: '100%', display: 'flex' } },
            el('input', {
              className: 'mm-edit-input', defaultValue: editing.text, autoFocus: true,
              style: { flex: 1, width: '100%', boxSizing: 'border-box', textAlign: 'center' },
              onKeyDown: (ev) => {
                ev.stopPropagation()
                if (ev.key === 'Enter') { ev.preventDefault(); onEditDone() }
                else if (ev.key === 'Escape') { ev.preventDefault(); onEditDone() }
              },
              onChange: (ev) => onEditChange(ev.target.value),
              onBlur: () => onEditDone(),
            }),
          ),
        )
      })() : null,
    ),
  )
}
