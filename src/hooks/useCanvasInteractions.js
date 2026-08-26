// dsh-mermaid hooks/useCanvasInteractions.js —— 事件适配 + 命令执行（P3）
// 所有决策/计算/结算在 core/interactions 纯函数；本 hook 只做 DOM 事件→state 桥接
import React from 'react'
import { CANVAS_W, CANVAS_H, cloneDoc, nextId, PASTE_OFFSET, MAX_ELEMENTS } from '../core/model.js'
import {
  decidePointerDown, updateDrag, settleDrag, zoomAt, toLocal, hoverCursorFor, hoverAnchorFor,
} from '../core/interactions.js'
import { setOpen } from '../core/store.js'
import { t } from '../i18n/index.js'

export function useCanvasInteractions(deps) {
  const {
    open, doc, setDoc, selectedIds, selectedEdge, selectedPage, applySelection, commitHistory,
    mode, setMode, editing, setEditing, copyBuf, setCopyBuf, undo, redo,
    removeSel, removeEdge, removeSelPage, showToast, svgRef, viewRef,
  } = deps

  const [zoom, setZoom] = React.useState(1)
  const [pan, setPan] = React.useState({ x: 0, y: 0 })
  const [drag, setDrag] = React.useState(null)
  const [snapLines, setSnapLines] = React.useState([])
  const [spaceDown, setSpaceDown] = React.useState(false)
  const [fullscreen, setFullscreen] = React.useState(false)
  // hover 光标（绘制模式操作区方向指示；无操作区时回退画布级光标）
  const [hoverCursor, setHoverCursor] = React.useState('')
  const hoverCursorRef = React.useRef('')
  // 连线起点 hover 预览（选择模式贴近节点边带 → 起点圆点；按下即开始连线）
  const [hoverAnchor, setHoverAnchor] = React.useState(null)
  const hoverAnchorRef = React.useRef(null)
  const spaceRef = React.useRef(false)
  const modeRef = React.useRef(mode)
  modeRef.current = mode
  const altRef = React.useRef(false)
  const baseModeRef = React.useRef(null)
  const docRef = React.useRef(doc)
  docRef.current = doc

  // ---------- Alt 状态对账（wf v2.2.9 同款：blur/focus/mousedown 三对账点） ----------
  const syncAltFromEvent = (ev) => {
    const pressed = ev && typeof ev.getModifierState === 'function' ? ev.getModifierState('Alt') : null
    if (pressed === null) return
    if (pressed && !altRef.current) {
      baseModeRef.current = modeRef.current
      altRef.current = true
      modeRef.current = 'draw'
      setMode('draw')
    } else if (!pressed && altRef.current) {
      altRef.current = false
      const base = baseModeRef.current || 'select'
      baseModeRef.current = null
      modeRef.current = base
      setMode(base)
    }
  }

  // ---------- 指针 ----------
  const onMouseDown = (ev) => {
    ev.preventDefault()
    syncAltFromEvent(ev)
    if (editing) setEditing(null)
    const active = document.activeElement
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) {
      active.blur()
    }
    const rect = svgRef.current.getBoundingClientRect()
    const { x, y } = toLocal(ev, rect, zoom, pan)
    const dec = decidePointerDown({
      doc, mode: modeRef.current, zoom, selectedIds, selectedEdge, spaceDown: spaceRef.current, pan, ctrl: ev.ctrlKey,
    }, x, y, ev.clientX, ev.clientY)
    const withPrev = (dragBase) => Object.assign({}, dragBase, { prev: cloneDoc(docRef.current) })
    switch (dec.kind) {
      case 'pan': setDrag(dec.drag); return
      case 'select': applySelection(dec.ids); return
      case 'toggle': applySelection(dec.ids, null); return
      case 'selectEdge': applySelection([], dec.ids ? dec.ids[0] : null); return
      case 'nodeMove':
        if (dec.sel) applySelection(dec.sel, null)
        setDrag(withPrev(dec.drag))
        return
      case 'resize':
        setDrag(withPrev(dec.drag))
        return
      case 'pageMove':
        applySelection([], null, dec.selPage)
        setDrag(withPrev(dec.drag))
        return
      case 'arrow':
        if (dec.sel) applySelection(dec.sel, null)
        setDrag(withPrev(dec.drag))
        return
      case 'marquee':
        applySelection([], null)
        setDrag(withPrev(dec.drag))
        return
      case 'groupEdgeResize':
      case 'groupCornerResize':
      case 'anchorDrag':
        setDrag(withPrev(dec.drag))
        return
      case 'limit':
        showToast(t('toast.limit', { max: MAX_ELEMENTS }), 'error')
        return
      case 'pageCreate':
      case 'nodeCreate': {
        applySelection([], null)
        setDoc((d) => {
          if (dec.kind === 'pageCreate') return Object.assign({}, d, { pages: d.pages.concat([dec.element]) })
          return Object.assign({}, d, { nodes: d.nodes.concat([dec.element]) })
        })
        setDrag(withPrev(dec.drag))
        return
      }
      case 'pageResize':
        setDrag(withPrev(dec.drag))
        return
      default: return
    }
  }

  const onMouseMove = (ev) => {
    const rect = svgRef.current.getBoundingClientRect()
    const { x, y } = toLocal(ev, rect, zoom, pan)
    // 无拖动：hover 光标 + 连线起点圆点预览（选择模式贴近节点边带）
    if (!drag) {
      if (spaceRef.current) {
        if (hoverCursorRef.current) { hoverCursorRef.current = ''; setHoverCursor('') }
        if (hoverAnchorRef.current) { hoverAnchorRef.current = null; setHoverAnchor(null) }
        return
      }
      const c = hoverCursorFor({ doc: docRef.current, mode: modeRef.current, zoom, selectedEdge }, x, y)
      if (c !== hoverCursorRef.current) {
        hoverCursorRef.current = c
        setHoverCursor(c)
      }
      const a = modeRef.current === 'select'
        ? hoverAnchorFor(docRef.current, x, y, zoom)
        : null
      const aJson = a ? (a.node.id + ':' + a.anchor.side + ':' + a.anchor.t.toFixed(3)) : ''
      const curAnchor = hoverAnchorRef.current
      const curJson = curAnchor ? (curAnchor.node.id + ':' + curAnchor.anchor.side + ':' + curAnchor.anchor.t.toFixed(3)) : ''
      if (aJson !== curJson) {
        hoverAnchorRef.current = a
        setHoverAnchor(a)
      }
      return
    }
    const r = updateDrag({ doc, zoom, selectedIds, rect }, drag, x, y, ev.clientX, ev.clientY)
    if (r.pan) { setPan(r.pan); return }
    if (r.patch) {
      const targetId = drag.mode === 'pageCreate' || drag.mode === 'nodeCreate' ? drag.tmpId : drag.id
      setDoc((d) => applyRecordPatch(d, drag.mode, targetId, r.patch))
      if (r.snaps) setSnapLines(r.snaps)
      return
    }
    if (r.patches) {
      setDoc((d) => applyPatches(d, r.patches))
      if (r.snaps) setSnapLines(r.snaps)
      if (r.lastDx !== undefined) setDrag((dr) => (dr ? Object.assign({}, dr, { lastDx: r.lastDx, lastDy: r.lastDy }) : dr))
      return
    }
    if (r.ghost) {
      setDrag((dr) => (dr ? Object.assign({}, dr, { ghost: r.ghost }) : dr))
      return
    }
    if (r.nextDrag) { setDrag(r.nextDrag); return }
  }

  const endDrag = () => {
    if (!drag) return
    const r = settleDrag({ doc: docRef.current }, drag)
    if (r.removePage) {
      setDoc((d) => ({ ...d, pages: d.pages.filter((p) => r.removePage.indexOf(p.id) === -1) }))
    }
    if (r.remove) {
      const rm = new Set(r.remove)
      setDoc((d) => ({
        ...d,
        nodes: d.nodes.filter((n) => !rm.has(n.id)),
        edges: d.edges.filter((e) => !rm.has(e.from) && !rm.has(e.to)),
      }))
    }
    if (r.pagePatch) {
      setDoc((d) => ({ ...d, pages: d.pages.map((p) => (p.id === r.pagePatch.id ? r.pagePatch : p)) }))
    } else if (r.patch) {
      setDoc((d) => ({ ...d, nodes: d.nodes.map((n) => (n.id === r.patch.id ? r.patch : n)) }))
    }
    if (r.edge) {
      setDoc((d) => ({ ...d, edges: d.edges.concat([r.edge]) }))
    }
    if (r.edgePatch) {
      const p = r.edgePatch
      setDoc((d) => ({ ...d, edges: d.edges.map((e) => (e.id === p.id ? { ...e, ...p.patch } : e)) }))
    }
    if (r.edgeRemove) {
      setDoc((d) => ({ ...d, edges: d.edges.filter((e) => e.id !== r.edgeRemove) }))
    }
    if (r.selection !== undefined) applySelection(r.selection, r.selEdge || null)
    else if (r.selEdge !== undefined && r.selEdge !== null) applySelection([], r.selEdge)
    if (r.commit && drag.prev) commitHistory(drag.prev)
    setDrag(null)
    setSnapLines([])
    hoverCursorRef.current = ''
    setHoverCursor('')
    hoverAnchorRef.current = null
    setHoverAnchor(null)
  }

  // ---------- 键盘 / 焦点 / 滚轮 ----------
  React.useEffect(() => {
    if (!open) return
    const isEditable = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
    const onKeyDown = (ev) => {
      // 输入控件内：交还浏览器默认行为（编辑字符/删除键），绝不拦截
      if (isEditable(ev.target)) return
      // 删除键优先（最前）：选中页面/控件/箭头 → 删除；并始终 preventDefault
      // （浏览器默认 Backspace=后退会关闭/破坏 SPA 页面，是「弹窗关闭且无法再启动」的根因防御）
      if (ev.key === 'Delete' || ev.key === 'Backspace') {
        handleDelete()
        return
      }
      if (ev.key === 'Escape') {
        ev.preventDefault()
        if (fullscreen) setFullscreen(false)
        else setOpen(false)
        return
      }
      if (ev.code === 'Space') {
        ev.preventDefault()
        spaceRef.current = true
        setSpaceDown(true)
        return
      }
      if (ev.key === 'Alt' && !ev.repeat) {
        ev.preventDefault()
        if (!altRef.current) baseModeRef.current = modeRef.current
        altRef.current = true
        modeRef.current = 'draw'
        setMode('draw')
        return
      }
      const k = ev.key.toLowerCase()
      if ((ev.ctrlKey || ev.metaKey) && k === 'z') {
        ev.preventDefault()
        if (ev.shiftKey) redo()
        else undo()
        return
      }
      if ((ev.ctrlKey || ev.metaKey) && k === 'y') { ev.preventDefault(); redo(); return }
      if ((ev.ctrlKey || ev.metaKey) && k === 'c') {
        ev.preventDefault()
        setCopyBuf(JSON.parse(JSON.stringify(doc.nodes.filter((n) => selectedIds.indexOf(n.id) !== -1))))
        return
      }
      if ((ev.ctrlKey || ev.metaKey) && k === 'v') {
        ev.preventDefault()
        if (!copyBuf || !copyBuf.length) return
        const cur = docRef.current
        if (cur.nodes.length + copyBuf.length > MAX_ELEMENTS) {
          showToast(t('toast.limit', { max: MAX_ELEMENTS }), 'error')
          return
        }
        const firstPage = cur.pages.length ? cur.pages[0].id : null
        const copies = copyBuf.map((n) => {
          const c = JSON.parse(JSON.stringify(n))
          c.id = nextId('n')
          c.x += PASTE_OFFSET
          c.y += PASTE_OFFSET
          if (firstPage && !cur.pages.some((p) => p.id === c.pageId)) c.pageId = firstPage
          return c
        })
        commitHistory(cloneDoc(cur))
        setDoc((d) => ({ ...d, nodes: d.nodes.concat(copies) }))
        applySelection(copies.map((c) => c.id), null)
        return
      }
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return
      if (ev.key === 'Delete' || ev.key === 'Backspace') {
        // 已在 handler 顶部处理（删除键优先 + preventDefault 兜底），此处为纯防御
        ev.preventDefault()
        return
      }
    }
    // 删除统一入口（window 捕获与冒泡共用；页面 > 箭头 > 节点；编辑中 → 关闭编辑框）
    const handleDelete = () => {
      if (editing) { setEditing(null); return }
      try {
        if (selectedPage) removeSelPage(selectedPage)
        else if (selectedEdge) removeEdge(selectedEdge)
        else if (selectedIds.length) removeSel(selectedIds)
      } catch (e) {
        if (showToast) showToast(t('toast.deleteFailed'), 'error')
      }
    }
    // window 捕获阶段兜底：在 DSH 页面任何内部处理之前拦截 Backspace/Delete 默认行为
    const onKeyDownCapture = (ev) => {
      if (isEditable(ev.target)) return
      if (ev.key === 'Delete' || ev.key === 'Backspace') {
        ev.preventDefault()
        ev.stopPropagation()
        handleDelete()
      }
    }
    const onKeyUp = (ev) => {
      if (ev.code === 'Space') { spaceRef.current = false; setSpaceDown(false) }
      if (ev.key === 'Alt') {
        if (altRef.current) {
          altRef.current = false
          const base = baseModeRef.current || 'select'
          baseModeRef.current = null
          modeRef.current = base
          setMode(base)
        } else {
          altRef.current = false
        }
      }
    }
    const onWindowBlur = () => {
      if (altRef.current) {
        altRef.current = false
        const base = baseModeRef.current || 'select'
        baseModeRef.current = null
        modeRef.current = base
        setMode(base)
      }
      spaceRef.current = false
      setSpaceDown(false)
      if (drag) endDrag()
    }
    const onWindowFocus = (ev) => syncAltFromEvent(ev)
    const onVisibility = () => { if (document.hidden) onWindowBlur() }
    window.addEventListener('keydown', onKeyDownCapture, true)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onWindowBlur)
    window.addEventListener('focus', onWindowFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('keydown', onKeyDownCapture, true)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onWindowBlur)
      window.removeEventListener('focus', onWindowFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  })

  React.useEffect(() => {
    if (!open) return
    const view = viewRef.current
    if (!view) return
    const onWheel = (ev) => {
      ev.preventDefault()
      if (ev.ctrlKey || ev.metaKey) {
        const factor = ev.deltaY < 0 ? 1.1 : 1 / 1.1
        const r = zoomAt(factor, zoom, pan)
        setZoom(r.zoom)
        setPan(r.pan)
        return
      }
      const rect = view.getBoundingClientRect()
      const scale = Math.min(rect.width / (CANVAS_W / zoom), rect.height / (CANVAS_H / zoom))
      const factor = ev.deltaMode === 1 ? 16 : (ev.deltaMode === 2 ? rect.height : 1)
      const dx = (ev.shiftKey ? ev.deltaY : ev.deltaX) * factor / scale
      const dy = (ev.shiftKey ? 0 : ev.deltaY) * factor / scale
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }))
    }
    view.addEventListener('wheel', onWheel, { passive: false })
    return () => view.removeEventListener('wheel', onWheel)
  })

  React.useEffect(() => {
    if (open) return
    setDrag(null)
    spaceRef.current = false
    altRef.current = false
    baseModeRef.current = null
    setSpaceDown(false)
    setSnapLines([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const canvasCursor = spaceDown
    ? (drag && drag.mode === 'pan' ? 'grabbing' : 'grab')
    : (hoverCursor || (mode === 'draw' ? 'crosshair' : 'default'))

  return {
    zoom, pan, setZoom, setPan, drag, snapLines, spaceDown, fullscreen, setFullscreen,
    canvasCursor, hoverAnchor, onMouseDown, onMouseMove, onMouseUp: endDrag, onMouseLeave: endDrag,
  }
}

// ---------- 补丁应用（纯函数辅助） ----------

function applyRecordPatch(doc, mode, id, patch) {
  if (mode === 'pageCreate' || mode === 'pageResize') {
    return { ...doc, pages: doc.pages.map((p) => (p.id === id ? { ...p, ...patch } : p)) }
  }
  return { ...doc, nodes: doc.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }
}

// patches: [{id:'page:p1'|nodeId, x,y,w?,h?}]
function applyPatches(doc, patches) {
  const pages = new Map(doc.pages.map((p) => [p.id, p]))
  const nodes = new Map(doc.nodes.map((n) => [n.id, n]))
  for (const p of patches) {
    if (p.id.startsWith('page:')) {
      const id = p.id.slice(5)
      const cur = pages.get(id)
      if (cur) pages.set(id, { ...cur, x: p.x, y: p.y })
    } else {
      const cur = nodes.get(p.id)
      if (cur) nodes.set(p.id, { ...cur, x: p.x, y: p.y, w: p.w !== undefined ? p.w : cur.w, h: p.h !== undefined ? p.h : cur.h })
    }
  }
  return { ...doc, pages: doc.pages.map((p) => pages.get(p.id)), nodes: doc.nodes.map((n) => nodes.get(n.id)) }
}
