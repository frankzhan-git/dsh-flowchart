// verify-storage —— CanvasStore 契约：localStorage 适配器（内存 shim）meta/body 往返 / patch 合并 / 清洗
import assert from 'node:assert/strict'

// localStorage shim（Node 无该全局）
const mem = new Map()
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { mem.set(k, String(v)) },
  removeItem: (k) => { mem.delete(k) },
  key: (i) => Array.from(mem.keys())[i] || null,
  get length() { return mem.size },
}

const { localStorageAdapter } = await import('../src/core/storage/adapters/localStorage.js')
const { sanitizeDoc, isValidMeta } = await import('../src/core/storage/integrity.js')
const { migrateFile } = await import('../src/core/storage/migrate.js')
const { importCanvasFile, exportCanvasFile } = await import('../src/core/storage/index.js')
const { createPage, createNode } = await import('../src/core/model.js')

const store = localStorageAdapter()

// 1. meta/body 往返（saveMeta + saveBody 三集合 patch）
{
  const id = 'c1'
  await store.saveMeta({ id, name: '画布A', schemaVersion: 1, createdAt: '2025-01-01', updatedAt: '2025-01-02', elementCount: 2, hasMedia: false })
  const page = createPage(0, 0, 400, 300)
  const n1 = createNode(page.id, 'rectangle', 0, 0, 100, 40); n1.text = 'A'
  const ok = await store.saveBody(id, {
    pages: { set: { [page.id]: page }, remove: [] },
    nodes: { set: { [n1.id]: n1 }, remove: [] },
    edges: { set: {}, remove: [] },
  })
  assert.equal(ok, true)
  const body = await store.loadBody(id)
  assert.equal(body.pages.length, 1)
  assert.equal(body.nodes.length, 1)
  const meta = await store.getMeta(id)
  assert.equal(meta.name, '画布A')
  // 增量：删除节点 + 新增节点
  const n2 = createNode(page.id, 'circle', 0, 0, 60, 60)
  await store.saveBody(id, {
    pages: { set: {}, remove: [] },
    nodes: { set: { [n2.id]: n2 }, remove: [n1.id] },
    edges: { set: {}, remove: [] },
  })
  const body2 = await store.loadBody(id)
  assert.equal(body2.nodes.length, 1, 'remove + set 合并')
  assert.equal(body2.nodes[0].id, n2.id)
}
// 2. 列表排序与分页 + sync 变体
{
  await store.saveMeta({ id: 'c2', name: '画布B', schemaVersion: 1, createdAt: '2025-01-03', updatedAt: '2025-03-01', elementCount: 0, hasMedia: false })
  const r = await store.listMeta({ page: 0, pageSize: 10 })
  assert.ok(r.items.length >= 2)
  assert.ok(r.items[0].updatedAt >= r.items[1].updatedAt, 'updatedAt 倒序')
  const sync = store.sync.listMeta()
  assert.ok(Array.isArray(sync) && sync.length >= 2)
}
// 3. 损坏隔离（读取不抛）+ isValidMeta
{
  localStorage.setItem('dsh-flowchart:body:bad', '{broken')
  const b = await store.loadBody('bad')
  assert.equal(b, null, '损坏体返回 null')
  assert.equal(isValidMeta({ id: 'x', name: 'n', updatedAt: 't' }), true)
  assert.equal(isValidMeta({ id: 1, name: 'n', updatedAt: 't' }), false)
  localStorage.removeItem('dsh-flowchart:body:bad')
}
// 4. sanitizeDoc：非法记录丢弃 + 孤儿边剔除 + 未知字段保留
{
  const { doc, dropped } = sanitizeDoc({
    pages: [{ id: 'p1', x: 0, y: 0, w: 10, h: 10, extra: 'keep' }, { bad: true }],
    nodes: [{ id: 'n1', pageId: 'p1', x: 0, y: 0, w: 10, h: 10, shape: 'nope', text: 'x' }, { id: 2 }],
    edges: [{ id: 'e1', pageId: 'p1', from: 'n1', to: 'missing', fromAnchor: { side: 'r', t: 2 }, toAnchor: { side: 'l', t: -1 }, label: '', kind: 'bad' }],
  })
  assert.equal(doc.pages.length, 1)
  assert.equal(doc.pages[0].extra, 'keep', '未知字段保留')
  assert.equal(doc.pages[0].type, 'flowchart')
  assert.equal(doc.nodes.length, 1)
  assert.equal(doc.nodes[0].shape, 'rectangle', '未知形状回退')
  assert.equal(doc.edges.length, 0, '孤儿边剔除')
  assert.ok(dropped >= 3)
}
// 5. 导入：非法文件 → 拒绝；合法 → 新 id 绝不覆盖
{
  const r1 = await importCanvasFile(store, { nope: true })
  assert.equal(r1.ok, false)
  const file = {
    schemaVersion: 1, id: 'c1', name: '导入', createdAt: '2025-01-01', updatedAt: '2025-01-01',
    pages: [{ id: 'p1', x: 0, y: 0, w: 100, h: 100, type: 'flowchart' }],
    nodes: [{ id: 'n1', pageId: 'p1', x: 0, y: 0, w: 100, h: 40, shape: 'rectangle', text: 'X' }],
    edges: [],
    config: { theme: 'default', fontFamily: '' },
  }
  const r2 = await importCanvasFile(store, file)
  assert.equal(r2.ok, true)
  assert.notEqual(r2.id, 'c1')
  const meta = await store.getMeta(r2.id)
  assert.equal(meta.name, '导入')
  // 导出往返
  const cf = await exportCanvasFile(store, r2.id)
  assert.ok(cf && cf.nodes.length === 1)
}
// 6. migrateFile 版本链（v1 直接通过；无版本 → 补默认）
{
  assert.equal(migrateFile({ schemaVersion: 1, id: 'a' }).schemaVersion, 1)
  const m = migrateFile({ id: 'a', name: 'n', nodes: [] })
  assert.equal(m.schemaVersion, 1)
  assert.ok(Array.isArray(m.pages))
}
// 7. remove/clear
{
  await store.remove('c1')
  assert.equal(await store.getMeta('c1'), null)
  const before = (await store.listMeta({})).items.length
  await store.clear()
  const after = (await store.listMeta({})).items.length
  assert.ok(after <= before)
}

console.log('✅ verify-storage: 全部断言通过（往返/增量 patch/排序/损坏隔离/清洗/导入导出/迁移）')
