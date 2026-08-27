// verify-host-storage —— 宿主命名空间目录存储（内存 fs 模拟）：
// 目录布局（MANIFEST/canvases 分层）/ 原子写 / 合并 / 损坏隔离 / tmp 清扫 / 旧目录迁移 / meta 缓存
import assert from 'node:assert/strict'
import { createFlowchartService, ensureManifest, sweepTmpFiles, migrateLegacyDir, migrateNamespaceDir, NAMESPACE, LEGACY_NAMESPACE } from '../lib/flowchart-service.js'

// 内存 fs：path → text；writeAtomic = 直写 + 模拟 rename（原子性语义由实现保证，测试校验结果）
function memFs() {
  const files = new Map()
  const N = (p) => String(p).replace(/\\/g, '/') // 归一化分隔符（node:path.join 在 Windows 出反斜杠）
  const dirNameOf = (p) => { const i = N(p).lastIndexOf('/'); return i === -1 ? '/' : N(p).slice(0, i) }
  return {
    files,
    mkdir: async () => {},
    writeFile: async (p, d) => { files.set(N(p), String(d)) },
    readFile: async (p) => {
      if (!files.has(N(p))) { const e = new Error('ENOENT'); e.code = 'ENOENT'; throw e }
      return files.get(N(p))
    },
    rename: async (a, b) => {
      const an = N(a)
      const bn = N(b)
      const keys = Array.from(files.keys()).filter((k) => k === an || k.startsWith(an + '/'))
      if (!keys.length) { const e = new Error('ENOENT'); e.code = 'ENOENT'; throw e }
      for (const k of keys) {
        files.set(bn + (k === an ? '' : k.slice(an.length)), files.get(k))
        files.delete(k)
      }
    },
    rm: async (p) => {
      const pn = N(p)
      // 目录删除：删除该目录前缀下所有文件（模拟 recursive）
      for (const k of Array.from(files.keys())) {
        if (k === pn || k.startsWith(pn + '/')) files.delete(k)
      }
    },
    readdir: async (dir) => {
      const prefix = N(dir)
      const out = new Set()
      for (const p of files.keys()) {
        if (!p.startsWith(prefix + '/')) continue
        const rel = p.slice(prefix.length + 1)
        const i = rel.indexOf('/')
        out.add(i === -1 ? rel : rel.slice(0, i))
      }
      return Array.from(out)
    },
    writeAtomic: async (p, data) => { files.set(N(p), JSON.stringify(data, null, 2)) },
  }
}

const NS = '/storages/dsh-flowchart'
const LEGACY = '/storages/mermaid-canvases'

const fs = memFs()
const svc = await createFlowchartService({ storagesRoot: '/storages', fsImpl: fs })

