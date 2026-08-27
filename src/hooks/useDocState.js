// dsh-flowchart hooks/useDocState.js —— 核心状态容器（P1 应用层）
// doc 是唯一事实源（P4）；撤销重做 = doc 快照；选中 = nodes + edge 双通道
import React from 'react'
import { cloneDoc, freshDoc } from '../core/model.js'

const HISTORY_MAX = 50

export function useDocState(init) {
  const initial = init && init.doc ? init.doc : freshDoc()
  const [doc, setDoc] = React.useState(initial)
  const [mode, setMode] = React.useState('select')
  const [selectedIds, setSelectedIds] = React.useState([])
  const [selectedEdge, setSelectedEdge] = React.useState(null)
  const [selectedPage, setSelectedPage] = React.useState(null)
  const [past, setPast] = React.useState([])
  const [future, setFuture] = React.useState([])
  const [copyBuf, setCopyBuf] = React.useState(null)
  const [currentId, setCurrentId] = React.useState(init ? init.id : null)
  const currentIdRef = React.useRef(init ? init.id : null)

  // 三通道选中：节点集 / 箭头 / 页面（页面通过标题条点击选中；Backspace 可删除）
  const applySelection = React.useCallback((ids, edgeId, pageId) => {
    setSelectedIds(Array.isArray(ids) ? ids : [])
    setSelectedEdge(edgeId == null ? null : edgeId)
    setSelectedPage(pageId == null ? null : pageId)
  }, [])

  const setCurrent = React.useCallback((id) => { currentIdRef.current = id; setCurrentId(id) }, [])

  const commitHistory = React.useCallback((before) => {
    if (!before) return
    setPast((p) => (p.length >= HISTORY_MAX ? p.slice(1) : p).concat([before]))
    setFuture([])
  }, [])

  const undo = React.useCallback(() => {
    setPast((p) => {
      if (!p.length) return p
      const prev = p[p.length - 1]
      setFuture((f) => (f.length >= HISTORY_MAX ? f.slice(0, HISTORY_MAX - 1) : f).concat([cloneDoc(doc)]))
      setDoc(prev)
      applySelection([])
      return p.slice(0, -1)
    })
  }, [doc, applySelection])

  const redo = React.useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f
      const next = f[0]
      setPast((p) => (p.length >= HISTORY_MAX ? p.slice(1) : p).concat([cloneDoc(doc)]))
      setDoc(next)
      applySelection([])
      return f.slice(1)
    })
  }, [doc, applySelection])

  return {
    doc, setDoc,
    mode, setMode,
    selectedIds, selectedEdge, selectedPage, applySelection,
    past, setPast, future, setFuture, undo, redo,
    copyBuf, setCopyBuf,
    currentId, setCurrent, currentIdRef,
    commitHistory,
  }
}
