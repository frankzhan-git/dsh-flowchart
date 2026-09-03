// dsh-flowchart core/geometry.js
// 职责：相机（toLocal/zoomAt/computePan）、命中（handleMetrics/hitEdgeOf/hitPriority/hitPageChip）、
//       锚点换算（anchorFromPoint/anchorToWorld）、箭头几何（edgeKindOf/edgeGeom/edgeHitDistance）、
//       包围盒/框选/吸附（groupBounds/containsNode/pickNodes）。全部纯函数，零 React/DSH。
import { CANVAS_W, CANVAS_H } from './model.js'
import { sortForRender, isGroup } from './grouping.js'

// ---------- 相机（无限画布：SVG 固定视口，viewBox 随 zoom/pan 变化） ----------

export function toLocal(ev, rect, zoom, pan) {
  const vw = CANVAS_W / zoom
  const vh = CANVAS_H / zoom
  const scale = Math.min(rect.width / vw, rect.height / vh)
  const ox = (rect.width - vw * scale) / 2
  const oy = (rect.height - vh * scale) / 2
  return {
    x: pan.x + (ev.clientX - rect.left - ox) / scale,
    y: pan.y + (ev.clientY - rect.top - oy) / scale,
  }
}

export function localToScreen(x, y, rect, zoom, pan) {
  const vw = CANVAS_W / zoom
  const vh = CANVAS_H / zoom
  const scale = Math.min(rect.width / vw, rect.height / vh)
  const ox = (rect.width - vw * scale) / 2
  const oy = (rect.height - vh * scale) / 2
  return { x: rect.left + ox + (x - pan.x) * scale, y: rect.top + oy + (y - pan.y) * scale }
}

export const ZOOM_MIN = 0.25
export const ZOOM_MAX = 3

// 中心锚点缩放（视口中心不变）
export function zoomAt(factor, zoom, pan) {
  const nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(zoom * factor).toFixed(3)))
  const cx = pan.x + CANVAS_W / zoom / 2
  const cy = pan.y + CANVAS_H / zoom / 2
  return { zoom: nz, pan: { x: cx - CANVAS_W / nz / 2, y: cy - CANVAS_H / nz / 2 } }
}

// 平移画布（屏幕→逻辑比例换算，方向取反：内容跟随鼠标）
export function computePan(drag, clientX, clientY, rect, zoom) {
  const scale = Math.min(rect.width / (CANVAS_W / zoom), rect.height / (CANVAS_H / zoom))
  return {
    x: drag.px - (clientX - drag.sx) / scale,
    y: drag.py - (clientY - drag.sy) / scale,
  }
}

// ---------- 命中（Q1 模式即语义：命中只返回区域，语义由 interactions 按模式裁定） ----------

// 手柄阈值自适应（小节点安全区）：边带 th、右下角内区 cin、外扩 cout
export function handleMetrics(el, zoom) {
  const m = Math.min(el.w, el.h)
  return {
    th: Math.max(2 / zoom, Math.min(8 / zoom, m / 4)),
    cin: Math.max(5 / zoom, Math.min(14 / zoom, m / 3)),
    cout: 8 / zoom,
  }
}

// 四边命中（端头缩进 th 让出角区）
export function hitEdgeOf(el, x, y, zoom) {
  const th = handleMetrics(el, zoom).th
  const inX = x > el.x + th && x < el.x + el.w - th
  const inY = y > el.y + th && y < el.y + el.h - th
  const onRight = Math.abs(x - (el.x + el.w)) <= th && inY
  const onLeft = Math.abs(x - el.x) <= th && inY
  const onBottom = Math.abs(y - (el.y + el.h)) <= th && inX
  const onTop = Math.abs(y - el.y) <= th && inX
  if (onRight) return 'r'
  if (onLeft) return 'l'
  if (onBottom) return 'b'
  if (onTop) return 't'
  return null
}

// 四角命中（内 cin × 外 cout，多角重叠时取距角点最近者）：'tl'|'tr'|'bl'|'br' | null
export function hitCornerOf(el, x, y, zoom) {
  const m = handleMetrics(el, zoom)
  const corners = [
    { side: 'tl', x: el.x, y: el.y },
    { side: 'tr', x: el.x + el.w, y: el.y },
    { side: 'bl', x: el.x, y: el.y + el.h },
    { side: 'br', x: el.x + el.w, y: el.y + el.h },
  ]
  let best = null
  let bestD = Infinity
  for (const c of corners) {
    const inBox = x >= c.x - m.cout && x <= c.x + m.cin && y >= c.y - m.cout && y <= c.y + m.cin
    if (!inBox) continue
    const d = Math.hypot(x - c.x, y - c.y)
    if (d < bestD) { bestD = d; best = c.side }
  }
  return best
}

