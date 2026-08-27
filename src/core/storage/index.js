// dsh-flowchart core/storage/index.js
// 职责：存储装配（P7）——业务只认 CanvasStore 接口；probeAdapters 能力探测自动选优
// 导出：probeAdapters / defaultStore / exportCanvasFile / importCanvasFile / CURRENT_SCHEMA_VERSION / genCanvasId / sanitizeDoc
import { localStorageAdapter } from './adapters/localStorage.js'
import { domainAdapter } from './adapters/domain.js'
import { migrateFile } from './migrate.js'
import { sanitizeDoc } from './integrity.js'
import { CURRENT_SCHEMA_VERSION, genCanvasId } from './schema.js'

export { CURRENT_SCHEMA_VERSION, genCanvasId } from './schema.js'
export { migrateFile } from './migrate.js'
export { sanitizeDoc } from './integrity.js'

// 能力探测：domain（@Remote 宿主文件）> localStorage（永远兜底）
export function probeAdapters(ns) {
  const available = []
  const d = domainAdapter(ns)
  if (d.ready) available.push(d)
  available.push(localStorageAdapter())
  return available
}

let cached = null
export function defaultStore(ns) {
  if (cached) return cached
  cached = probeAdapters(ns)[0]
  return cached
}

// 当前生效的存储模式（防静默：UI 可直接显示「宿主磁盘 / 浏览器本地」）
// domain = 宿主磁盘（跨端口共享）；localStorage = 浏览器本地（按端口隔离）
export function storeMode() {
  const store = cached || probeAdapters(undefined)[1]
  return store && store.name === 'domain' ? 'domain' : 'localStorage'
}

// 网关挂载失败原因（防静默诊断）：客户端 $mount 失败时记录，UI 提示条可直接展示
let mountErr = null
export function reportMountError(message) {
  mountErr = message ? String(message) : null
}
export function mountError() {
  return mountErr
}

// ---------- 文档级编排 ----------

// 导出：meta + body → CanvasFile 完整文件（备份/分享载体）
export async function exportCanvasFile(store, id) {
  const meta = await store.getMeta(id)
  const body = await store.loadBody(id)
  if (!meta || !body) return null
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: meta.id,
    name: meta.name,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    pages: body.pages || [],
    nodes: body.nodes || [],
    edges: body.edges || [],
    config: body.config || { theme: 'default', fontFamily: '' },
    meta: { source: 'export' },
  }
}

// 导入：CanvasFile JSON（备份恢复）→ migrate → 清洗 → 重新分配 id 新建（绝不覆盖现有）
export async function importCanvasFile(store, file) {
  if (!file || typeof file !== 'object') return { ok: false, reason: '不是有效的画布文件' }
  const cf = migrateFile(file)
  if (!cf || (!Array.isArray(cf.nodes) && !Array.isArray(cf.pages))) {
    return { ok: false, reason: '文件内容无法识别（需为 dsh-flowchart 画布 JSON）' }
  }
  const { doc, dropped } = sanitizeDoc(cf)
  const id = genCanvasId()
  const now = new Date().toISOString()
  await store.saveMeta({
    id, name: cf.name || '未命名画布', schemaVersion: CURRENT_SCHEMA_VERSION,
    createdAt: now, updatedAt: now, elementCount: doc.nodes.length + doc.edges.length, hasMedia: false,
  })
  const ok = await store.saveBody(id, fullPatch(doc))
  if (!ok) return { ok: false, reason: '画布数据超出存储容量，导入失败' }
  return { ok: true, id, dropped }
}

// 全量三集合 patch（业务保存 = 全量快照语义；适配器退化为 merge）
export function fullPatch(doc) {
  const coll = (arr) => {
    const set = {}
    for (const r of arr || []) set[r.id] = r
    return { set, remove: [] }
  }
  return {
    pages: coll(doc.pages),
    nodes: coll(doc.nodes),
    edges: coll(doc.edges),
    config: doc.config || { theme: 'default', fontFamily: '' },
  }
}
