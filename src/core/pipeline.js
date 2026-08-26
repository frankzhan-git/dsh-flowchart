// dsh-mermaid core/pipeline.js
// 职责：doc → 每页 Mermaid 代码 + issues（纯函数；hooks 侧 useMemo 绑定）
import { buildMermaidDoc } from './codegen.js'

export function buildResult(doc) {
  const { pages, issues } = buildMermaidDoc(doc || { pages: [], nodes: [], edges: [], config: {} })
  const empty = !(doc && ((doc.nodes || []).length + (doc.edges || []).length))
  return { pages, issues, empty }
}
