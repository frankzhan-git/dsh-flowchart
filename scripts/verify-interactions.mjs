// verify-interactions —— Q1 模式即语义 / 箭头（吸附/跨页取消/锚点）/ 移动钳制 / 批量 / 直弧判定
import assert from 'node:assert/strict'
import {
  decidePointerDown, updateDrag, settleDrag, arrowGhost, anchorDragGhost, computeMove, hoverCursorFor, hoverAnchorFor,
} from '../src/core/interactions.js'
import { edgeKindOf, anchorFromPoint, anchorToWorld, edgeGeom, groupBounds } from '../src/core/geometry.js'
import { createPage, createNode, createEdge } from '../src/core/model.js'

function mkDoc() {
  const page = createPage(0, 0, 400, 300)
  const a = createNode(page.id, 'rectangle', 20, 20, 120, 48); a.text = 'A'
  const b = createNode(page.id, 'rectangle', 220, 90, 120, 48); b.text = 'B'
  return { pages: [page], nodes: [a, b], edges: [], config: { theme: 'default', fontFamily: '' } }
}
const ctx = (doc, extra) => Object.assign({ doc, mode: 'select', zoom: 1, selectedIds: [], selectedEdge: null, spaceDown: false, pan: { x: 0, y: 0 } }, extra || {})