// 统一命中（自顶向下，与渲染排序 sortForRender 一致——组合先画（底层）、成员后画（上层）：
//   最后画的先命中，所以组成员优先于组合矩形、外层普通节点优先于组合）：
//   命中分层（0.2.8 修复：组合矩形内部不再遮挡成员箭头）：
//   1) 节点表面（角手柄/边带——含组自身边界；A1：面优先于箭头）
//   2) 非组节点内部（普通形状仍优先于其下箭头——A1）
//   3) 箭头（路径 8/zoom 内或标签矩形内——组合内部/标签视觉区均可点中）
//   4) 组内部（容器空白区：最后兜底——只用于选中/移动组本身，不遮挡成员与箭头）
//   5) 页面标题条 / 页面边带四角
export function hitPriority(doc, x, y, zoom) {
  const nodes = doc.nodes || []
  const edges = doc.edges || []
  const ordered = sortForRender(nodes)
  // 1) 节点表面（最后画的先命中）：内部 / 边带 / 右下角
  for (let i = ordered.length - 1; i >= 0; i--) {
    const n = ordered[i]
    const corner = hitCornerOf(n, x, y, zoom)
    if (corner) return { kind: 'node', node: n, mode: 'corner', side: corner }
    const edge = hitEdgeOf(n, x, y, zoom)
    if (edge) return { kind: 'node', node: n, mode: 'edge', side: edge }
  }
  // 2) 非组节点内部（成员绘制在组上方；普通形状优先于其下箭头——A1）
  for (let i = ordered.length - 1; i >= 0; i--) {
    const n = ordered[i]
    if (isGroup(n)) continue
    if (x >= n.x && x <= n.x + n.w && y >= n.y && y <= n.y + n.h) {
      return { kind: 'node', node: n, mode: 'inside' }
    }
  }
  // 3) 箭头命中（路径临近或标签矩形内）
  for (let i = edges.length - 1; i >= 0; i--) {
    const e = edges[i]
    const a = nodeById(doc, e.from)
    const b = nodeById(doc, e.to)
    const fa = e.fromAnchor || { side: 'r', t: 0.5 }
    const ta = e.toAnchor || { side: 'l', t: 0.5 }
    if (!a || !b) continue
    if (edgeHitDistance(a, fa, b, ta, x, y) <= 8 / zoom) return { kind: 'edge', edge: e }
    if (typeof e.label === 'string' && e.label.length) {
      const lg = edgeLabelRect(edgeGeom(a, fa, b, ta), e.label)
      if (lg && x >= lg.x && x <= lg.x + lg.w && y >= lg.y && y <= lg.y + lg.h) {
        return { kind: 'edge', edge: e }
      }
    }
  }
  // 4) 组内部（容器空白区兜底：点中组主体 = 选中/移动组）
  for (let i = ordered.length - 1; i >= 0; i--) {
    const n = ordered[i]
    if (!isGroup(n)) continue
    if (x >= n.x && x <= n.x + n.w && y >= n.y && y <= n.y + n.h) {
      return { kind: 'node', node: n, mode: 'inside' }
    }
  }
  // 5) 页面标题条（画在最上层，方便找到页面）
  for (let i = (doc.pages || []).length - 1; i >= 0; i--) {
    const p = doc.pages[i]
    const c = pageChip(p)
    if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) {
      return { kind: 'pageTitle', page: p }
    }
  }
  // 页面边带/四角（绘制模式调页面宽高用；页面在底层，节点/箭头/标题条优先）
  for (let i = (doc.pages || []).length - 1; i >= 0; i--) {
    const p = doc.pages[i]
    const corner = hitCornerOf(p, x, y, zoom)
    if (corner) return { kind: 'pageCorner', page: p, side: corner }
    const pe = pageEdgeOf(p, x, y, zoom)
    if (pe) return { kind: 'pageEdge', page: p, side: pe }
  }
  return null
}

// 组内部命中（仅组合的 inside——绘制模式箭头命中后的兜底语义：保持「组内空白 = 组移动」）
export function hitGroupInside(doc, x, y, zoom) {
  const nodes = doc.nodes || []
  const ordered = sortForRender(nodes)
  for (let i = ordered.length - 1; i >= 0; i--) {
    const n = ordered[i]
    if (!isGroup(n)) continue
    if (x >= n.x && x <= n.x + n.w && y >= n.y && y <= n.y + n.h) {
      return { kind: 'node', node: n, mode: 'inside' }
    }
  }
  return null
}

