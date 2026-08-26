// dsh-mermaid core/storage/adapters/domain.js —— 宿主目录文件适配器（现役）
// CanvasStore 契约 → remote.mermaidStorage；ready = remote 可用，probeAdapters 自动升级
export function domainAdapter(remote) {
  const call = remote && typeof remote.call === 'function' ? remote.call.bind(remote) : null
  const invoke = async (method, args, fallback) => {
    if (!call) return fallback
    const r = await call(method, args)
    if (!r || r.ok !== true) throw new Error(r && r.error ? r.error : '画布存储调用失败：' + method)
    return r
  }
  return {
    name: 'domain',
    ready: !!call,
    rpc: remote || null,
    listMeta: async (q) => {
      const r = await invoke('listMeta', { q: q || {} }, { items: [], total: 0 })
      return { items: r.items || [], total: r.total || 0 }
    },
    getMeta: async (id) => {
      const r = await invoke('getMeta', { id }, null)
      return r.meta || null
    },
    loadBody: async (id) => {
      const r = await invoke('loadBody', { id }, null)
      return r.body || null
    },
    saveMeta: async (meta) => { await invoke('saveMeta', { meta }, null) },
    saveBody: async (id, patch) => {
      await invoke('saveBody', { id, patch: patch || { pages: { set: {}, remove: [] }, nodes: { set: {}, remove: [] }, edges: { set: {}, remove: [] } } }, false)
      return true
    },
    remove: async (id) => { await invoke('remove', { id }, null) },
    clear: async () => { await invoke('clear', {}, null) },
  }
}
