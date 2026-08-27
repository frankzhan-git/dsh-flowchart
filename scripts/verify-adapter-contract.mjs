// verify-adapter-contract —— CanvasStore 契约形状（domain 现役 / localStorage 兜底 / 装配顺序）
// v0.2.5：domain 适配器接收命名空间服务对象（位置参数直调 remote.flowchartStorage.*）
import assert from 'node:assert/strict'
import { domainAdapter } from '../src/core/storage/adapters/domain.js'
import { localStorageAdapter } from '../src/core/storage/adapters/localStorage.js'
import { probeAdapters, defaultStore } from '../src/core/storage/index.js'

const METHODS = ['listMeta', 'getMeta', 'loadBody', 'saveMeta', 'saveBody', 'remove', 'clear']

// 载体层信封（RemoteResult）：{ ok, value } | { ok:false, error }
const carried = (value) => ({ ok: true, value })
const fakeNs = {
  ping: async () => carried({ ok: true, storage: 'files' }),
  listMeta: async (q) => carried({ ok: true, items: [], total: 0 }),
  getMeta: async (id) => carried({ ok: true, meta: null }),
  loadBody: async (id) => carried({ ok: true, body: null }),
  saveMeta: async (meta) => carried({ ok: true }),
  saveBody: async (id, patch) => carried({ ok: true }),
  removeCanvas: async (id) => carried({ ok: true }),
  clear: async () => carried({ ok: true }),
}

// 1. domain：无命名空间 → 不可用；有命名空间 → 全部契约方法 + 位置参数直调
{
  const dNone = domainAdapter(null)
  assert.equal(dNone.ready, false, '无命名空间不可用')
  const d = domainAdapter(fakeNs)
  assert.equal(d.ready, true)
  for (const m of METHODS) assert.equal(typeof d[m], 'function', 'domain 缺 ' + m)
  assert.equal(d.name, 'domain')

  // 位置参数直调：ns 收到的是位置参数（id, patch），而非单对象
  let got = null
  const spyNs = Object.assign({}, fakeNs, {
    saveBody: async (id, patch) => { got = { id, patch }; return carried({ ok: true }) },
    getMeta: async (id) => { got = { id }; return carried({ ok: true, meta: null }) },
  })
  const dspy = domainAdapter(spyNs)
  await dspy.saveBody('x1', { set: { a: 1 }, remove: [] })
  assert.deepEqual(got, { id: 'x1', patch: { set: { a: 1 }, remove: [] } }, 'saveBody 位置参数')
  await dspy.getMeta('x2')
  assert.deepEqual(got, { id: 'x2' }, 'getMeta 位置参数')
}
// 2. localStorage：契约方法 + sync 变体 + 迁移入口
{
  const ls = localStorageAdapter()
  for (const m of METHODS) assert.equal(typeof ls[m], 'function', 'localStorage 缺 ' + m)
  assert.ok(ls.sync && typeof ls.sync.listMeta === 'function', 'sync 变体')
  assert.equal(ls.name, 'localStorage')
}
// 3. probe：命名空间传入 → domain 优先；无 → localStorage 兜底
{
  const withNs = probeAdapters(fakeNs)
  assert.equal(withNs[0].name, 'domain', '命名空间可用时 domain 优先')
  const noNs = probeAdapters(null)
  assert.equal(noNs[0].name, 'localStorage', '无命名空间兜底 localStorage')
  assert.ok(noNs.some((a) => a.name === 'localStorage'))
}

console.log('✅ verify-adapter-contract: 全部断言通过（契约形状/降级顺序/位置参数直调）')