// 页面四边命中（±th 跨内/外侧带，端头缩进 th 让出角区；页面在底层）
export function pageEdgeOf(page, x, y, zoom) {
  const th = handleMetrics({ w: page.w, h: page.h }, zoom).th
  const inX = x > page.x + th && x < page.x + page.w - th
  const inY = y > page.y + th && y < page.y + page.h - th
  const onRight = Math.abs(x - (page.x + page.w)) <= th && inY
  const onLeft = Math.abs(x - page.x) <= th && inY
  const onBottom = Math.abs(y - (page.y + page.h)) <= th && inX
  const onTop = Math.abs(y - page.y) <= th && inX
  if (onRight) return 'r'
  if (onLeft) return 'l'
  if (onBottom) return 'b'
  if (onTop) return 't'
  return null
}

// 页面标题条命中区（页内左上角）
export function pageChip(page) {
  return { x: page.x + 4, y: page.y + 4, w: 120, h: 18 }
}

export function nodeById(doc, id) {
  return (doc.nodes || []).find((n) => n.id === id) || null
}

// ---------- 锚点（Q1/E1：{side, t} 归一化；节点移动/缩放时端点随边滑动） ----------

// 将画布点投影到节点边框上：取最近边 + 归一化位置 t
export function anchorFromPoint(node, x, y) {
  const cx = node.x + node.w / 2
  const cy = node.y + node.h / 2
  const candidates = [
    { side: 'l', d: Math.abs(x - node.x), px: node.x, py: clamp(y, node.y, node.y + node.h) },
    { side: 'r', d: Math.abs(x - (node.x + node.w)), px: node.x + node.w, py: clamp(y, node.y, node.y + node.h) },
    { side: 't', d: Math.abs(y - node.y), py: node.y, px: clamp(x, node.x, node.x + node.w) },
    { side: 'b', d: Math.abs(y - (node.y + node.h)), py: node.y + node.h, px: clamp(x, node.x, node.x + node.w) },
  ]
  // 边 t 归一化：l/r 沿 y 方向；t/b 沿 x 方向
  for (const c of candidates) {
    c.t = c.side === 'l' || c.side === 'r'
      ? (c.py - node.y) / Math.max(1, node.h)
      : (c.px - node.x) / Math.max(1, node.w)
  }
  let best = candidates[0]
  for (const c of candidates) if (c.d < best.d) best = c
  return { side: best.side, t: clamp(best.t, 0, 1) }
}

export function anchorToWorld(node, a) {
  const t = clamp((a && a.t) != null ? a.t : 0.5, 0, 1)
  const side = a ? a.side : 'r'
  if (side === 'l') return { x: node.x, y: node.y + node.h * t }
  if (side === 'r') return { x: node.x + node.w, y: node.y + node.h * t }
  if (side === 't') return { x: node.x + node.w * t, y: node.y }
  return { x: node.x + node.w * t, y: node.y + node.h }
}

// ---------- 箭头几何（Q2 规则） ----------

// 直/弧判定：起终点边「对接」（r↔l / b↔t）且锚点连线段主要沿该轴 → 直线；其余弧线
export function edgeKindOf(fromNode, fromAnchor, toNode, toAnchor) {
  const p0 = anchorToWorld(fromNode, fromAnchor)
  const p1 = anchorToWorld(toNode, toAnchor)
  const dx = p1.x - p0.x
  const dy = p1.y - p0.y
  const fs = fromAnchor ? fromAnchor.side : 'r'
  const ts = toAnchor ? toAnchor.side : 'l'
  const facingX = (fs === 'r' && ts === 'l') || (fs === 'l' && ts === 'r')
  const facingY = (fs === 'b' && ts === 't') || (fs === 't' && ts === 'b')
  if (facingX && Math.abs(dx) >= Math.abs(dy)) return 'straight'
  if (facingY && Math.abs(dy) >= Math.abs(dx)) return 'straight'
  return 'curve'
}

// 几何：{ kind, d, mid }；弧线 = cubic bezier（控制点沿锚点法向偏移 max(24, 0.35×距离)）
export function edgeGeom(fromNode, fromAnchor, toNode, toAnchor) {
  const p0 = anchorToWorld(fromNode, fromAnchor)
  const p1 = anchorToWorld(toNode, toAnchor)
  const kind = edgeKindOf(fromNode, fromAnchor, toNode, toAnchor)
  if (kind === 'straight') {
    return { kind, d: 'M' + f(p0.x) + ' ' + f(p0.y) + ' L' + f(p1.x) + ' ' + f(p1.y), mid: { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 } }
  }
  const dist = Math.max(24, 0.35 * Math.hypot(p1.x - p0.x, p1.y - p0.y))
  const n0 = sideNormal(fromAnchor ? fromAnchor.side : 'r')
  const n1 = sideNormal(toAnchor ? toAnchor.side : 'l')
  const c1 = { x: p0.x + n0.x * dist, y: p0.y + n0.y * dist }
  const c2 = { x: p1.x + n1.x * dist, y: p1.y + n1.y * dist }
  const d = 'M' + f(p0.x) + ' ' + f(p0.y)
    + ' C' + f(c1.x) + ' ' + f(c1.y) + ' ' + f(c2.x) + ' ' + f(c2.y)
    + ' ' + f(p1.x) + ' ' + f(p1.y)
  // bezier 中点（t=0.5 三阶）
  const mid = {
    x: (p0.x + 3 * c1.x + 3 * c2.x + p1.x) / 8,
    y: (p0.y + 3 * c1.y + 3 * c2.y + p1.y) / 8,
  }
  return { kind, d, mid }
}

