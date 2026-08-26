// dsh-mermaid hooks/useCanvasEdit.js —— 编辑动作：文本编辑 / 右键菜单 / 删除 / 补丁 / 粘贴
import React from 'react'
import { cloneDoc, nextId, PASTE_OFFSET, MAX_ELEMENTS } from '../core/model.js'
import { t } from '../i18n/index.js'

export function useCanvasEdit(deps) {
  const {
    doc, setDoc, applySelection, commitHistory, showToast, setMenu: setMenuState,
    copyBuf,
  } = deps

  const [editing, setEditing] = React.useState(null) // { type:'node'|'edge'|'page', id, text, pageId? }
  const [menu, setMenu] = React.useState(null)       // { x, y, kind:'node'|'page'|'canvas', id? }
  const [shapeMenu, setShapeMenu] = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState(null) // { pageId, count }
  const [rename, setRename] = React.useState(null)   // { type:'page', id, text }

  // ---------- 文本编辑（双击） ----------
  const startEditNode = (node) => {
    setEditing({ type: 'node', id: node.id, text: node.text || '' })
  }
  const startEditEdge = (edge) => {
    setEditing({ type: 'edge', id: edge.id, text: edge.label || '' })
  }
  const startRenamePage = (page) => {
    setEdit(page.name || '')
    setRename({ type: 'page', id: page.id, text: page.name || '' })
  }
  // 简化：页面重命名也在 editing 状态中（type:'page'）
  const setEdit = (text) => {
    setEditing((e) => (e ? Object.assign({}, e, { text }) : e))
  }

  const commitEdit = () => {
    if (!editing) return
    const text = editing.text
    if (editing.type === 'node') {
      patchNode(editing.id, { text })
    } else if (editing.type === 'edge') {
      patchEdge(editing.id, { label: text })
    } else if (editing.type === 'page') {
      patchPage(editing.id, { name: text || '未命名页面' })
    }
    setEditing(null)
  }

  // ---------- 补丁（单一出口） ----------
  const patch = (fn, desc) => {
    commitHistory(cloneDoc(doc))
    setDoc(fn)
  }
  const patchNode = (id, patchObj) => patch(
    (d) => ({ ...d, nodes: d.nodes.map((n) => (n.id === id ? { ...n, ...patchObj } : n)) }), 'node')
  const patchEdge = (id, patchObj) => patch(
    (d) => ({ ...d, edges: d.edges.map((e) => (e.id === id ? { ...e, ...patchObj } : e)) }), 'edge')
  const patchPage = (id, patchObj) => patch(
    (d) => ({ ...d, pages: d.pages.map((p) => (p.id === id ? { ...p, ...patchObj } : p)) }), 'page')
  const patchDocConfig = (patchObj) => patch(
    (d) => ({ ...d, config: { ...d.config, ...patchObj } }), 'config')

  // ---------- 删除 ----------
  // 删除节点集合：连带删除引用它们的边（连接语义不变量）
  const removeSel = (ids) => {
    if (!ids || !ids.length) return
    const set = new Set(ids)
    commitHistory(cloneDoc(doc))
    setDoc((d) => ({
      ...d,
      nodes: d.nodes.filter((n) => !set.has(n.id)),
      edges: d.edges.filter((e) => set.indexOf(e.from) === -1 && set.indexOf(e.to) === -1),
    }))
    applySelection([], null)
  }
  const removeEdge = (id) => {
    if (!id) return
    commitHistory(cloneDoc(doc))
    setDoc((d) => ({ ...d, edges: d.edges.filter((e) => e.id !== id) }))
    applySelection([], null)
  }
  // 页面删除：连带节点与箭头（二次确认由 UI 层弹窗）
  const pageCount = (pageId) => {
    const nodes = doc.nodes.filter((n) => n.pageId === pageId).length
    const edges = doc.edges.filter((e) => e.pageId === pageId).length
    return { nodes, edges }
  }
  const removePage = (pageId) => {
    commitHistory(cloneDoc(doc))
    setDoc((d) => ({
      ...d,
      pages: d.pages.filter((p) => p.id !== pageId),
      nodes: d.nodes.filter((n) => n.pageId !== pageId),
      edges: d.edges.filter((e) => e.pageId !== pageId),
    }))
    applySelection([], null)
  }

  // ---------- 粘贴（复用键盘 Ctrl+V 同一逻辑） ----------
  const paste = () => {
    if (!copyBuf || !copyBuf.length) return false
    if (doc.nodes.length + copyBuf.length > MAX_ELEMENTS) {
      if (showToast) showToast(t('toast.limit', { max: MAX_ELEMENTS }), 'error')
      return false
    }
    const firstPage = doc.pages.length ? doc.pages[0].id : null
    const copies = copyBuf.map((n) => {
      const c = JSON.parse(JSON.stringify(n))
      c.id = nextId('n')
      c.x += PASTE_OFFSET
      c.y += PASTE_OFFSET
      if (firstPage && !doc.pages.some((p) => p.id === c.pageId)) c.pageId = firstPage
      return c
    })
    commitHistory(cloneDoc(doc))
    setDoc((d) => ({ ...d, nodes: d.nodes.concat(copies) }))
    applySelection(copies.map((c) => c.id), null)
    return true
  }

  // ---------- 右键菜单 ----------
  const openMenu = (x, y, kind, id) => {
    setMenu({ x, y, kind, id })
    setShapeMenu(false)
  }
  const closeMenu = () => {
    setMenu(null)
    setShapeMenu(false)
  }

  return {
    editing, setEditing, setEdit, commitEdit,
    menu, setMenu, shapeMenu, setShapeMenu,
    confirmDelete, setConfirmDelete,
    rename, setRename,
    startEditNode, startEditEdge, startRenamePage,
    patchNode, patchEdge, patchPage, patchDocConfig,
    removeSel, removeEdge, removePage, pageCount, paste,
    openMenu, closeMenu,
  }
}
