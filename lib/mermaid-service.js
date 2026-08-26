// dsh-mermaid 宿主半业务核心：CanvasStore 契约 → 命名空间目录存储（严谨目录管理）
// 目录布局（不滥用 .dsh：唯一命名空间目录，内部严格分层）：
//   <storagesRoot>/dsh-mermaid/MANIFEST.json       命名空间清单（schemaVersion/插件标识/版本，缺则自动重建）
//   <storagesRoot>/dsh-mermaid/canvases/{id}.json  画布数据（每画布一个 JSON，原子写）
//   <storagesRoot>/dsh-mermaid/canvases/*.corrupt  损坏文件隔离（读时改名）
//   <storagesRoot>/dsh-mermaid/canvases/.*.tmp     原子写临时文件残留（启动扫描自动清扫）
// 迁移：旧目录 <storagesRoot>/mermaid-canvases/ 启动时一次性迁移（只入不覆盖；成功后旧目录改名 .migrated）
// 原子写：writeAtomic（同目录临时文件 + fsync + rename 替换；崩溃安全）
// 容错（P5）：损坏文件改名 .corrupt 隔离；meta 缓存启动扫描重建（文件为权威）
// 方法签名与 lib/wire.js 的 MM_INVOCATIONS 参数一一对应（网关严格路径按 wire 传参）
import { join, dirname, basename } from 'node:path'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile, readFile, rename, rm, readdir, open } from 'node:fs/promises'
import { sanitizeDoc } from '../src/core/storage/integrity.js'

export const fail = (e) => ({ ok: false, error: e && e.message ? e.message : String(e) })
export const ok = (extra) => Object.assign({ ok: true }, extra || {})

// 命名空间布局常量（导出供测试/文档断言）
export const NAMESPACE = 'dsh-mermaid'
export const MANIFEST_FILE = 'MANIFEST.json'
export const CANVASES_DIR = 'canvases'
export const LEGACY_MIGRATED_SUFFIX = '.migrated'
export const MANIFEST_SCHEMA_VERSION = 1

const nodeFs = {
  mkdir, writeFile, readFile, rename, rm, readdir,
  writeAtomic: async (file, data) => {
    const tmp = join(dirname(file), '.' + randomUUID() + '.tmp')
    const handle = await open(tmp, 'w')
    try {
      await handle.writeFile(JSON.stringify(data, null, 2), 'utf8')
      await handle.sync()
    } finally {
      await handle.close()
    }
    await rename(tmp, file)
  },
}

export function defaultStoragesRoot() {
  const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(dshHome, 'storages')
}

