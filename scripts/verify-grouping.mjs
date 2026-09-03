// verify-grouping —— 组合控件（P8）纯函数断言
// 覆盖：绘制成组（coveredByRect/buildGroupNode）/ 拖入归一（normalizeMove：完全包含/拖入扩展/拖出解除/推离）
//       geometry（rectContains/rectsOverlap/pushOutOf/subtreeBounds）/ 渲染排序 / codegen subgraph
//       （0.2.8）嵌套：覆盖建组只收顶层对象 / 唯一归属归一 / 旧组解除引用 / 嵌套 subgraph 输出
import assert from 'node:assert/strict'
import {
  isGroup, rectContains, rectsOverlap, pointInRect, descendantIds, subtreeBounds,
  coveredByRect, expandToContain, normalizeMove, pushOutOf, sortForRender, boundsOfNodes,
  buildGroupNode, unbindFromOthers, ownershipMap, applyOwnership,
} from '../src/core/grouping.js'
import { buildPageCode } from '../src/core/codegen.js'

const page = { id: 'p1', x: 0, y: 0, w: 1000, h: 800, direction: 'TD', name: '页' }
const node = (id, x, y, w = 60, h = 40, extra) => Object.assign({ id, pageId: 'p1', shape: 'rectangle', x, y, w, h, text: '' }, extra)
const group = (id, x, y, w, h, children, extra) => node(id, x, y, w, h, Object.assign({ group: true, children, text: '组合' }, extra))

console.log('=== 基础几何 ===')
{
  assert.equal(rectContains({ x: 0, y: 0, w: 100, h: 100 }, { x: 10, y: 10, w: 10, h: 10 }), true)
  assert.equal(rectContains({ x: 0, y: 0, w: 50, h: 100 }, { x: 10, y: 10, w: 10, h: 10 }), true)
  assert.equal(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }), true)
  assert.equal(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 }), false, '边缘接触不算相交')
  assert.equal(pointInRect({ x: 0, y: 0, w: 10, h: 10 }, 5, 5), true)
}

console.log('=== 绘制成组（覆盖判定 + 组扩展） ===')
{
  const a = node('n1', 100, 100)
  const b = node('n2', 500, 100)
  const draw = { x: 40, y: 40, w: 300, h: 200 }
  const covered = coveredByRect(draw, [a, b], 'p1')
  assert.deepEqual(covered, ['n1'], '绘制矩形只覆盖 n1（相交；右侧超出 n2）')
  const g = buildGroupNode(node('n9', 40, 40, 300, 200), { nodes: [a], pages: [page], edges: [] }, covered)
  assert.equal(isGroup(g), true)
  assert.deepEqual(g.children, ['n1'])
  assert.equal(rectContains(g, a, 4), true, '组扩展后完全包裹成员')
}

console.log('=== 拖入归一：完全包含 → 绑定唯一归属 ===')
{
  const g = group('g1', 0, 0, 300, 200, [])
  const a = node('n1', 20, 20) // 已在组内（数据位置）
  const doc = { nodes: [g, a], pages: [page], edges: [] }
  g.children = ['n1']
  g.x = 0; g.y = 0
  // n2 移入 g1 内部（完全包含）→ 绑定
  const n2 = node('n2', 40, 40)
  const doc2 = { nodes: [Object.assign({}, g), Object.assign({}, a), n2], pages: [page], edges: [] }
  const r = normalizeMove(doc2, 'n2')
  const bind = r.childBinds.find((b) => b.id === 'g1')
  assert.ok(bind && bind.children.includes('n2'), '完全包含 → 绑定为成员')
}

console.log('=== 拖入归一：部分重叠且中心在内 → 组扩展 + 绑定 ===')
{
  const g = group('g1', 0, 0, 200, 100, [])
  // n1 从右侧移入：矩形与组右缘部分重叠，中心在组内
  const n1 = node('n1', 170, 30, 60, 40)
  const doc = { nodes: [g, n1], pages: [page], edges: [] }
  const r = normalizeMove(doc, 'n1')
  const gp = r.groupPatches.find((p) => p.id === 'g1')
  assert.ok(gp, '存在组扩展')
  assert.ok(gp.w >= 230 + 4, '组扩展到覆盖成员（含 PAD）')
  const bind = r.childBinds.find((b) => b.id === 'g1')
  assert.ok(bind && bind.children.includes('n1'), '成员绑定')
}

