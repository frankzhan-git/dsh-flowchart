// dsh-flowchart hooks/useCanvasManager.js —— 自动保存 / 文档管理（P7：只认 CanvasStore 接口）
import React from 'react'
import { cloneDoc, freshDoc, reserveSeqs, docStats } from '../core/model.js'
import { defaultStore, exportCanvasFile, importCanvasFile, fullPatch } from '../core/storage/index.js'
import { genCanvasId, CURRENT_SCHEMA_VERSION } from '../core/storage/schema.js'
import { t } from '../i18n/index.js'

const AUTO_SAVE_MS = 800
const LIST_PAGE = { page: 0, pageSize: 100 }

export function useCanvasManager(deps) {
  const {
    open, doc, setDoc, name, setName,
    currentId, setCurrent, currentIdRef, applySelection, commitHistory,
    setPast, setFuture, setCopyBuf, setEditing, setMenu, setShapeMenu,
    setZoom, setPan, setSnapLines, showToast, lastSavedInit,
  } = deps

  const storeRef = React.useRef(null)
  const [docs, setDocs] = React.useState([]) // 文档列表（meta，updatedAt 倒序）
  const [floatTab, setFloatTab] = React.useState(null) // null | 'code' | 'preview'
  const saveTimer = React.useRef(null)
  const lastSavedRef = React.useRef(lastSavedInit ? cloneDoc(lastSavedInit) : null)
  const saveQueueRef = React.useRef(Promise.resolve())
  const enqueueSave = React.useCallback((task) => {
    const run = saveQueueRef.current.then(task)
    saveQueueRef.current = run.catch(() => {})
    return run
  }, [])

  // ---------- 列表 ----------
  const docsReqRef = React.useRef(0)
  const refreshDocs = React.useCallback(async () => {
    const reqId = ++docsReqRef.current
    try {
      const r = await storeRef.current.listMeta(LIST_PAGE)
      if (reqId !== docsReqRef.current) return
      const items = r.items.slice().sort((a, b) =>
        String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
      setDocs(items)
    } catch (e) { /* P5 容错：列表失败保持现状 */ }
  }, [])

  // ---------- 最近打开恢复 ----------
  const restoreLast = React.useCallback(async () => {
    try {
      const s = storeRef.current
      const r = await s.listMeta(LIST_PAGE)
      const latest = r.items.slice()
        .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0]
      if (!latest) return
      const body = await s.loadBody(latest.id)
      if (!body || (!body.nodes && !body.pages)) return
      if (currentIdRef.current !== null || lastSavedRef.current !== null) return
      const loaded = cloneDoc({ pages: body.pages || [], nodes: body.nodes || [], edges: body.edges || [], config: body.config || {} })
      reserveSeqs(loaded)
      setDoc(loaded)
      lastSavedRef.current = cloneDoc(loaded)
      setName(latest.name || '画布')
      setCurrent(latest.id)
      applySelection([], null)
    } catch (e) { /* P5：恢复失败保持空白 */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applySelection, setCurrent, setDoc, setName])

  // ---------- 全量快照保存（三集合 patch；串行队列） ----------
  const persistSnapshot = React.useCallback(async (id, d, docName) => {
    try {
      const s = storeRef.current
      const now = new Date().toISOString()
      const meta = await s.getMeta(id)
      const stats = docStats(d)
      await s.saveMeta({
        id, name: docName || '画布', schemaVersion: CURRENT_SCHEMA_VERSION,
        createdAt: meta ? meta.createdAt : now,
        updatedAt: now,
        elementCount: stats.elementCount,
        hasMedia: false,
      })
      const prev = await s.loadBody(id)
      const diff = (prevColl, cur) => {
        const set = {}
        for (const r of cur) set[r.id] = r
        const prevIds = (prevColl || []).map((r) => r.id)
        const remove = prevIds.filter((id2) => !set[id2])
        return { set, remove }
      }
      const patch = {
        pages: diff(prev ? prev.pages : [], d.pages),
        nodes: diff(prev ? prev.nodes : [], d.nodes),
        edges: diff(prev ? prev.edges : [], d.edges),
        config: d.config || { theme: 'default', fontFamily: '' },
      }
      const ok = await s.saveBody(id, patch)
      if (!ok) showToast(t('toast.capacity'), 'error')
      await refreshDocs()
    } catch (e) {
      showToast(t('toast.saveFailed'), 'error')
    }
  }, [refreshDocs, showToast])

  const flushSave = React.useCallback(() => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    const id = currentIdRef.current
    if (!id) return Promise.resolve()
    if (lastSavedRef.current && JSON.stringify(lastSavedRef.current) === JSON.stringify(doc)) {
      return Promise.resolve()
    }
    const snap = cloneDoc(doc)
    return enqueueSave(async () => {
      await persistSnapshot(id, snap, name)
      lastSavedRef.current = cloneDoc(snap)
    })
  }, [doc, name, currentIdRef, enqueueSave, persistSnapshot])

  React.useEffect(() => {
    if (!open) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(flushSave, AUTO_SAVE_MS)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  })

  React.useEffect(() => {
    storeRef.current = defaultStore()
    refreshDocs()
    if (currentIdRef.current === null && lastSavedRef.current === null) restoreLast()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  React.useEffect(() => {
    if (open) return
    flushSave()
    setEditing(null)
    setMenu(null)
    setShapeMenu(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // ---------- 文档管理 ----------
  const creatingRef = React.useRef(false)
  const newCanvas = async () => {
    if (creatingRef.current) return
    creatingRef.current = true
    try {
      const oldId = currentIdRef.current || null
      if (oldId) await enqueueSave(() => persistSnapshot(oldId, cloneDoc(doc), name))
      const id = genCanvasId()
      const fp = freshDoc()
      await enqueueSave(() => persistSnapshot(id, fp, '画布'))
      setCurrent(id)
      setDoc(fp)
      lastSavedRef.current = cloneDoc(fp)
      setName('画布')
      applySelection([], null)
      setZoom(1)
      setPan({ x: 0, y: 0 })
      setPast([])
      setFuture([])
      setCopyBuf(null)
      setSnapLines([])
      setMenu(null)
      setShapeMenu(false)
      setEditing(null)
      setFloatTab(null)
    } finally {
      creatingRef.current = false
    }
  }
  const loadCanvas = async (h) => {
    await flushSave()
    try {
      const body = await storeRef.current.loadBody(h.id)
      const loaded = cloneDoc({
        pages: (body && body.pages) || [],
        nodes: (body && body.nodes) || [],
        edges: (body && body.edges) || [],
        config: (body && body.config) || { theme: 'default', fontFamily: '' },
      })
      reserveSeqs(loaded)
      setDoc(loaded)
      lastSavedRef.current = cloneDoc(loaded)
      setName(typeof h.name === 'string' ? h.name : '画布')
      setCurrent(h.id)
      applySelection([], null)
      setZoom(1)
      setPan({ x: 0, y: 0 })
    } catch (e) {
      showToast(t('toast.loadFailed'), 'error')
    }
  }
  const delCanvas = async (id) => {
    await enqueueSave(() => storeRef.current.remove(id))
    setDocs((d) => d.filter((x) => x.id !== id))
    if (currentIdRef.current === id) setCurrent(null)
  }
  const renameCanvas = async (id, n) => {
    await enqueueSave(async () => {
      const meta = await storeRef.current.getMeta(id)
      if (!meta) return
      await storeRef.current.saveMeta(Object.assign({}, meta, { name: n, updatedAt: new Date().toISOString() }))
      await refreshDocs()
    })
    setDocs((d) => d.map((x) => (x.id === id ? Object.assign({}, x, { name: n }) : x)))
    if (currentIdRef.current === id) setName(n)
  }
  const clearAll = () => {
    commitHistory(cloneDoc(doc))
    setDoc(freshDoc())
    applySelection([], null)
  }

  // ---------- 导出 / 导入 ----------
  const exportCanvas = async (id) => {
    const cf = await exportCanvasFile(storeRef.current, id)
    if (!cf) { showToast(t('toast.exportMissing'), 'error'); return }
    const blob = new Blob([JSON.stringify(cf, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = (cf.name || '画布') + '.dshmm.json'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const importCanvas = async (file) => {
    let text = ''
    try { text = await file.text() } catch (e) { showToast(t('toast.readFail'), 'error'); return }
    let parsed = null
    try { parsed = JSON.parse(text) } catch (e) { showToast(t('toast.notJson'), 'error'); return }
    const r = await enqueueSave(() => importCanvasFile(storeRef.current, parsed))
    if (!r.ok) { showToast(r.reason, 'error'); return }
    showToast(t('toast.imported', { name: parsed.name || '未命名' }), 'info')
    await refreshDocs()
  }

  return {
    docs, setDocs, floatTab, setFloatTab, flushSave, refreshDocs,
    newCanvas, loadCanvas, delCanvas, renameCanvas, clearAll,
    exportCanvas, importCanvas,
  }
}

export { fullPatch }
