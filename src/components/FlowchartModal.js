// dsh-flowchart components/FlowchartModal.js —— 画板浮层编排（conversation.input.overlay）
// 布局对齐 dsh-wf SketchModal：顶栏（新建/全屏/关闭）+ 中栏（画布 + CanvasOverlay | 右栏）
//           + 底栏（取消 / 插入到会话 + 仅代码切换）+ 右键菜单 + 删除确认 + Toast
import React from 'react'
import { cloneDoc, createPage } from '../core/model.js'
import { EDGE_KINDS, edgeOptions } from '../core/edge-kinds.js'
import { setOpen, getOpen, subscribe } from '../core/store.js'
import { buildInsertText } from '../core/codegen.js'
import { defaultStore, storeMode, mountError } from '../core/storage/index.js'
import { useToasts } from '../hooks/useToasts.js'
import { useDocState } from '../hooks/useDocState.js'
import { useCanvasInteractions } from '../hooks/useCanvasInteractions.js'
import { useCanvasEdit } from '../hooks/useCanvasEdit.js'
import { useCanvasManager } from '../hooks/useCanvasManager.js'
import { usePreview } from '../hooks/usePreview.js'
import { CanvasStage } from './canvas/CanvasStage.js'
import { CanvasOverlay } from './canvas/CanvasOverlay.js'
import { RightPanel } from './RightPanel.js'
import { Toast } from './common/Toast.js'
import { ShapePicker } from './inspector/ShapePicker.js'
import { t } from '../i18n/index.js'
import {
  IconPlusOutline16, IconFullscreenOutline16, IconDownloadOutline16, IconCloseOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'

const el = React.createElement

export function FlowchartModal(props) {
  const p = props || {}
  const [open, setOpenState] = React.useState(getOpen())
  React.useEffect(() => subscribe(setOpenState), [])
  const [panelOpen, setPanelOpen] = React.useState(true)
  const [insertMode, setInsertMode] = React.useState('note') // 'note' | 'code'（Q5：记忆本次会话）
  const [selPageId, setSelPageId] = React.useState(null)
  const [docName, setDocName] = React.useState('画布')

  const draft = (p.useInput || (() => null))((s) => (s && typeof s.draft === 'string' ? s.draft : ''))
  const { toast, showToast } = useToasts(open)

  const initRef = React.useRef(null)
  if (initRef.current === null) {
    initRef.current = initLastSync()
  }
  const init = initRef.current
  const sketch = useDocState(init)
  const svgRef = React.useRef(null)
  const viewRef = React.useRef(null)
  const result = usePreview(sketch.doc)

  const edit = useCanvasEdit({
    doc: sketch.doc, setDoc: sketch.setDoc,
    applySelection: sketch.applySelection, commitHistory: sketch.commitHistory,
    showToast, copyBuf: sketch.copyBuf, setMenu: null,
  })

  const interactions = useCanvasInteractions({
    open, doc: sketch.doc, setDoc: sketch.setDoc,
    selectedIds: sketch.selectedIds, selectedEdge: sketch.selectedEdge, selectedPage: sketch.selectedPage,
    applySelection: sketch.applySelection, commitHistory: sketch.commitHistory,
    mode: sketch.mode, setMode: sketch.setMode,
    editing: edit.editing, setEditing: edit.setEditing,
    copyBuf: sketch.copyBuf, setCopyBuf: sketch.setCopyBuf,
    undo: sketch.undo, redo: sketch.redo,
    removeSel: (ids) => edit.removeSel(ids), removeEdge: edit.removeEdge,
    removeSelPage: (pageId) => edit.removePage(pageId),
    showToast, svgRef, viewRef,
  })

  const manager = useCanvasManager({
    open, doc: sketch.doc, setDoc: sketch.setDoc,
    name: docName, setName: setDocName,
    currentId: sketch.currentId, setCurrent: sketch.setCurrent, currentIdRef: sketch.currentIdRef,
    applySelection: sketch.applySelection, commitHistory: sketch.commitHistory,
    setPast: sketch.setPast, setFuture: sketch.setFuture, setCopyBuf: sketch.setCopyBuf,
    setEditing: edit.setEditing, setMenu: edit.setMenu, setShapeMenu: edit.setShapeMenu,
    setZoom: interactions.setZoom, setPan: interactions.setPan, setSnapLines: interactions.setSnapLines,
    showToast, lastSavedInit: init && init.doc ? init.doc : null,
  })

  if (!open) return null

  // 设置面板作用对象（三通道互斥选中）：页面 / 节点 / 箭头 → 面板对应配置卡
  const selPageRec = sketch.doc.pages.find((pg) => pg.id === sketch.selectedPage) || null
  const selNodeRec = sketch.doc.nodes.find((n) => n.id === sketch.selectedIds[sketch.selectedIds.length - 1]) || null
  const selEdgeRec = sketch.doc.edges.find((e) => e.id === sketch.selectedEdge) || null
  const errors = result.issues.filter((i) => i.level === 'error')

  // ---------- 插入会话（Q5） ----------
  const insert = () => {
    if (result.empty) { showToast(t('insertErrorTitle'), 'warn'); return }
    const ia = p.inputActions
    if (!ia || typeof ia.setDraft !== 'function') {
      showToast(t('toast.inputUnavailable'), 'error')
      return
    }
    const text = buildInsertText(result.pages, insertMode !== 'code')
    const cur = typeof draft === 'string' && draft.trim() ? draft.replace(/\s+$/, '') + '\n' : ''
    ia.setDraft(cur + text)
    setOpen(false)
  }

  // ---------- 画布编辑回调（选择/移动/箭头由 core 交互状态机统一决策，组件只注册双击/右键） ----------
  const onStartEditNode = (node) => edit.startEditNode(node)
  const onStartEditEdge = (edge) => edit.startEditEdge(edge)
  const onCtxNode = (ev, node) => edit.openMenu(ev.clientX, ev.clientY, 'node', node.id)
  const onCtxEdge = (ev, edge) => edit.openMenu(ev.clientX, ev.clientY, 'edge', edge.id)
  const onCtxPage = (ev, page) => edit.openMenu(ev.clientX, ev.clientY, 'page', page.id)
  const onCtxCanvas = (ev) => edit.openMenu(ev.clientX, ev.clientY, 'canvas', null)
  const onStartEditPage = (ev, page) => {
    ev.stopPropagation()
    edit.setEditing({ type: 'page', id: page.id, text: page.name || '' })
  }
  const onEditChange = (v) => edit.setEdit(v)
  const onEditDone = () => {
    if (!edit.editing) return
    if (edit.editing.type === 'page') {
      sketch.commitHistory(cloneDoc(sketch.doc))
      sketch.setDoc((d) => ({ ...d, pages: d.pages.map((pg) => (pg.id === edit.editing.id ? { ...pg, name: edit.editing.text || '未命名页面' } : pg)) }))
    } else {
      edit.commitEdit()
    }
  }

  // ---------- 新建页面（画布空白右键 / 默认页） ----------
  const newPage = () => {
    const doc = sketch.doc
    const base = doc.pages[0] || { x: 20, y: 20, w: 480, h: 320 }
    const off = (doc.pages.length % 4) * 24
    const page = createPage(base.x + 20 + off, base.y + 20 + off, base.w, base.h, doc.pages.length + 1)
    sketch.commitHistory(cloneDoc(doc))
    sketch.setDoc((d) => ({ ...d, pages: d.pages.concat([page]) }))
    setSelPageId(page.id)
  }

  // 置于顶层（数组顺序 = z 序；仅节点）
  const toTop = (id) => {
    sketch.commitHistory(cloneDoc(sketch.doc))
    sketch.setDoc((d) => {
      const n = d.nodes.find((x) => x.id === id)
      if (!n) return d
      return { ...d, nodes: d.nodes.filter((x) => x.id !== id).concat([n]) }
    })
  }

  // ---------- 右键菜单 ----------
  const menuEl = !edit.menu ? null : (() => {
    const m = edit.menu
    const menuNode = edit.menu.kind === 'node' ? sketch.doc.nodes.find((n) => n.id === edit.menu.id) : null
    const menuPage = edit.menu.kind === 'page' ? sketch.doc.pages.find((p) => p.id === edit.menu.id) : null
    const closes = () => edit.closeMenu()
    const items = []
    if (edit.menu.kind === 'node' && menuNode) {
      if (sketch.doc.nodes.length > 1) items.push({ label: t('toTop'), fn: () => toTop(menuNode.id) })
      return el('div', {
        className: 'mm-menu-backdrop',
        onClick: (ev) => { ev.stopPropagation(); closes() },
        onContextMenu: (ev) => { ev.preventDefault(); ev.stopPropagation(); closes() },
      },
        el('div', { className: 'mm-menu', style: { left: m.x, top: m.y }, onClick: (ev) => ev.stopPropagation() },
          el('div', {
            className: 'mm-menu-item' + (edit.shapeMenu ? ' mm-menu-item-on' : ''),
            onMouseEnter: () => edit.setShapeMenu(true),
            onMouseLeave: () => edit.setShapeMenu(false),
            onClick: () => edit.setShapeMenu(!edit.shapeMenu),
          },
            t('changeShape'), el('span', { className: 'mm-menu-caret' }, '▸'),
            edit.shapeMenu ? el('div', {
              className: 'mm-menu mm-menu-sub',
              onMouseEnter: () => edit.setShapeMenu(true),
              onMouseLeave: () => edit.setShapeMenu(false),
            },
              el(ShapePicker, {
                value: menuNode.shape,
                onPick: (shapeId) => {
                  edit.patchNode(menuNode.id, { shape: shapeId })
                  closes()
                },
              }),
            ) : null,
          ),
          el('div', { className: 'mm-menu-sep' }),
          el('div', { className: 'mm-menu-item mm-menu-item-danger', onClick: () => { edit.removeSel([menuNode.id]); closes() } }, t('delete')),
        ),
      )
    }
    if (edit.menu.kind === 'edge') {
      // 箭头右键：连线类型（语义设置）+ 删除（标签双击编辑）
      const menuEdge = sketch.doc.edges.find((e) => e.id === edit.menu.id)
      if (!menuEdge) return null
      return el('div', {
        className: 'mm-menu-backdrop',
        onClick: (ev) => { ev.stopPropagation(); closes() },
        onContextMenu: (ev) => { ev.preventDefault(); ev.stopPropagation(); closes() },
      },
        el('div', { className: 'mm-menu', style: { left: m.x, top: m.y }, onClick: (ev) => ev.stopPropagation() },
          edgeOptions().map((k) => el('div', {
            key: k,
            className: 'mm-menu-item' + (menuEdge.kind === k ? ' mm-menu-item-on' : ''),
            onClick: () => { edit.patchEdge(menuEdge.id, { kind: k }); closes() },
          }, EDGE_KINDS[k].label)),
          el('div', { className: 'mm-menu-sep' }),
          el('div', { className: 'mm-menu-item', onClick: () => { edit.startEditEdge(menuEdge); closes() } }, t('label') + '…'),
          el('div', { className: 'mm-menu-sep' }),
          el('div', { className: 'mm-menu-item mm-menu-item-danger', onClick: () => { edit.removeEdge(menuEdge.id); closes() } }, t('delete')),
        ),
      )
    }
    if (edit.menu.kind === 'page' && menuPage) {
      const count = edit.pageCount(menuPage.id).nodes + edit.pageCount(menuPage.id).edges
      const pageIndex = result.pages.findIndex((pg) => pg.pageId === menuPage.id)
      const pageCode = pageIndex >= 0 ? result.pages[pageIndex] : null
      return el('div', {
        className: 'mm-menu-backdrop',
        onClick: (ev) => { ev.stopPropagation(); closes() },
        onContextMenu: (ev) => { ev.preventDefault(); ev.stopPropagation(); closes() },
      },
        el('div', { className: 'mm-menu', style: { left: m.x, top: m.y }, onClick: (ev) => ev.stopPropagation() },
          ['TD', 'BT', 'LR', 'RL'].map((dir) => el('div', {
            key: dir, className: 'mm-menu-item' + (menuPage.direction === dir ? ' mm-menu-item-on' : ''),
            onClick: () => { edit.patchPage(menuPage.id, { direction: dir }); closes() },
          }, '方向 ' + dir)),
          el('div', { className: 'mm-menu-sep' }),
          el('div', { className: 'mm-menu-item', onClick: () => {
            edit.setEditing({ type: 'page', id: menuPage.id, text: menuPage.name || '' })
            closes()
          } }, t('pageRename')),
          pageCode ? el('div', { className: 'mm-menu-item', onClick: () => { navigator.clipboard.writeText(pageCode.code); closes() } }, t('pageCopyCode')) : null,
          el('div', { className: 'mm-menu-sep' }),
          el('div', {
            className: 'mm-menu-item mm-menu-item-danger',
            onClick: () => {
              if (count > 0) edit.setConfirmDelete({ pageId: menuPage.id, count })
              else edit.removePage(menuPage.id)
              closes()
            },
          }, t('pageDelete') + (count > 0 ? `（${count}）` : '')),
        ),
      )
    }
    // 空白画布：新建页面 / 粘贴
    return el('div', {
      className: 'mm-menu-backdrop',
      onClick: (ev) => { ev.stopPropagation(); closes() },
      onContextMenu: (ev) => { ev.preventDefault(); ev.stopPropagation(); closes() },
    },
      el('div', { className: 'mm-menu', style: { left: m.x, top: m.y }, onClick: (ev) => ev.stopPropagation() },
        el('div', { className: 'mm-menu-item', onClick: () => { newPage(); closes() } }, t('newPage')),
        sketch.copyBuf && sketch.copyBuf.length ? el('div', { className: 'mm-menu-item', onClick: () => { edit.paste(); closes() } }, t('paste')) : null,
      ),
    )
  })()

  const confirmDialog = edit.confirmDelete ? el('div', { className: 'mm-mask mm-mask-confirm', onClick: () => edit.setConfirmDelete(null) },
    el('div', { className: 'mm-confirm', onClick: (ev) => ev.stopPropagation() },
      el('div', { className: 'mm-confirm-title' }, '删除确认'),
      el('div', { className: 'mm-confirm-body' }, t('pageDeleteConfirm', { count: edit.confirmDelete.count })),
      el('div', { className: 'mm-confirm-actions' },
        el('button', { type: 'button', className: 'mm-btn', onClick: () => edit.setConfirmDelete(null) }, t('cancelBtn')),
        el('button', {
          type: 'button', className: 'mm-btn mm-btn-primary',
          style: { background: 'var(--mm-danger)' },
          onClick: () => { edit.removePage(edit.confirmDelete.pageId); edit.setConfirmDelete(null) },
        }, t('confirm')),
      ),
    ),
  ) : null

  return el('div', { className: 'mm-mask', onClick: () => setOpen(false) },
    el('div', { className: 'mm-modal' + (interactions.fullscreen ? ' mm-modal-fs' : ''), onClick: (ev) => ev.stopPropagation() },
      el('div', { className: 'mm-head' },
        el('span', { className: 'mm-title' }, t('title')),
        el('span', { className: 'mm-spacer' }),
        el('div', { className: 'mm-head-menu' },
          el('button', { type: 'button', className: 'mm-mini-btn', title: t('newTitle'), onClick: manager.newCanvas },
            el(IconPlusOutline16, { size: 14 }), t('docNew')),
          el('button', {
            type: 'button', className: 'mm-icon-btn',
            title: interactions.fullscreen ? t('exitFullscreen') : t('fullscreen'),
            onClick: () => interactions.setFullscreen(!interactions.fullscreen),
          },
            interactions.fullscreen ? el(IconDownloadOutline16, { size: 14 }) : el(IconFullscreenOutline16, { size: 14 })),
          el('button', { type: 'button', className: 'mm-icon-btn', title: t('close'), onClick: () => setOpen(false) },
            el(IconCloseOutline16, { size: 14 })),
        ),
      ),
      el('div', { className: 'mm-body' },
        el('div', { className: 'mm-canvas-wrap' },
          el(CanvasStage, {
            doc: sketch.doc, selectedIds: sketch.selectedIds, selectedEdge: sketch.selectedEdge,
            selectedPage: sketch.selectedPage,
            editing: edit.editing, mode: sketch.mode,
            zoom: interactions.zoom, pan: interactions.pan, spaceDown: interactions.spaceDown,
            drag: interactions.drag,
            svgRef, viewRef, canvasCursor: interactions.canvasCursor, snapLines: interactions.snapLines,
            hoverAnchor: interactions.hoverAnchor,
            onMouseDown: interactions.onMouseDown, onMouseMove: interactions.onMouseMove,
            onMouseUp: interactions.onMouseUp, onMouseLeave: interactions.onMouseLeave,
            onStartEditNode, onStartEditEdge, onStartEditPage: onStartEditPage,
            onCtxNode, onCtxEdge, onCtxPage, onCtxCanvas, onEditChange, onEditDone,
          }),
          el(CanvasOverlay, {
            mode: sketch.mode,
            onToggleMode: () => { sketch.setMode(sketch.mode === 'select' ? 'draw' : 'select'); sketch.applySelection([], null) },
            floatTab: manager.floatTab, onFloatTab: manager.setFloatTab,
            zoom: interactions.zoom, pan: interactions.pan,
            onZoomReset: () => { interactions.setZoom(1); interactions.setPan({ x: 0, y: 0 }) },
            result, onCloseFloat: () => manager.setFloatTab(null),
            canUndo: sketch.past.length > 0,
            canRedo: sketch.future.length > 0,
            canClear: !!(sketch.doc.nodes.length || sketch.doc.edges.length),
            onUndo: sketch.undo, onRedo: sketch.redo, onClear: manager.clearAll,
            panelOpen, onTogglePanel: () => setPanelOpen(!panelOpen),
            showToast,
          }),
        ),
        panelOpen ? el(RightPanel, {
          page: selPageRec,
          node: selNodeRec,
          edge: selEdgeRec,
          onPagePatch: (patchObj) => { if (selPageRec) edit.patchPage(selPageRec.id, patchObj) },
          onNodePatch: (patchObj) => { if (selNodeRec) edit.patchNode(selNodeRec.id, patchObj) },
          onEdgePatch: (patchObj) => { if (selEdgeRec) edit.patchEdge(selEdgeRec.id, patchObj) },
          docs: manager.docs, currentId: sketch.currentId,
          onLoad: (d) => manager.loadCanvas(d),
          onDelete: (id) => manager.delCanvas(id),
          onRename: (id, n) => manager.renameCanvas(id, n),
          onExport: (id) => manager.exportCanvas(id),
          onImport: manager.importCanvas, onNew: manager.newCanvas,
          storeMode: storeMode(), storeErr: mountError(),
        }) : null,
      ),
      el('div', { className: 'mm-footer' },
        el('span', { className: 'mm-spacer' }),
        el('button', { type: 'button', className: 'mm-btn', onClick: () => setOpen(false) }, t('cancel')),
        el('div', { className: 'mm-split' },
          el('button', {
            type: 'button', className: 'mm-btn mm-btn-primary',
            disabled: result.empty || errors.length > 0,
            title: errors.length ? t('insertErrorTitle') : t('insertTitle'),
            onClick: insert,
          }, t('insert')),
          el('button', {
            type: 'button',
            className: 'mm-btn',
            title: insertMode === 'note' ? t('insertNote') : t('insertOnly'),
            onClick: () => setInsertMode(insertMode === 'note' ? 'code' : 'note'),
          }, insertMode === 'note' ? '说明' : '代码'),
        ),
      ),
      el(Toast, { toast }),
    ),
    menuEl,
    confirmDialog,
  )
}

// ---------- 打开时同步初始化（localStorage 能力） ----------
function initLastSync() {
  try {
    const store = requireStore()
    if (!store.sync) return null
    const docsL = store.sync.listMeta()
    if (docsL.length) {
      const body = store.sync.loadBody(docsL[0].id)
      if (body && (body.nodes.length || body.edges.length)) {
        return { doc: { pages: body.pages, nodes: body.nodes, edges: body.edges, config: body.config }, id: docsL[0].id }
      }
    }
    return null
  } catch (e) {
    return null
  }
}

// 惰性获取 store（避免模块顶层访问 localStorage）
let _store = null
function requireStore() {
  if (!_store) _store = defaultStore()
  return _store
}
