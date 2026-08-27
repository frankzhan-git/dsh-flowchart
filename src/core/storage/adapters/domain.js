// dsh-flowchart core/storage/adapters/domain.js —— 宿主目录文件适配器（现役）
// CanvasStore 契约 → remote.flowchartStorage 命名空间（rc.2 官方消费范式：位置参数直调）。
// 消费规范：命名空间服务经「驻扎插件」注入（inject: ['remote.flowchartStorage']），
// 传入本适配器的是命名空间服务对象本身；ready = 命名空间已挂载。
export function domainAdapter(ns) {
  const ready = !!ns && typeof ns.listMeta === 'function' && typeof ns.saveBody === 'function'
  // 载体层信封：{ ok, value(业务结果) } | { ok:false, error(code/message) }
  const invoke = async (call, fallback) => {
    if (!ready) return fallback
    const carried = await Promise.resolve(call())
    if (!carried || carried.ok !== true) {
      const err = carried && carried.error
      throw new Error(err && err.message ? err.message : (err ? String(err) : '画布存储调用失败'))
    }
    return carried.value || { ok: true }
  }
  return {
    name: 'domain',
    ready,
    rpc: ns || null,
    listMeta: async (q) => {
      const r = await invoke(() => ns.listMeta(q || {}), { items: [], total: 0 })
      return { items: r.items || [], total: r.total || 0 }
    },
    getMeta: async (id) => {
      const r = await invoke(() => ns.getMeta(id), null)
      return r.meta || null
    },
    loadBody: async (id) => {
      const r = await invoke(() => ns.loadBody(id), null)
      return r.body || null
    },
    saveMeta: async (meta) => { await invoke(() => ns.saveMeta(meta), null) },
    saveBody: async (id, patch) => {
      await invoke(() => ns.saveBody(id, patch || {
        pages: { set: {}, remove: [] }, nodes: { set: {}, remove: [] }, edges: { set: {}, remove: [] },
      }), false)
      return true
    },
    remove: async (id) => { await invoke(() => ns.removeCanvas(id), null) },
    clear: async () => { await invoke(() => ns.clear(), null) },
  }
}
