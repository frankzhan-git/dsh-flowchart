// verify-codegen —— 代码一等公民（C1）：形状语法/转义/方向/默认值省略/多页/孤儿边/插入文本
import assert from 'node:assert/strict'
import { buildMermaidDoc, buildPageCode, buildInsertText, escapeLabel, sanitizeNodeId, syntaxCheck } from '../src/core/codegen.js'
import { SHAPE_IDS } from '../src/core/shapes.js'
import { createPage, createNode, createEdge, freshDoc } from '../src/core/model.js'

function docWith(nodes, edges, pageCfg, docCfg) {
  const page = createPage(0, 0, 400, 300)
  if (pageCfg) Object.assign(page.config ?? {}, pageCfg)
  page.direction = (pageCfg && pageCfg.direction) || 'TD'
  return { pages: [page], nodes, edges, config: Object.assign({ theme: 'default', fontFamily: '' }, docCfg || {}) }
}

// 1. 基础：一节点一边
{
  const page = createPage(0, 0, 400, 300)
  const a = createNode(page.id, 'rectangle', 10, 10, 120, 48); a.text = '申请'
  const b = createNode(page.id, 'diamond', 10, 100, 120, 60); b.text = '通过?'
  const e = createEdge(page.id, a.id, { side: 'r', t: 0.5 }, b.id, { side: 't', t: 0.5 }, 'solid')
  e.label = '是'
  const r = buildPageCode(page, { pages: [page], nodes: [a, b], edges: [e], config: { theme: 'default', fontFamily: '' } })
  assert.ok(r.code.includes('flowchart TD'), '应输出 flowchart TD')
  assert.ok(r.code.includes('n1["申请"]'), '矩形文本应引号包裹')
  assert.ok(r.code.includes('n2{"通过?"}'), '菱形语法（引号包裹）')
  assert.ok(r.code.includes('n1 -- "是" --> n2'), '带标签边（引号包裹）')
  assert.ok(syntaxCheck(r.code), '基本结构自检')
}

// 2. 全部 14 形状语法命中
{
  const page = createPage(0, 0, 800, 600)
  const nodes = SHAPE_IDS.map((shape, i) => {
    const n = createNode(page.id, shape, 10 + i * 30, 10, 90, 40)
    n.text = 't'
    n.id = 'n' + (i + 1)
    return n
  })
  const r = buildPageCode(page, { pages: [page], nodes, edges: [], config: { theme: 'default', fontFamily: '' } })
  for (const [i, shape] of SHAPE_IDS.entries()) {
    const def = shapeOf(shape)
    assert.ok(r.code.includes('n' + (i + 1) + def.syntax('"t"')), shape + ' 语法未命中')
  }
}
import { shapeOf } from '../src/core/shapes.js'

// 3. 转义：引号 / 换行（htmlLabels） / 特殊字符 / 空文本（mermaid 拒绝 `[""]` 空串 → `[" "]`）
{
  assert.equal(escapeLabel('a"b'), '"a#quot;b"', '引号转义')
  assert.equal(escapeLabel('a\nb', true), '"a<br/>b"', '换行 → <br/>')
  assert.equal(escapeLabel('a\nb', false), '"a\nb"', '非 htmlLabels 保留换行')
  assert.equal(escapeLabel(''), '" "', '空文本 → 单空格空标签')
  const page = createPage(0, 0, 400, 300)
  const n1 = createNode(page.id, 'rectangle', 0, 0, 100, 40); n1.text = ''
  const r0 = buildPageCode(page, { pages: [page], nodes: [n1], edges: [], config: { theme: 'default', fontFamily: '' } })
  assert.ok(r0.code.includes(sanitizeNodeId(n1.id) + '[" "]'), '空文本单节点输出 [" "]')
  assert.ok(syntaxCheck(r0.code), '空文本单节点可解析')
  const n1b = createNode(page.id, 'rectangle', 0, 0, 100, 40); n1b.text = '含"引号"和{花括号}与|管道'
  const r = buildPageCode(page, { pages: [page], nodes: [n1b], edges: [], config: { theme: 'default', fontFamily: '' } })
  assert.ok(syntaxCheck(r.code), '特殊字符后仍可解析')
  assert.ok(r.code.includes(sanitizeNodeId(n1b.id) + '["含#quot;引号#quot;和{花括号}与|管道"]'), '转义输出')
}