// 1. 绘制模式：页面内空白 = 建节点；页面外 = 建页面
{
  const doc = mkDoc()
  const r1 = decidePointerDown(ctx(doc, { mode: 'draw' }), 100, 100, 100, 100)
  assert.equal(r1.kind, 'nodeCreate', '页面内空白 → nodeCreate')
  const r2 = decidePointerDown(ctx(doc, { mode: 'draw' }), 500, 500, 500, 500)
  assert.equal(r2.kind, 'pageCreate', '页面外 → pageCreate')
}
// 2. Q1 模式即语义：边带/角在两种模式下的行为
{
  const doc = mkDoc()
  const a = doc.nodes[0]
  // 选择模式：贴右边带 → 箭头；右下角 → 箭头（无手柄，Q1）
  const s1 = decidePointerDown(ctx(doc), a.x + a.w, a.y + a.h / 2, 0, 0)
  assert.equal(s1.kind, 'arrow', '选择模式边带 → 箭头')
  const s2 = decidePointerDown(ctx(doc), a.x + a.w - 1, a.y + a.h - 1, 0, 0)
  assert.equal(s2.kind, 'arrow', '选择模式角区 → 箭头（无手柄）')
  const s3 = decidePointerDown(ctx(doc), a.x + a.w / 2, a.y + a.h / 2, 0, 0)
  assert.equal(s3.kind, 'nodeMove', '选择模式主体 → 移动')
  // 绘制模式：边带 → resize；角 → resize；主体 → 移动
  const d1 = decidePointerDown(ctx(doc, { mode: 'draw' }), a.x + a.w, a.y + a.h / 2, 0, 0)
  assert.equal(d1.kind, 'resize', '绘制模式边带 → resize')
  assert.equal(d1.drag.side, 'r', '右边带')
  const d2 = decidePointerDown(ctx(doc, { mode: 'draw' }), a.x + a.w - 1, a.y + a.h - 1, 0, 0)
  assert.equal(d2.kind, 'resize', '绘制模式角 → resize')
  assert.equal(d2.drag.side, 'br', '右下角')
  const d3 = decidePointerDown(ctx(doc, { mode: 'draw' }), a.x + a.w / 2, a.y + a.h / 2, 0, 0)
  assert.equal(d3.kind, 'nodeMove', '绘制模式主体 → 移动')
}
// 3. 移动页面钳制：不可拖出页面
{
  const doc = mkDoc()
  const a = doc.nodes[0]
  const d = decidePointerDown(ctx(doc), a.x + a.w / 2, a.y + a.h / 2, 0, 0)
  const r = computeMove(ctx(doc, { selectedIds: [a.id] }), d.drag, a.x + 500, a.y + 500)
  const patch = r.patches.find((p) => p.id === a.id)
  assert.ok(patch.x <= 400 - a.w + 0.01 && patch.y <= 300 - a.h + 0.01, '移动被页面钳制')
  assert.ok(patch.x >= 0 && patch.y >= 0, '贴边不越界')
}
// 4. 箭头：同页吸附 + 跨页红叉 + 结算成边 / 取消
{
  const doc = mkDoc()
  const a = doc.nodes[0]
  const b = doc.nodes[1]
  const d = decidePointerDown(ctx(doc), a.x + a.w, a.y + a.h / 2, 0, 0)
  assert.equal(d.kind, 'arrow')
  // 靠近 B 左边缘 → 命中候选
  const g1 = arrowGhost(doc, d.drag, b.x, b.y + b.h / 2, 1)
  assert.ok(g1.target && g1.target.id === b.id, '吸附候选 = B')
  assert.equal(g1.crossPage, false, '同页不跨页')
  assert.ok(g1.fromAnchor.side === 'r', '起点锚点 = 右边缘')
  assert.ok(g1.toAnchor.side === 'l', '终点锚点 = 左边缘')
  // 移出页面 → 跨页取消态
  const g2 = arrowGhost(doc, d.drag, 500, 500, 1)
  assert.equal(g2.crossPage, true, '页面外 → 跨页取消态')
  // 结算：命中目标 → 创建边
  const s1 = settleDrag(ctx(doc), { mode: 'arrow', sourceId: a.id, page: { x: 0, y: 0, w: 400, h: 300 }, ghost: g1 })
  assert.ok(s1.edge && s1.edge.from === a.id && s1.edge.to === b.id, '结算成边')
  assert.equal(s1.edge.pageId, a.pageId, '边归属页面')
  // 结算：跨页 → 取消
  const s2 = settleDrag(ctx(doc), { mode: 'arrow', sourceId: a.id, page: { x: 0, y: 0, w: 400, h: 300 }, ghost: g2 })
  assert.ok(!s2.edge, '跨页取消')
  // 结算：无候选 → 取消
  const g3 = arrowGhost(doc, d.drag, 100, 200, 1)
  const s3 = settleDrag(ctx(doc), { mode: 'arrow', sourceId: a.id, page: { x: 0, y: 0, w: 400, h: 300 }, ghost: g3 })
  assert.ok(!s3.edge, '无候选取消')
}
// 5. 锚点挪动（ANCHOR_DRAG）：选中箭头点住两端圆点 → 沿边挪动（投影归一化）；脱离吸附松开 = 取消连线
{
  const doc = mkDoc()
  const a = doc.nodes[0]
  const b = doc.nodes[1]
  const edge = createEdge(a.pageId, a.id, { side: 'r', t: 0.5 }, b.id, { side: 'l', t: 0.5 }, 'solid')
  doc.edges = [edge]
  const c = ctx(doc, { selectedEdge: edge.id })
  // 按下命中：起点锚点圆点 → anchorDrag
  const w = anchorToWorld(a, edge.fromAnchor)
  const d = decidePointerDown(c, w.x, w.y, 0, 0)
  assert.equal(d.kind, 'anchorDrag', '选中边点住锚点圆点 → anchorDrag')
  assert.equal(d.drag.end, 'from')
  // 投影：挪到右边 75% 处 → side=r、t≈0.75、吸附态
  const g1 = anchorDragGhost(doc, d.drag, a.x + a.w, a.y + a.h * 0.75, 1)
  assert.equal(g1.detach, false, '贴边吸附')
  assert.equal(g1.fromAnchor.side, 'r')
  assert.ok(Math.abs(g1.fromAnchor.t - 0.75) < 0.02, 't 按圆点位置归一化')
  // 跨边挪动：挪到顶边中点 → side=t
  const g2 = anchorDragGhost(doc, d.drag, a.x + a.w / 2, a.y, 1)
  assert.equal(g2.fromAnchor.side, 't', '跨边挪动自动切换 side')
  // 脱离：鼠标离控件边框远 → detach
  const g3 = anchorDragGhost(doc, d.drag, a.x + a.w + 40, a.y + a.h * 0.5, 1)
  assert.equal(g3.detach, true, '脱离吸附')
  // 结算：脱离 → 取消连线（删除箭头）
  const s1 = settleDrag(ctx(doc), { mode: 'anchorDrag', edgeId: edge.id, end: 'from', ghost: g3 })
  assert.equal(s1.edgeRemove, edge.id, '脱离松开 → 取消连线')
  // 结算：吸附 → 按圆点位置更新锚点
  const s2 = settleDrag(ctx(doc), { mode: 'anchorDrag', edgeId: edge.id, end: 'from', ghost: g2 })
  assert.ok(s2.edgePatch && s2.edgePatch.patch.fromAnchor.side === 't', '吸附松开 → 按位置更新锚点')
  // 终点端同语义
  const w2 = anchorToWorld(b, edge.toAnchor)
  const d2 = decidePointerDown(c, w2.x, w2.y, 0, 0)
  assert.equal(d2.kind, 'anchorDrag', '终点锚点圆点同样可拖')
  assert.equal(d2.drag.end, 'to')
  // 未选中箭头时不触发（节点边带仍走 arrow 起笔——锚点手柄不抢占）
  const d3 = decidePointerDown(ctx(doc), w.x, w.y, 0, 0)
  assert.equal(d3.kind, 'arrow', '未选中时不抢占边带语义')
}
// 6. 直/弧判定：对接朝向 → 直线；其余 → 弧线
{
  const doc = mkDoc()
  const a = doc.nodes[0]
  const b = doc.nodes[1]
  const s1 = edgeKindOf(a, { side: 'r', t: 0.5 }, b, { side: 'l', t: 0.5 })
  assert.equal(s1, 'straight', '右→左对接 → 直线')
  const s2 = edgeKindOf(a, { side: 'b', t: 0.5 }, b, { side: 'l', t: 0.5 })
  assert.equal(s2, 'curve', '下→左 → 弧线')
  const g = edgeGeom(a, { side: 'r', t: 0.5 }, b, { side: 't', t: 0.5 })
  assert.ok(g.d.startsWith('M') && (g.d.includes('L') || g.d.includes('C')), '几何输出')
}
// 6. 锚点归一化往返
{
  const doc = mkDoc()
  const a = doc.nodes[0]
  const w = anchorToWorld(a, { side: 'r', t: 0.5 })
  assert.ok(Math.abs(w.x - (a.x + a.w)) < 0.01, '右边缘中点')
  const a2 = anchorFromPoint(a, a.x + a.w, a.y + a.h * 0.25)
  assert.equal(a2.side, 'r')
  assert.ok(Math.abs(a2.t - 0.25) < 0.01, 't 归一化')
}
// 7. 框选：完全包含结算；箭头两端点均在框内才入选
{
  const doc = mkDoc()
  const a = doc.nodes[0]
  const b = doc.nodes[1]
  const e = createEdge(a.pageId, a.id, { side: 'r', t: 0.5 }, b.id, { side: 'l', t: 0.5 }, 'solid')
  doc.edges = [e]
  const d = { mode: 'marquee', sx: 0, sy: 0, mq: { x: 0, y: 0, w: 400, h: 300 } }
  const r = settleDrag(ctx(doc), d)
  assert.equal(r.selection.length, 2, '完全包含两节点')
  assert.equal(r.selEdge, e.id, '两端点在框内 → 箭头入选')
}
// 8. 批量：组边改宽高 / 右下角等比
{
  const doc = mkDoc()
  const ids = doc.nodes.map((n) => n.id)
  const gb = groupBounds(doc.nodes, ids)
  const drag = { mode: 'groupEdgeResize', sx: 0, sy: 0, gb, side: 'r', lastDx: 0, lastDy: 0 }
  const r = updateDrag(ctx(doc, { selectedIds: ids }), drag, gb.x + gb.w + 20, gb.y + gb.h / 2, 0, 0)
  assert.ok(r.patches.every((p) => p.w > 0), '组边批量宽高 patch')
  const drag2 = { mode: 'groupCornerResize', sx: 0, sy: 0, gb }
  const r2 = updateDrag(ctx(doc, { selectedIds: ids }), drag2, gb.x + gb.w * 2, gb.y + gb.h * 2, 0, 0)
  assert.ok(r2.patches.every((p) => p.w > 0 && p.h > 0 && p.x >= gb.x), '组角等比 patch（锚定左上）')
}
// 9. id 唯一性（reserveSeqs / nextId）
{
  const doc = mkDoc()
  const ids = doc.nodes.map((n) => n.id)
  assert.equal(new Set(ids).size, ids.length, 'id 全局唯一')
}
// 10. 页面宽高调整（Q1：仅绘制模式——Alt/徽标绘制态贴边=调宽高、右下角=resize；选择模式不拦截）
{
  const doc = mkDoc()
  const p = doc.pages[0]
  // 页面标题条：选择模式点击 → 页面选中（selPage），可迁移 Backspace 删除页面
  const pd = decidePointerDown(ctx(doc), p.x + 10, p.y + 10, 0, 0)
  assert.equal(pd.kind, 'pageMove', '标题条 → pageMove')
  assert.equal(pd.selPage, p.id, '标题条按下选中页面（Backspace 可删除）')
  const d1 = decidePointerDown(ctx(doc, { mode: 'draw' }), p.x + p.w, p.y + p.h / 2, 0, 0)
  assert.equal(d1.kind, 'pageResize', '绘制模式页面右边带 → pageResize')
  assert.equal(d1.drag.side, 'r')
  const r1 = updateDrag(ctx(doc, { mode: 'draw' }), d1.drag, p.x + p.w + 40, p.y + p.h / 2, 0, 0)
  assert.equal(r1.patch.w, 440, '右边拖动 → 宽度 +40')
  const d2 = decidePointerDown(ctx(doc, { mode: 'draw' }), p.x + p.w - 1, p.y + p.h - 1, 0, 0)
  assert.equal(d2.kind, 'pageResize', '右下角 → pageResize')
  assert.equal(d2.drag.side, 'br')
  const r2 = updateDrag(ctx(doc, { mode: 'draw' }), d2.drag, p.x + p.w - 500, p.y + p.h - 500, 0, 0)
  assert.ok(r2.patch.w >= 200 && r2.patch.h >= 120, '最小尺寸钳制（200×120）')
  const d3 = decidePointerDown(ctx(doc), p.x + p.w, p.y + p.h / 2, 0, 0)
  assert.equal(d3.kind, 'marquee', '选择模式页面边带 → 框选（不拦截）')
  const s = settleDrag(ctx(doc), d1.drag)
  assert.equal(s.commit, true, '结算正常')
}
// 11. hover 光标（绘制模式操作区 → 方向可拖拽；空白 → 兜底）；选中箭头锚点 → grab
{
  const doc = mkDoc()
  const a = doc.nodes[0]
  const p = doc.pages[0]
  assert.equal(hoverCursorFor(ctx(doc, { mode: 'draw' }), a.x + a.w, a.y + a.h / 2), 'ew-resize', '右边缘 → ew-resize')
  assert.equal(hoverCursorFor(ctx(doc, { mode: 'draw' }), a.x + a.w / 2, a.y), 'ns-resize', '上边缘 → ns-resize')
  assert.equal(hoverCursorFor(ctx(doc, { mode: 'draw' }), a.x + a.w - 1, a.y + a.h - 1), 'nwse-resize', '右下角 → nwse-resize')
  assert.equal(hoverCursorFor(ctx(doc, { mode: 'draw' }), p.x + p.w - 1, p.y + p.h - 1), 'nwse-resize', '页面右下角 → nwse-resize')
  assert.equal(hoverCursorFor(ctx(doc, { mode: 'draw' }), p.x + p.w, p.y + p.h / 2), 'ew-resize', '页面右边带 → ew-resize')
  assert.equal(hoverCursorFor(ctx(doc, { mode: 'draw' }), 100, 100), '', '页面空白 → 兜底（crosshair）')
  // 选择模式：节点边带 = 连线起笔（crosshair + 起点圆点预览）；页面空白 → default
  assert.equal(hoverCursorFor(ctx(doc), a.x + a.w, a.y + a.h / 2), 'crosshair', '选择模式边带 → crosshair（连线起笔）')
  assert.equal(hoverCursorFor(ctx(doc), 100, 100), '', '选择模式空白 → 兜底（default）')
  // 连线起点 hover 圆点：贴近边带返回锚点（side/t 投影），远离返回 null
  const h1 = hoverAnchorFor(doc, a.x + a.w, a.y + a.h * 0.7, 1)
  assert.ok(h1 && h1.node.id === a.id, 'hover 贴近右边带 → 起点锚点')
  assert.ok(Math.abs(h1.anchor.t - 0.7) < 0.02, '圆点位置按鼠标投影')
  assert.equal(hoverAnchorFor(doc, a.x + a.w / 2, a.y + a.h / 2, 1), null, '节点主体无连线提示')
  // 选中箭头：锚点圆点 → grab
  const edge = createEdge(a.pageId, a.id, { side: 'r', t: 0.5 }, doc.nodes[1].id, { side: 'l', t: 0.5 }, 'solid')
  doc.edges = [edge]
  const w = anchorToWorld(a, edge.fromAnchor)
  assert.equal(hoverCursorFor(ctx(doc, { selectedEdge: edge.id }), w.x, w.y), 'grab', '锚点圆点 → grab')
}
// 12. 四角 resize（控件与页面）：四角命中 / 锚定对角自由缩放 / 对角光标 nesw/nwse
{
  const doc = mkDoc()
  const a = doc.nodes[0]
  const p = doc.pages[0]
  // 命中：四角在绘制模式都进入 resize
  const t1 = decidePointerDown(ctx(doc, { mode: 'draw' }), a.x + 1, a.y + 1, 0, 0)
  assert.equal(t1.kind, 'resize', '左上角 → resize')
  assert.equal(t1.drag.side, 'tl', '左上角 side=tl')
  const t2 = decidePointerDown(ctx(doc, { mode: 'draw' }), a.x + a.w - 1, a.y + 1, 0, 0)
  assert.equal(t2.drag.side, 'tr', '右上角 side=tr')
  const t3 = decidePointerDown(ctx(doc, { mode: 'draw' }), a.x + 1, a.y + a.h - 1, 0, 0)
  assert.equal(t3.drag.side, 'bl', '左下角 side=bl')
  // 计算：tl 拖动 → 锚定右下（nx/ny 随动，w/h 增减）
  const dragTl = { mode: 'resize', id: a.id, sx: a.x, sy: a.y, ox: a.x, oy: a.y, ow: a.w, oh: a.h, side: 'tl' }
  const r1 = updateDrag(ctx(doc, { mode: 'draw' }), dragTl, a.x - 20, a.y - 10, 0, 0)
  assert.equal(r1.patch.w, a.w + 20, 'tl → 宽 +20')
  assert.equal(r1.patch.h, a.h + 10, 'tl → 高 +10')
  assert.equal(r1.patch.x, a.x - 20, 'tl → x 随动（锚定右下）')
  assert.equal(r1.patch.y, a.y - 10, 'tl → y 随动')
  // tr：以真实按下点（右上角附近）为拖动起点
  const r2 = updateDrag(ctx(doc, { mode: 'draw' }), t2.drag, a.x + a.w + 20, a.y - 10, 0, 0)
  assert.equal(r2.patch.w, a.w + (20 + 1), 'tr → 宽随动（锚定左边缘）')
  assert.equal(r2.patch.y, a.y - (10 + 1), 'tr → y 随动（锚定下边缘）')
  // 页面四角
  const p1 = decidePointerDown(ctx(doc, { mode: 'draw' }), p.x + p.w - 1, p.y + 1, 0, 0)
  assert.equal(p1.kind, 'pageResize', '页面右上角 → pageResize')
  assert.equal(p1.drag.side, 'tr', '页面右上角 side=tr')
  const rp = updateDrag(ctx(doc, { mode: 'draw' }), p1.drag, p.x + p.w + 30, p.y - 20, 0, 0)
  assert.equal(rp.patch.w, p.w + (30 + 1), '页面 tr → 宽随动')
  assert.equal(rp.patch.h, p.h + (20 + 1), '页面 tr → 高随动')
  // 光标：对角映射
  assert.equal(hoverCursorFor(ctx(doc, { mode: 'draw' }), a.x + a.w - 1, a.y + 1), 'nesw-resize', '右上角 → nesw-resize')
  assert.equal(hoverCursorFor(ctx(doc, { mode: 'draw' }), a.x + 1, a.y + a.h - 1), 'nesw-resize', '左下角 → nesw-resize')
  assert.equal(hoverCursorFor(ctx(doc, { mode: 'draw' }), a.x + 1, a.y + 1), 'nwse-resize', '左上角 → nwse-resize')
}

console.log('✅ verify-interactions: 全部断言通过（模式即语义/箭头/锚点/四角resize/hover光标等）')
