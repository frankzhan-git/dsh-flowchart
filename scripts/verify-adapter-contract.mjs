// verify-adapter-contract —— CanvasStore 契约形状（domain 现役 / localStorage 兜底 / 装配顺序）
import assert from 'node:assert/strict'
import { domainAdapter } from '../src/core/storage/adapters/domain.js'
import { localStorageAdapter } from '../src/core/storage/adapters/localStorage.js'
import { probeAdapters, defaultStore } from '../src/core/storage/index.js'

const METHODS = ['listMeta', 'getMeta', 'loadBody', 'saveMeta', 'saveBody', 'remove', 'clear']

// 1. domain：无 remote → 不可用；有 remote → 全部契约方法 + ready
{
  const dNone = domainAdapter(null)
  assert.equal(dNone.ready, false, '无 remote 不可用')
  const fakeRemote = {
    call: async (method, args) => {
      if (method === 'listMeta') return { ok: true, value: { ok: true, items: [], total: 0 } }
      if (method === 'getMeta') return { ok: true, value: { ok: true, meta: null } }
      if (method === 'loadBody') return { ok: true, value: { ok: true, body: null } }
      return { ok: true, value: { ok: true } }
    },
  }
  const d = domainAdapter({ call: fakeRemote.call })
  assert.equal(d.ready, true)
  for (const m of METHODS) assert.equal(typeof d[m], 'function', 'domain 缺 ' + m)
  assert.equal(d.name, 'domain')
}
// 2. localStorage：契约方法 + sync 变体 + 迁移入口
{
  const ls = localStorageAdapter()
  for (const m of METHODS) assert.equal(typeof ls[m], 'function', 'localStorage 缺 ' + m)
  assert.ok(ls.sync && typeof ls.sync.listMeta === 'function', 'sync 变体')
  assert.equal(ls.name, 'localStorage')
}
// 3. probe：remote 传入 → domain 优先；无 remote → localStorage 兜底
{
  const withRemote = probeAdapters({ call: async () => ({ ok: true, value: { ok: true } }) })
  assert.equal(withRemote[0].name, 'domain', 'remote 可用时 domain 优先')
  const noRemote = probeAdapters(null)
  assert.equal(noRemote[0].name, 'localStorage', '无 remote 兜底 localStorage')
  // 兜底永续存在
  assert.ok(noRemote.some((a) => a.name === 'localStorage'))
}

console.log('✅ verify-adapter-contract: 全部断言通过（契约形状/降级顺序/同步变体）')