// 4. 方向归一：TB → TD
{
  const page = createPage(0, 0, 400, 300); page.direction = 'TB'
  const n1 = createNode(page.id, 'rectangle', 0, 0, 100, 40)
  const r = buildPageCode(page, { pages: [page], nodes: [n1], edges: [], config: { theme: 'default', fontFamily: '' } })
  assert.ok(r.code.includes('flowchart TD'), 'TB 归一为 TD')
}

// 5. front-matter：仅非默认值 + 图命名（页面名 → title，mermaid 官方支持）
{
  const page = createPage(0, 0, 400, 300); page.name = '审批流程'
  page.config = { curve: 'linear', nodeSpacing: 60 }
  const n1 = createNode(page.id, 'rectangle', 0, 0, 100, 40)
  const r = buildPageCode(page, { pages: [page], nodes: [n1], edges: [], config: { theme: 'forest', fontFamily: '' } })
  assert.ok(r.code.includes('---'), '应有 front-matter')
  assert.ok(r.code.includes('title: "审批流程"'), '页面名 → title（图命名）')
  assert.ok(r.code.indexOf('title:') < r.code.indexOf('config:'), 'title 位于 config 之前')
  assert.ok(r.code.includes('theme: forest'), '主题输出')
  assert.ok(r.code.includes('curve: linear') && r.code.includes('nodeSpacing: 60'), '页面配置输出')
  assert.ok(!r.code.includes('rankSpacing') && !r.code.includes('padding') && !r.code.includes('useMaxWidth'), '默认值省略')
}

// 6. 孤儿边 → issue + 跳过；空页 → issue + 无产出
{
  const page = createPage(0, 0, 400, 300)
  const n1 = createNode(page.id, 'rectangle', 0, 0, 100, 40)
  const orphan = { id: 'e9', pageId: page.id, from: 'n1', to: 'gone', fromAnchor: { side: 'r', t: 0.5 }, toAnchor: { side: 'l', t: 0.5 }, label: '', kind: 'solid' }
  const r = buildPageCode(page, { pages: [page], nodes: [n1], edges: [orphan], config: { theme: 'default', fontFamily: '' } })
  assert.ok(r.issues.some((i) => i.text.includes('不存在')), '孤儿边 issue')
  assert.equal(r.code.match(/gone/g), null, '孤儿边不输出')
  const page2 = createPage(20, 20, 400, 300)
  const r2 = buildPageCode(page2, { pages: [page, page2], nodes: [n1], edges: [], config: { theme: 'default', fontFamily: '' } })
  assert.equal(r2.code, '', '空页不产出')
  assert.ok(r2.issues.some((i) => i.text.includes('为空')), '空页 issue')
}

// 7. 多页分块 + 插入文本
{
  const doc = freshDoc()
  const n1 = createNode(doc.pages[0].id, 'rectangle', 0, 0, 100, 40); n1.text = 'A'
  doc.nodes = [n1]
  const p2 = createPage(500, 20, 400, 300); p2.name = '页面2'
  const n2 = createNode(p2.id, 'circle', 0, 0, 60, 60); n2.text = 'B'
  doc.pages.push(p2)
  doc.nodes.push(n2)
  const r = buildMermaidDoc(doc)
  assert.equal(r.pages.length, 2, '两页两块')
  const all = buildInsertText(r.pages, true)
  assert.ok(all.includes('```mermaid'), '插入含代码块')
  assert.equal(all.match(/```mermaid/g).length, 2, '插入两页两块')
  const codeOnly = buildInsertText(r.pages, false)
  assert.ok(!codeOnly.includes('按以下'), '仅代码档无引导语')
}

// 8. C1 附加：任意半成品状态 → syntaxCheck 通过
{
  const page = createPage(0, 0, 400, 300)
  const n1 = createNode(page.id, 'hexagon', 0, 0, 100, 40); n1.text = ''
  const e1 = { id: 'e1', pageId: page.id, from: n1.id, to: n1.id, fromAnchor: { side: 't', t: 0 }, toAnchor: { side: 'b', t: 1 }, label: '"引号"', kind: 'dotted' }
  const r = buildPageCode(page, { pages: [page], nodes: [n1], edges: [e1], config: { theme: 'default', fontFamily: '' } })
  assert.ok(syntaxCheck(r.code), '半成品（空文本/自环/引号标签）仍合法')
}

console.log('✅ verify-codegen: 全部断言通过（含 14 形状语法/转义/方向/配置省略/孤儿边/多页/插入）')
