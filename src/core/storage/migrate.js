// dsh-flowchart core/storage/migrate.js
// 职责：CanvasFile 版本链升级（v1 起；升级规则：缺字段补默认，未知字段保留）
import { CURRENT_SCHEMA_VERSION } from './schema.js'

export function migrateFile(raw) {
  if (!raw || typeof raw !== 'object') return null
  if (raw.schemaVersion === CURRENT_SCHEMA_VERSION) return raw
  // 兼容无版本号的历史形态（legacy 导入）：补默认结构
  if (typeof raw.id === 'string' && raw.id && Array.isArray(raw.nodes || raw.pages)) {
    const now = new Date().toISOString()
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: raw.id,
      name: typeof raw.name === 'string' ? raw.name : '未命名画布',
      createdAt: raw.createdAt || now,
      updatedAt: raw.updatedAt || now,
      pages: Array.isArray(raw.pages) ? raw.pages : [],
      nodes: Array.isArray(raw.nodes) ? raw.nodes : [],
      edges: Array.isArray(raw.edges) ? raw.edges : [],
      config: raw.config && typeof raw.config === 'object' ? raw.config : { theme: 'default', fontFamily: '' },
      meta: raw.meta || { source: 'migrated' },
    }
  }
  return null
}