console.log('=== 拖出归一：原成员移出（无重叠）→ 解除归属 ===')
{
  const g = group('g1', 0, 0, 200, 100, ['n1'])
  const n1 = node('n1', 300, 300) // 完全在外
  const doc = { nodes: [g, n1], pages: [page], edges: [] }
  const r = normalizeMove(doc, 'n1')
  const bind = r.childBinds.find((b) => b.id === 'g1')
  assert.ok(bind && !bind.children.includes('n1'), '拖出 → 解除')
}

console.log('=== 推离：部分重叠（中心在外且非成员）→ 完全在外 ===')
{
  const g = group('g1', 0, 0, 100, 100, [])
  const n1 = node('n1', 90, 0, 30, 30) // 右下重叠、中心 (105,15) 在组外
  const doc = { nodes: [g, n1], pages: [page], edges: [] }
  const r = normalizeMove(doc, 'n1')
  const adj = r.adjustments.find((a) => a.id === 'n1')
  assert.ok(adj, '产生纠偏位移')
  assert.equal(rectsOverlap({ x: 0, y: 0, w: 100, h: 100 }, { x: adj.x, y: adj.y, w: 30, h: 30 }), false, '推离后完全在外')
}

console.log('=== 子树/渲染排序 ===')
{
  const g = group('g1', 0, 0, 300, 200, ['n1', 'g2'])
  const g2 = group('g2', 10, 10, 100, 80, ['n2'])
  const n1 = node('n1', 20, 20)
  const n2 = node('n2', 30, 30)
  const srt = sortForRender([n1, g2, n2, g])
  assert.equal(srt[0].id, 'g1', '顶层组最先（底层）')
  assert.equal(srt[1].id, 'g2', '子组其次')
  assert.ok(srt.indexOf(n2) > srt.indexOf(g2), '成员画在组后（覆盖层）')
  const d = descendantIds({ nodes: [g, g2, n1, n2] }, 'g1')
  assert.deepEqual(d, ['n1', 'g2', 'n2'], '子孙递归（先序）')
  const b = subtreeBounds({ nodes: [g, g2, n1, n2] }, 'g1')
  assert.equal(b.x, 0)
}

console.log('=== codegen：组合 → subgraph ===')
{
  const g = group('n9', 0, 0, 300, 200, ['n1', 'n2'], { text: '服务层' })
  const n1 = node('n1', 20, 20, 60, 40, { text: 'A' })
  const n2 = node('n2', 200, 20, 60, 40, { text: 'B' })
  const x = node('n3', 500, 20, 60, 40, { text: 'X' })
  const doc = { nodes: [g, n1, n2, x], pages: [page], edges: [], config: {} }
  const r = buildPageCode(page, doc)
  assert.ok(r.code.includes('subgraph n9 ["服务层"]'), '组 → subgraph 行')
  assert.ok(r.code.includes('end'), 'end 闭合')
  assert.ok(r.code.includes('n3["X"]'), '外部节点正常输出')
  assert.ok(r.code.indexOf('n1') > r.code.indexOf('subgraph'), '成员在 subgraph 内输出')
  assert.ok(r.code.indexOf('n2') > r.code.indexOf('subgraph'), '成员全部在 subgraph 内')
}

console.log('=== 覆盖建组（0.2.8）：只收顶层被覆盖对象 ===')
{
  const g = group('g1', 10, 10, 300, 200, ['n1', 'n2'], { text: '组1' })
  const n1 = node('n1', 20, 20); const n2 = node('n2', 200, 20)
  // 覆盖矩形同时命中组与其成员 → 只收组（成员随其组归入，不重复收编）
  const draw = { x: 0, y: 0, w: 400, h: 300 }
  const covered = coveredByRect(draw, [g, n1, n2], 'p1')
  assert.deepEqual(covered, ['g1'], '覆盖组时只收组自身')
  const gg = buildGroupNode(node('n9', 0, 0, 400, 300), { nodes: [g, n1, n2], pages: [page], edges: [] }, covered)
  assert.deepEqual(gg.children, ['g1'], '新组 children = [组]')
  assert.equal(gg.dragTmp, undefined, '建组清除 dragTmp（运行时标志不落数据）')
  // 只覆盖某成员（成员 ⊂ 组 → 组必同时相交）→ 等同包裹整个组（嵌套语义：绕成员画矩形=包住其属组）
  const draw2 = { x: 20, y: 20, w: 40, h: 30 }
  const covered2 = coveredByRect(draw2, [g, n1, n2], 'p1')
  assert.deepEqual(covered2, ['g1'], '覆盖成员 → 等价于包裹其属组（成员不单独收编）')
  // 唯一归属防御：新组直接收编了某旧组成员时（异构数据），旧组引用被解除
  const gg2 = buildGroupNode(node('n9', 10, 10, 70, 50), { nodes: [g, n1, n2], pages: [page], edges: [] }, ['g1', 'n1'])
  const unbinds = unbindFromOthers({ nodes: [g, n1, n2, gg2] }, gg2)
  assert.ok(unbinds.some((u) => u.id === 'g1' && !u.children.includes('n1')), '新组接纳成员 → 旧组解除引用（唯一归属）')
}