export async function createMermaidService({ storagesRoot, fsImpl }) {
  const fs = fsImpl || nodeFs
  const namespaceDir = join(storagesRoot, NAMESPACE)
  const manifestPath = join(namespaceDir, MANIFEST_FILE)
  const canvasesDir = join(namespaceDir, CANVASES_DIR)
  const canvasPath = (id) => join(canvasesDir, id + '.json')

  let cache = new Map() // id → meta（文件权威；写路径同步维护）
  let closed = false
  let writeChain = Promise.resolve()

  const enqueue = (task) => {
    const run = writeChain.then(task)
    writeChain = run.catch(() => {})
    return run
  }

  async function init() {
    await fs.mkdir(namespaceDir, { recursive: true })
    await fs.mkdir(canvasesDir, { recursive: true })
    await migrateLegacyDir(fs, join(storagesRoot, 'mermaid-canvases'), canvasesDir)
    await ensureManifest(fs, manifestPath)
    await sweepTmpFiles(fs, canvasesDir)
    await scan()
  }

  async function scan() {
    let names = []
    try { names = await fs.readdir(canvasesDir) } catch (e) { return }
    for (const name of names) {
      if (!name.endsWith('.json')) continue
      const id = name.slice(0, -5)
      const meta = await readMetaOf(id)
      if (meta) cache.set(id, meta)
    }
  }

  async function readCanvasFile(id) {
    let text
    try { text = await fs.readFile(canvasPath(id), 'utf8') } catch (e) { return null }
    try {
      const parsed = JSON.parse(text)
      if (!parsed || typeof parsed !== 'object' || typeof parsed.id !== 'string') throw new Error('shape')
      return parsed
    } catch (e) {
      try { await fs.rename(canvasPath(id), canvasPath(id) + '.corrupt') } catch (e2) { /* 尽力 */ }
      cache.delete(id)
      return null
    }
  }

  async function readMetaOf(id) {
    const raw = await readCanvasFile(id)
    if (!raw) return null
    return readMetaOfCached(raw)
  }

  const requireReady = () => { if (closed) throw new Error('mermaid-storage: 已关闭') }
  const sortByUpdated = (list) => list.slice().sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))

  // 三集合 merge（与客户端 localStorage 适配器同语义）
  function mergeColl(prev, coll) {
    const map = new Map((Array.isArray(prev) ? prev : []).map((r) => [r.id, r]))
    const p = coll || {}
    for (const rm of p.remove || []) map.delete(rm)
    for (const k of Object.keys(p.set || {})) map.set(k, p.set[k])
    return Array.from(map.values())
  }

  await init()

  return {
    // ---------- CanvasStore 契约（@Remote 方法；wire 见 lib/wire.js） ----------
    ping: async () => { requireReady(); return ok({ storage: 'files' }) },

    listMeta: async (q) => {
      requireReady()
      const query = q || {}
      let all = Array.from(cache.values())
      const kw = query.keyword ? String(query.keyword).trim() : ''
      if (kw) all = all.filter((m) => m.name && m.name.includes(kw))
      all = sortByUpdated(all)
      const total = all.length
      let items = all
      if (typeof query.page === 'number') {
        const size = query.pageSize || 20
        items = all.slice(query.page * size, query.page * size + size)
      }
      return ok({ items, total })
    },

    getMeta: async (id) => {
      requireReady()
      if (!id) return fail(new Error('缺少 id'))
      return ok({ meta: cache.get(id) || null })
    },

    loadBody: async (id) => {
      requireReady()
      if (!id) return fail(new Error('缺少 id'))
      const raw = await readCanvasFile(id)
      if (!raw) return ok({ body: null })
      const { doc, dropped } = sanitizeDoc(raw)
      return ok({ body: { pages: doc.pages, nodes: doc.nodes, edges: doc.edges, config: doc.config, schemaVersion: raw.schemaVersion || 1, dropped } })
    },

    saveMeta: async (meta) => {
      requireReady()
      if (!meta || !meta.id) return fail(new Error('meta 缺少 id'))
      return enqueue(async () => {
        const cur = await readCanvasFile(meta.id)
        const next = {
          schemaVersion: 1,
          id: meta.id,
          name: meta.name || '未命名画布',
          createdAt: (cur && cur.createdAt) || meta.createdAt || new Date().toISOString(),
          updatedAt: meta.updatedAt || new Date().toISOString(),
          pages: (cur && Array.isArray(cur.pages)) ? cur.pages : [],
          nodes: (cur && Array.isArray(cur.nodes)) ? cur.nodes : [],
          edges: (cur && Array.isArray(cur.edges)) ? cur.edges : [],
          config: (cur && cur.config && typeof cur.config === 'object') ? cur.config : { theme: 'default', fontFamily: '' },
        }
        await fs.writeAtomic(canvasPath(meta.id), next)
        cache.set(meta.id, readMetaOfCached(next))
        return ok()
      })
    },

    saveBody: async (id, patch) => {
      requireReady()
      const p = patch || {}
      if (!id) return fail(new Error('缺少 id'))
      return enqueue(async () => {
        const cur = await readCanvasFile(id)
        const now = new Date().toISOString()
        const next = {
          schemaVersion: 1,
          id,
          name: (cur && cur.name) || '未命名画布',
          createdAt: (cur && cur.createdAt) || now,
          updatedAt: now,
          pages: mergeColl(cur ? cur.pages : [], p.pages),
          nodes: mergeColl(cur ? cur.nodes : [], p.nodes),
          edges: mergeColl(cur ? cur.edges : [], p.edges),
          config: p.config && typeof p.config === 'object'
            ? Object.assign({}, (cur && cur.config) || {}, p.config)
            : ((cur && cur.config) || { theme: 'default', fontFamily: '' }),
        }
        await fs.writeAtomic(canvasPath(id), next)
        cache.set(id, readMetaOfCached(next))
        return ok()
      })
    },

    remove: async (id) => {
      requireReady()
      if (!id) return fail(new Error('缺少 id'))
      return enqueue(async () => {
        try { await fs.rm(canvasPath(id), { force: true }) } catch (e) { /* 尽力 */ }
        cache.delete(id)
      })
    },

    clear: async () => {
      requireReady()
      return enqueue(async () => {
        let names = []
        try { names = await fs.readdir(canvasesDir) } catch (e) { /* 空 */ }
        for (const name of names) {
          try { await fs.rm(join(canvasesDir, name), { force: true }) } catch (e) { /* 尽力 */ }
        }
        cache.clear()
      })
    },

    // ---------- 生命周期 ----------
    close: async () => { closed = true },
  }
}

