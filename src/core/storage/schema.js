// dsh-flowchart core/storage/schema.js
// 职责：CanvasFile 版本常量 + 画布 id 工厂 + 新文件工厂
export const CURRENT_SCHEMA_VERSION = 1

export function genCanvasId() {
  return String(Date.now()) + '-' + Math.random().toString(36).slice(2, 6)
}

// 新画布文件（pages/nodes/edges 由调用方填充）
export function newCanvasFile(name, id) {
  const now = new Date().toISOString()
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: id || genCanvasId(),
    name: typeof name === 'string' && name.trim() ? name : '未命名画布',
    createdAt: now,
    updatedAt: now,
    pages: [],
    nodes: [],
    edges: [],
    config: { theme: 'default', fontFamily: '' },
    meta: { source: 'canvas' },
  }
}
