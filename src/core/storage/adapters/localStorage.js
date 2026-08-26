// dsh-mermaid core/storage/adapters/localStorage.js —— 兜底适配器（宿主存储不可用时）
// 文档库语义：meta/body 分离 + 增量 patch 全量退化；sync 同步变体（打开画布免闪屏）
// 键空间：dsh-mermaid:index / dsh-mermaid:body:{id}
import { migrateFile } from '../migrate.js'
import { isValidMeta, sanitizeDoc } from '../integrity.js'

const INDEX_KEY = 'dsh-mermaid:index'
const CAPACITY_LIMIT = 4 * 1024 * 1024
const bodyKey = (id) => 'dsh-mermaid:body:' + id

function readIndex() {
  const raw = localStorage.getItem(INDEX_KEY)
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter(isValidMeta) : []
  } catch (e) {
    return []
  }
}
function writeIndex(list) {
  try { localStorage.setItem(INDEX_KEY, JSON.stringify(list)) } catch (e) { /* 容量已由调用方探测 */ }
}
function sortMeta(list) { return list.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')) }
function fits(value) { return !value || String(value).length < CAPACITY_LIMIT }

function readBody(id) {
  const raw = localStorage.getItem(bodyKey(id))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    const { doc, dropped } = sanitizeDoc(parsed)
    return { doc, schemaVersion: parsed.schemaVersion || 1, dropped }
  } catch (e) {
    return null
  }
}

export function localStorageAdapter() {
  const listMeta = async (q) => {
    let items = sortMeta(readIndex())
    const kw = q && q.keyword ? String(q.keyword).trim() : ''
    if (kw) items = items.filter((m) => m.name.includes(kw))
    const total = items.length
    if (q && typeof q.page === 'number') {
      const size = (q && q.pageSize) || 20
      items = items.slice(q.page * size, q.page * size + size)
    }
    return { items, total }
  }
  const getMeta = async (id) => readIndex().find((m) => m.id === id) || null
  const loadBody = async (id) => {
    const b = readBody(id)
    if (!b) return null
    return { pages: b.doc.pages, nodes: b.doc.nodes, edges: b.doc.edges, config: b.doc.config, schemaVersion: b.schemaVersion, dropped: b.dropped }
  }
  const saveMeta = async (meta) => {
    const list = readIndex().filter((m) => m.id !== meta.id)
    list.unshift(meta)
    writeIndex(list.slice(0, 100))
  }
  // 增量 patch（全量退化）：三集合 merge + remove + config 覆盖
  const saveBody = async (id, patch) => {
    const prev = readBody(id)
    const pages = mergeColl(prev ? prev.doc.pages : [], patch.pages)
    const nodes = mergeColl(prev ? prev.doc.nodes : [], patch.nodes)
    const edges = mergeColl(prev ? prev.doc.edges : [], patch.edges)
    const config = patch.config !== undefined && patch.config !== null
      ? Object.assign({}, prev ? prev.doc.config : {}, patch.config)
      : (prev ? prev.doc.config : { theme: 'default', fontFamily: '' })
    const body = { schemaVersion: 1, pages, nodes, edges, config }
    const json = JSON.stringify(body)
    if (!fits(json)) return false
    try { localStorage.setItem(bodyKey(id), json) } catch (e) { return false }
    return true
  }
  const remove = async (id) => {
    const list = readIndex().filter((m) => m.id !== id)
    writeIndex(list)
    localStorage.removeItem(bodyKey(id))
  }
  const clear = async () => {
    const keys = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('dsh-mermaid:')) keys.push(k)
    }
    for (const k of keys) localStorage.removeItem(k)
  }

  // 同步变体（localStorage 能力：打开画布同步初始化，避免闪屏）
  const sync = {
    listMeta: () => sortMeta(readIndex()),
    getMeta: (id) => readIndex().find((m) => m.id === id) || null,
    loadBody: (id) => {
      const b = readBody(id)
      if (!b) return null
      return { pages: b.doc.pages, nodes: b.doc.nodes, edges: b.doc.edges, config: b.doc.config, schemaVersion: b.schemaVersion }
    },
  }

  return {
    name: 'localStorage',
    listMeta, getMeta, loadBody, saveMeta, saveBody, remove, clear,
    sync,
    migrateLegacy: async () => 0,
  }
}

function mergeColl(prev, coll) {
  const map = new Map((Array.isArray(prev) ? prev : []).map((r) => [r.id, r]))
  const p = coll || {}
  for (const rm of p.remove || []) map.delete(rm)
  for (const k of Object.keys(p.set || {})) map.set(k, p.set[k])
  return Array.from(map.values())
}