function readMetaOfCached(raw) {
  return {
    id: raw.id,
    name: typeof raw.name === 'string' ? raw.name : '未命名画布',
    schemaVersion: raw.schemaVersion || 1,
    createdAt: raw.createdAt || '',
    updatedAt: raw.updatedAt || '',
    elementCount: (Array.isArray(raw.nodes) ? raw.nodes.length : 0) + (Array.isArray(raw.edges) ? raw.edges.length : 0),
    hasMedia: false,
  }
}

// ---------- 命名空间目录管理（纯函数辅助，供测试断言） ----------

const isCanvasFile = (name) => /^[A-Za-z0-9_-]+\.json$/.test(name)

// 命名空间清单：缺则自动重建（标识插件归属与版本时间；损坏则改 .corrupt 后重建）
export async function ensureManifest(fs, manifestPath) {
  const want = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    plugin: NAMESPACE,
    createdAt: new Date().toISOString(),
  }
  try {
    const text = await fs.readFile(manifestPath, 'utf8')
    const parsed = JSON.parse(text)
    if (parsed && parsed.plugin === NAMESPACE) return { ok: true, manifest: parsed }
    await fs.rename(manifestPath, manifestPath + '.corrupt').catch(() => {})
  } catch (e) { /* 不存在/损坏 → 重建 */ }
  await fs.writeAtomic(manifestPath, want)
  return { ok: true, manifest: want }
}

// 原子写临时文件残留清扫：canvases/ 下 .*.tmp 全部删除（崩溃恢复，启动时幂等）
export async function sweepTmpFiles(fs, dir) {
  let names = []
  try { names = await fs.readdir(dir) } catch (e) { return 0 }
  let n = 0
  for (const name of names) {
    if (/^\..+\.tmp$/.test(name)) {
      try { await fs.rm(join(dir, name)); n++ } catch (e) { /* 尽力 */ }
    }
  }
  return n
}

// 旧目录一次性迁移（只入不覆盖；成功清空后旧目录删除，否则改名 .migrated 标记）
export async function migrateLegacyDir(fs, legacyDir, canvasesDir) {
  let names = []
  try { names = await fs.readdir(legacyDir) } catch (e) { return { migrated: 0, skipped: 0, reason: 'no-legacy-dir' } }
  if (!names.length) {
    // 空壳旧目录：直接清理（不留无意义目录）
    try { await fs.rm(legacyDir, { recursive: true, force: true }) } catch (e) { /* 尽力 */ }
    return { migrated: 0, skipped: 0, reason: 'empty-legacy-dir' }
  }
  let migrated = 0
  let skipped = 0
  for (const name of names) {
    if (!isCanvasFile(name)) continue
    const target = join(canvasesDir, name)
    try {
      await fs.readFile(target, 'utf8')
      skipped++
      continue // 目标已存在（只入不覆盖）
    } catch (e) { /* 目标不存在 → 迁移 */ }
    try {
      const data = await fs.readFile(join(legacyDir, name), 'utf8')
      await fs.writeAtomic(target, JSON.parse(data))
      migrated++
    } catch (e) { /* 单个失败跳过，不阻断 */ }
  }
  if (migrated + skipped > 0) {
    // 旧目录只含已被迁移/跳过的 json → 删除目录；否则改名标记（保留下次重试）
    let leftovers = []
    try { leftovers = await fs.readdir(legacyDir) } catch (e) { leftovers = [] }
    const onlyMigrated = leftovers.every((n) => !isCanvasFile(n))
    if (onlyMigrated) {
      try { await fs.rm(legacyDir, { recursive: true, force: true }) } catch (e) { /* 尽力 */ }
    } else {
      try { await fs.rename(legacyDir, legacyDir + LEGACY_MIGRATED_SUFFIX) } catch (e) { /* 尽力 */ }
    }
  }
  return { migrated, skipped }
}
