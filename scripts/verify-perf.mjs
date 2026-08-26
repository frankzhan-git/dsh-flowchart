// verify-perf —— 性能基线：300 节点 + 200 边 codegen < 50ms；patch 往返 < 100ms
import assert from 'node:assert/strict'
import { buildMermaidDoc } from '../src/core/codegen.js'
import { sanitizeDoc } from '../src/core/storage/integrity.js'
import { createPage, createNode } from '../src/core/model.js'

const page = createPage(0, 0, 800, 600)
const nodes = []
for (let i = 0; i < 300; i++) {
  const n = createNode(page.id, 'rectangle', (i % 30) * 40, Math.floor(i / 30) * 50, 120, 48)
  n.text = '节点' + i + ' 名称'
  nodes.push(n)
}
const edges = []
for (let i = 0; i < 200; i++) {
  const a = nodes[i % 300]
  const b = nodes[(i * 7 + 3) % 300]
  edges.push({
    id: 'e' + (i + 1), pageId: page.id, from: a.id, to: b.id,
    fromAnchor: { side: 'r', t: 0.5 }, toAnchor: { side: 'l', t: 0.5 },
    label: 'L' + i, kind: i % 4 === 0 ? 'dotted' : 'solid',
  })
}
const doc = { pages: [page], nodes, edges, config: { theme: 'forest', fontFamily: '' } }

const t0 = performance.now()
buildMermaidDoc(doc)
const codegenMs = performance.now() - t0
assert.ok(codegenMs < 50, 'codegen 超预算：' + codegenMs + 'ms')

const raw = JSON.parse(JSON.stringify({ pages: doc.pages, nodes: doc.nodes, edges: doc.edges, config: doc.config }))
const t1 = performance.now()
sanitizeDoc(raw)
const sanitizeMs = performance.now() - t1
assert.ok(sanitizeMs < 100, 'sanitize 超预算：' + sanitizeMs + 'ms')

console.log('✅ verify-perf: codegen ' + codegenMs.toFixed(1) + 'ms（<50ms）/ sanitize ' + sanitizeMs.toFixed(1) + 'ms（<100ms）')