// 0. 目录布局：命名空间清单自动生成 + canvases 分层子目录
{
  assert.ok(fs.files.has(NS + '/MANIFEST.json'), 'MANIFEST.json 自动重建')
  const manifest = JSON.parse(fs.files.get(NS + '/MANIFEST.json'))
  assert.equal(manifest.plugin, 'dsh-flowchart')
  assert.equal(manifest.schemaVersion, 1)
}
// 1. 保存往返：saveMeta + saveBody 三集合合并（画布落 canvases/ 子目录）
{
  const page = { id: 'p1', x: 0, y: 0, w: 400, h: 300, type: 'flowchart', name: 'P' }
  const n1 = { id: 'n1', pageId: 'p1', x: 0, y: 0, w: 100, h: 40, shape: 'rectangle', text: 'A' }
  await svc.saveMeta({ id: 'd1', name: '测试', schemaVersion: 1, createdAt: '2025-01-01', updatedAt: '2025-01-01', elementCount: 0, hasMedia: false })
  let r = await svc.saveBody('d1', {
    pages: { set: { p1: page }, remove: [] },
    nodes: { set: { n1: n1 }, remove: [] },
    edges: { set: {}, remove: [] },
  })
  assert.equal(r.ok, true)
  assert.ok(fs.files.has(NS + '/canvases/d1.json'), '画布文件位于 canvases/ 子目录')
  const body = await svc.loadBody('d1')
  assert.equal(body.body.pages.length, 1)
  assert.equal(body.body.nodes.length, 1)
  // 增量删除 + 新增
  const n2 = { id: 'n2', pageId: 'p1', x: 0, y: 0, w: 60, h: 60, shape: 'circle', text: 'B' }
  r = await svc.saveBody('d1', {
    pages: { set: {}, remove: [] },
    nodes: { set: { n2: n2 }, remove: ['n1'] },
    edges: { set: {}, remove: [] },
  })
  assert.equal(r.ok, true)
  const body2 = await svc.loadBody('d1')
  assert.equal(body2.body.nodes.length, 1)
  assert.equal(body2.body.nodes[0].id, 'n2')
  const gm = await svc.getMeta('d1')
  assert.equal(gm.meta.elementCount, 1)
}
// 2. listMeta 倒序 + 分页
{
  await svc.saveMeta({ id: 'd0', name: '旧', schemaVersion: 1, createdAt: '2025-01-01', updatedAt: '2025-01-03', elementCount: 0, hasMedia: false })
  const r = await svc.listMeta({ page: 0, pageSize: 10 })
  assert.ok(r.items.length >= 2)
  assert.ok(r.items[0].updatedAt >= r.items[1].updatedAt)
}
// 3. 损坏文件隔离（.corrupt，位于 canvases/ 内）——启动扫描不崩、业务不出现
{
  fs.files.set(NS + '/canvases/bad.json', '{corrupt')
  const svc2 = await createFlowchartService({ storagesRoot: '/storages', fsImpl: fs })
  const r = await svc2.loadBody('bad')
  assert.equal(r.body, null, '损坏 → body null')
  const r2 = await svc2.listMeta({})
  assert.ok(!r2.items.some((m) => m.id === 'bad'), '损坏文件不入列表')
  assert.ok(fs.files.has(NS + '/canvases/bad.json.corrupt'), '改名 .corrupt 隔离')
  fs.files.delete(NS + '/canvases/bad.json.corrupt')
}
// 3.5 原子写临时文件残留清扫（启动幂等）
{
  fs.files.set(NS + '/canvases/.abc.tmp', '{"partial": 1}')
  fs.files.set(NS + '/canvases/.def.tmp', '{"partial": 2}')
  const svc3 = await createFlowchartService({ storagesRoot: '/storages', fsImpl: fs })
  assert.ok(!fs.files.has(NS + '/canvases/.abc.tmp'), 'tmp 残留已清扫')
  assert.ok(fs.files.has(NS + '/canvases/d1.json'), '正常画布不受影响')
}
// 4. 宿主侧清洗：孤儿边/非法记录读时丢弃
{
  await svc.saveBody('d1', {
    pages: { set: {}, remove: [] },
    nodes: { set: { bad: { id: 123 } }, remove: [] },
    edges: { set: {}, remove: [] },
  })
  const body = await svc.loadBody('d1')
  assert.ok(body.body.dropped >= 1, '非法记录计数上报')
}
// 5. 旧目录一次性迁移（只入不覆盖）
{
  // 旧目录遗留数据 + 与现有画布同名的冲突数据
  fs.files.set(LEGACY + '/old1.json', JSON.stringify({ schemaVersion: 1, id: 'old1', name: '旧文件', nodes: [], edges: [], pages: [] }))
  fs.files.set(LEGACY + '/d1.json', JSON.stringify({ schemaVersion: 1, id: 'd1', name: '冲突被忽略', nodes: [], edges: [], pages: [] }))
  const svc4 = await createFlowchartService({ storagesRoot: '/storages', fsImpl: fs })
  assert.ok(fs.files.has(NS + '/canvases/old1.json'), '旧文件迁移成功')
  const gm = await svc4.getMeta('old1')
  assert.equal(gm.meta.name, '旧文件')
  const gm2 = await svc4.getMeta('d1')
  assert.equal(gm2.meta.name, '测试', '同名冲突只入不覆盖（保留现有）')
  const rm = await migrateLegacyDir(fs, LEGACY, NS + '/canvases')
  assert.ok(fs.files.has(LEGACY + '.migrated/d1.json'), '旧目录改名 .migrated 标记（含冲突残留时）')
}
// 6. remove / clear
{
  await svc.remove('d0')
  assert.equal((await svc.getMeta('d0')).meta, null)
  await svc.close()
}