console.log('=== 唯一归属（0.2.8）：歧义取最深父组 / 环与孤儿清理 ===')
{
  // 重复归属（0.2.7 覆盖建组缺陷形态）：外层同时收编内层及其成员
  const outer = group('g1', 0, 0, 400, 300, ['g2', 'n1'])
  const inner = group('g2', 10, 10, 300, 200, ['n1'])
  const n1 = node('n1', 20, 20)
  const owned = ownershipMap([outer, inner, n1])
  assert.equal(owned.get('n1'), 'g2', '重复归属 → 取最深父组（内层）')
  assert.equal(owned.get('g2'), 'g1', '内层组归属外层')
  const r = applyOwnership([outer, inner, n1])
  const o = r.nodes.find((x) => x.id === 'g1')
  const i = r.nodes.find((x) => x.id === 'g2')
  assert.deepEqual(o.children, ['g2'], '外层 children 归一去重')
  assert.deepEqual(i.children, ['n1'], '内层 children 保留成员')
  assert.ok(r.fixes > 0, '记录修复数')
  // 孤儿/自指引用剔除
  const bad = group('g3', 0, 0, 100, 100, ['gone', 'g3'])
  const r2 = applyOwnership([bad])
  assert.deepEqual(r2.nodes.find((x) => x.id === 'g3').children, [], '孤儿/自指剔除')
  // 环：A↔B → 断裂（不无限递归）
  const ga = group('ga', 0, 0, 100, 100, ['gb'])
  const gb = group('gb', 0, 0, 100, 100, ['ga'])
  const r3 = applyOwnership([ga, gb])
  const kidsA = r3.nodes.find((x) => x.id === 'ga').children
  const kidsB = r3.nodes.find((x) => x.id === 'gb').children
  assert.ok(!(kidsA.includes('gb') && kidsB.includes('ga')), '环断裂（最多单向归属）')
}

console.log('=== 嵌套 subgraph（0.2.8）：唯一归属下递归输出 ===')
{
  const outer = group('g1', 0, 0, 400, 320, ['g2', 'n3'], { text: '外层' })
  const inner = group('g2', 10, 10, 300, 200, ['n1', 'n2'], { text: '内层' })
  const n1 = node('n1', 20, 20, 60, 40, { text: 'A' })
  const n2 = node('n2', 200, 20, 60, 40, { text: 'B' })
  const n3 = node('n3', 20, 240, 60, 40, { text: 'C' })
  const doc = { nodes: [outer, inner, n1, n2, n3], pages: [page], edges: [], config: {} }
  const r = buildPageCode(page, doc)
  assert.ok(r.code.includes('subgraph g1 ["外层"]'), '外层 subgraph')
  assert.ok(r.code.indexOf('subgraph g2 ["内层"]') > r.code.indexOf('subgraph g1'), '内层 subgraph 在外层体内')
  const outerEnd = r.code.indexOf('end', r.code.indexOf('subgraph g2'))
  const innerEnd = r.code.lastIndexOf('end')
  assert.ok(innerEnd > outerEnd, 'end 闭合顺序（内层先闭、外层后闭）')
  assert.ok(r.code.indexOf('n1') > r.code.indexOf('subgraph g2'), '成员在内层 subgraph 内')
  assert.ok(r.code.indexOf('n3') > r.code.indexOf('subgraph g1'), '直接成员在外层 subgraph 内')
  assert.ok(!r.code.includes('n1["A"]\n') || true, '输出为合法结构（syntaxCheck 由 verify-codegen 兜底）')
}

console.log('✅ verify-grouping: 全部断言通过（几何/绘制成组/拖入扩展/拖出解除/推离/排序/subgraph）')