// 箭头标签背景矩形（视觉带 = 命中带：渲染与命中共用单一计算，避免「点中标签却落空」）
export function edgeLabelRect(g, label) {
  if (!label || typeof label !== 'string' || !label.length || !g || !g.mid) return null
  const w = label.length * 6.4 + 10
  return { x: g.mid.x - w / 2, y: g.mid.y - 10, w, h: 20 }
}

function sideNormal(side) {
  if (side === 'r') return { x: 1, y: 0 }
  if (side === 'l') return { x: -1, y: 0 }
  if (side === 'b') return { x: 0, y: 1 }
  return { x: 0, y: -1 }
}

// 点到箭头路径距离（直线 = 段距离；弧线 = 贝塞尔 16 采样最小距离）
export function edgeHitDistance(fromNode, fromAnchor, toNode, toAnchor, x, y) {
  const g = edgeGeom(fromNode, fromAnchor, toNode, toAnchor)
  if (g.kind === 'straight') {
    const p0 = anchorToWorld(fromNode, fromAnchor)
    const p1 = anchorToWorld(toNode, toAnchor)
    return segDist(p0.x, p0.y, p1.x, p1.y, x, y)
  }
  const pts = bezierPoints(fromNode, fromAnchor, toNode, toAnchor, 16)
  let best = Infinity
  for (const p of pts) {
    const d = Math.hypot(p.x - x, p.y - y)
    if (d < best) best = d
  }
  return best
}

// 弧线采样（16 点；边缘命中测试与拖动预览共用）
export function bezierPoints(fromNode, fromAnchor, toNode, toAnchor, n) {
  const p0 = anchorToWorld(fromNode, fromAnchor)
  const p1 = anchorToWorld(toNode, toAnchor)
  const dist = Math.max(24, 0.35 * Math.hypot(p1.x - p0.x, p1.y - p0.y))
  const n0 = sideNormal(fromAnchor ? fromAnchor.side : 'r')
  const n1 = sideNormal(toAnchor ? toAnchor.side : 'l')
  const c1 = { x: p0.x + n0.x * dist, y: p0.y + n0.y * dist }
  const c2 = { x: p1.x + n1.x * dist, y: p1.y + n1.y * dist }
  const out = []
  const steps = n || 16
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const mt = 1 - t
    out.push({
      x: mt * mt * mt * p0.x + 3 * mt * mt * t * c1.x + 3 * mt * t * t * c2.x + t * t * t * p1.x,
      y: mt * mt * mt * p0.y + 3 * mt * mt * t * c1.y + 3 * mt * t * t * c2.y + t * t * t * p1.y,
    })
  }
  return out
}

// ---------- 通用几何 ----------

export function groupBounds(nodes, ids) {
  const set = new Set(ids)
  const list = nodes.filter((n) => set.has(n.id))
  if (!list.length) return null
  const minX = Math.min(...list.map((n) => n.x))
  const minY = Math.min(...list.map((n) => n.y))
  const maxX = Math.max(...list.map((n) => n.x + n.w))
  const maxY = Math.max(...list.map((n) => n.y + n.h))
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

// 多选外框边带命中（组批量改宽高）：框线内侧 inside + 外侧 handle
export function hitGroupEdge(gb, x, y, handle, inside) {
  const inY = y >= gb.y && y <= gb.y + gb.h
  const inX = x >= gb.x && x <= gb.x + gb.w
  const nearR = x >= gb.x + gb.w - inside && x <= gb.x + gb.w + handle && inY
  const nearB = y >= gb.y + gb.h - inside && y <= gb.y + gb.h + handle && inX
  const nearL = x >= gb.x - handle && x <= gb.x + inside && inY
  const nearT = y >= gb.y - handle && y <= gb.y + inside && inX
  if (nearR) return 'r'
  if (nearB) return 'b'
  if (nearL) return 'l'
  if (nearT) return 't'
  return null
}

export function clamp(v, min, max) { return v < min ? min : (v > max ? max : v) }

function f(n) { return Math.round(n * 100) / 100 }

function segDist(x1, y1, x2, y2, px, py) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  let t = len2 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0
  t = clamp(t, 0, 1)
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}