// 7. 纯函数层：ensureManifest 幂等 / sweepTmpFiles 计数
{
  const r = await ensureManifest(fs, NS + '/MANIFEST.json')
  assert.equal(r.manifest.plugin, 'dsh-flowchart')
  fs.files.set(NS + '/canvases/.x.tmp', '1')
  const n = await sweepTmpFiles(fs, NS + '/canvases')
  assert.equal(n, 1)
}

// 8. 改名迁移：旧命名空间 dsh-mermaid → dsh-flowchart（整目录改名；目标已存在不动作；旧清单兼容）
{
  const fs2 = memFs()
  fs2.files.set('/storages/dsh-mermaid/MANIFEST.json', JSON.stringify({ schemaVersion: 1, plugin: LEGACY_NAMESPACE, createdAt: '2025-01-01' }))
  fs2.files.set('/storages/dsh-mermaid/canvases/old1.json', JSON.stringify({ schemaVersion: 1, id: 'old1', name: '旧画布', nodes: [], edges: [], pages: [] }))
  const svc5 = await createFlowchartService({ storagesRoot: '/storages', fsImpl: fs2 })
  const moved = await migrateNamespaceDir(fs2, '/storages/dsh-mermaid', NS)
  assert.equal(moved.migrated, 0, '服务启动已迁移过,再调用不应重复迁移')
  assert.ok(fs2.files.has(NS + '/canvases/old1.json'), '旧命名空间画布随整目录迁移到新命名空间')
  assert.ok(!fs2.files.has('/storages/dsh-mermaid/canvases/old1.json'), '旧命名空间原路径已移除')
  const manifest = JSON.parse(fs2.files.get(NS + '/MANIFEST.json'))
  assert.equal(manifest.plugin, LEGACY_NAMESPACE, '旧清单被接受（不当作损坏重建）')
  assert.equal(manifest.createdAt, '2025-01-01', '旧清单 createdAt 保留')
  const gm3 = await svc5.getMeta('old1')
  assert.equal(gm3.meta.name, '旧画布', '迁移后元数据可读')
  await svc5.close()
}
// 9. 改名迁移幂等/目标存在保护：新命名空间已有数据时不动作
{
  const fs3 = memFs()
  fs3.files.set('/storages/dsh-mermaid/canvases/old2.json', JSON.stringify({ schemaVersion: 1, id: 'old2', name: '旧', nodes: [], edges: [], pages: [] }))
  fs3.files.set(NS + '/canvases/new2.json', JSON.stringify({ schemaVersion: 1, id: 'new2', name: '新', nodes: [], edges: [], pages: [] }))
  const m = await migrateNamespaceDir(fs3, '/storages/dsh-mermaid', NS)
  assert.equal(m.reason, 'target-exists', '目标非空 → 不迁移')
  assert.ok(fs3.files.has('/storages/dsh-mermaid/canvases/old2.json'), '旧数据保留原处')
  assert.ok(fs3.files.has(NS + '/canvases/new2.json'), '新数据显示不动')
}

console.log('✅ verify-host-storage: 全部断言通过（目录布局/MANIFEST/往返/合并/损坏隔离/tmp清扫/旧目录迁移/清洗/删除/命名空间改名迁移）')
