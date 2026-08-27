// dsh-flowchart core/interactions.js —— 交互状态机（P3 纯函数：decide → compute → settle）
// 边界：零 React/DSH/localStorage；副作用经 commands 由 hooks 执行
// Q1 模式即语义：选择模式 边带=箭头(无手柄)；绘制模式 边带=调宽高、角=resize
// 导出：decidePointerDown / updateDrag / settleDrag / arrowGhost / hoverCursorFor / 常量
import { createNode, createPage, createEdge, MAX_ELEMENTS, PAGE_MIN } from './model.js'
import {
  toLocal, zoomAt, computePan, handleMetrics, hitEdgeOf, hitPriority,
  anchorFromPoint, anchorToWorld, edgeKindOf, groupBounds, hitGroupEdge,
  clamp, nodeById, pageChip,
} from './geometry.js'
import { shapeOf } from './shapes.js'
import {
  isGroup, descendantIds, subtreeBounds, rectsOverlap, coveredByRect,
  normalizeMove, buildGroupNode,
} from './grouping.js'

export { toLocal, zoomAt, computePan }
export const SNAP_TOL = 6
export const ARROW_SNAP = 10
export const PAGE_GAP = 16
export const MIN_CREATE = 4

// ---------- pointer.down 决策 ----------
// ctx = { doc, mode, zoom, selectedIds, spaceDown, pan }
export function decidePointerDown(ctx, x, y, clientX, clientY) {
  const { doc, mode, zoom, selectedIds } = ctx
  if (ctx.spaceDown) {
    return { kind: 'pan', drag: { mode: 'pan', sx: clientX, sy: clientY, px: ctx.pan.x, py: ctx.pan.y } }
  }
  // 多选组：外框边带 = 批量改宽高；右下角 = 批量等比缩放（先于元素命中；两种模式语义一致——
  // 绘制模式下若仍走单控件命中，批量选框的边带/角会落在其上某个控件上，出现「只有其中一个跟随」）
  if (selectedIds.length > 1) {
    const gb = groupBounds(doc.nodes, selectedIds)
    if (gb) {
      const handle = 10 / zoom
      const gSide = hitGroupEdge(gb, x, y, handle, 4 / zoom)
      if (gSide) {
        // 批量 resize：成员起点快照（每帧绝对重算，防增量累积漂移/NaN）
        return { kind: 'groupEdgeResize', drag: { mode: 'groupEdgeResize', side: gSide, sx: x, sy: y, gb, members: memberSnapshot(doc, selectedIds) } }
      }
      const csz = 12 / zoom
      if (x >= gb.x + gb.w - csz && x <= gb.x + gb.w + csz && y >= gb.y + gb.h - csz && y <= gb.y + gb.h + csz) {
        // 批量等比：成员起点快照（每帧绝对重算，防增量累积漂移）
        return { kind: 'groupCornerResize', drag: { mode: 'groupCornerResize', sx: x, sy: y, gb, members: memberSnapshot(doc, selectedIds) } }
      }
      // 组内任意位置：
      if (x >= gb.x && x <= gb.x + gb.w && y >= gb.y && y <= gb.y + gb.h) {
        const loc = hitPriority(doc, x, y, zoom)
        // 绘制模式：内部控件自身的边带/角 = 单控件 resize（外框带已优先批量语义，内部不劫持）
        if (mode === 'draw' && loc && loc.kind === 'node' && (loc.mode === 'edge' || loc.mode === 'corner')) {
          const n = loc.node
          const page = pageOf(doc, n)
          // 组合 resize：成员起点快照（每帧从起点重算，防止比例乘法累积漂移）
          const members = isGroup(n)
            ? descendantIds(doc, n.id).map((id) => {
                const m = nodeById(doc, id)
                return m ? { id, x: m.x, y: m.y, w: m.w, h: m.h } : null
              }).filter(Boolean)
            : null
          return {
            kind: 'resize',
            drag: { mode: 'resize', id: n.id, sx: x, sy: y, ox: n.x, oy: n.y, ow: n.w, oh: n.h, side: loc.side, page, members },
          }
        }
        // 绘制模式：未选中控件主体 = 单选 + 移动（不劫持为组移动）
        if (mode === 'draw' && loc && loc.kind === 'node' && loc.mode === 'inside' && selectedIds.indexOf(loc.node.id) === -1) {
          const n = loc.node
          const page = pageOf(doc, n)
          return {
            kind: 'nodeMove',
            drag: { mode: 'nodeMove', id: n.id, sx: x, sy: y, ox: n.x, oy: n.y, page, multi: false, ownerGroup: groupOwnerOf(doc, n.id) },
            sel: [n.id],
          }
        }
        // 其余（选择模式组内任意位置；绘制模式选中主体/空白）→ 组移动
        // （锚点 = 命中选中元素；空白取选中集最后一个）
        const anchor = loc && loc.kind === 'node' && selectedIds.indexOf(loc.node.id) !== -1
          ? loc.node
          : doc.nodes.find((n) => n.id === selectedIds[selectedIds.length - 1])
        if (anchor) {
          const page = pageOf(doc, anchor)
          return {
            kind: 'nodeMove',
            drag: { mode: 'nodeMove', id: anchor.id, sx: x, sy: y, ox: anchor.x, oy: anchor.y, page, multi: true, ownerGroup: groupOwnerOf(doc, anchor.id) },
          }
        }
      }
    }
  }
  // 锚点手柄（选中箭头的首/尾圆点）：最高优先级——贴节点边带的锚点区优先于
  // 「节点边带=箭头起笔」（否则无法按住圆点调整锚点）
  if (mode === 'select' && ctx.selectedEdge) {
    const selEdge = (doc.edges || []).find((e) => e.id === ctx.selectedEdge)
    if (selEdge) {
      const probes = [
        { end: 'from', node: nodeById(doc, selEdge.from), anchor: selEdge.fromAnchor },
        { end: 'to', node: nodeById(doc, selEdge.to), anchor: selEdge.toAnchor },
      ]
      for (const p of probes) {
        if (!p.node || !p.anchor) continue
        const wpt = anchorToWorld(p.node, p.anchor)
        if (Math.hypot(x - wpt.x, y - wpt.y) <= 9 / zoom) {
          return {
            kind: 'anchorDrag',
            drag: { mode: 'anchorDrag', edgeId: selEdge.id, end: p.end, nodeId: p.node.id, sx: x, sy: y },
          }
        }
      }
    }
  }
  const loc = hitPriority(doc, x, y, zoom)
  if (loc && loc.kind === 'pageTitle') {
    // 页面标题条：拖动页面（选择模式）；同时选中页面（Backspace/Delete 可删除页面）
    const p = loc.page
    const kids = doc.nodes.filter((n) => n.pageId === p.id).map((n) => n.id)
    return {
      kind: 'pageMove',
      drag: { mode: 'pageMove', id: p.id, sx: x, sy: y, ox: p.x, oy: p.y, kids },
      selPage: p.id,
    }
  }
  if (loc && loc.kind === 'edge') {
    // 箭头命中：选择模式选中箭头（可删/编辑标签）；绘制模式忽略（节点优先）
    if (mode === 'select') {
      if (ctx.ctrl) return { kind: 'selectEdge', ids: ctx.selectedEdge === loc.edge.id ? null : [loc.edge.id] }
      return { kind: 'selectEdge', ids: [loc.edge.id] }
    }
  }
  // 页面宽高调整（Q1 同节点语义，仅绘制模式）：贴边 = 改宽高；右下角 = resize；
  // 选择模式下忽略（落回框选/空白语义）
  if (loc && (loc.kind === 'pageEdge' || loc.kind === 'pageCorner')) {
    if (mode === 'draw') {
      const page = loc.page
      return {
        kind: 'pageResize',
        drag: {
          mode: 'pageResize', id: page.id, sx: x, sy: y,
          ox: page.x, oy: page.y, ow: page.w, oh: page.h,
          side: loc.side,
        },
      }
    }
  }
  if (loc && loc.kind === 'node') {
    const n = loc.node
    if (mode === 'draw') {
      // 绘制模式：贴边 = 调宽高；角 = resize（Q1）；主体 = 选中 + 移动
      if (loc.mode === 'edge' || loc.mode === 'corner') {
        const page = pageOf(doc, n)
        // 组合 resize：成员起点快照（每帧从起点重算，防止比例乘法累积漂移）
        const members = isGroup(n)
          ? descendantIds(doc, n.id).map((id) => {
              const m = nodeById(doc, id)
              return m ? { id, x: m.x, y: m.y, w: m.w, h: m.h } : null
            }).filter(Boolean)
          : null
        return {
          kind: 'resize',
          drag: { mode: 'resize', id: n.id, sx: x, sy: y, ox: n.x, oy: n.y, ow: n.w, oh: n.h, side: loc.side, page, members },
        }
      }
      const keepMulti = selectedIds.indexOf(n.id) !== -1 && selectedIds.length > 1
      const selIds = keepMulti ? selectedIds : [n.id]
      const page = pageOf(doc, n)
      return {
        kind: 'nodeMove',
        drag: { mode: 'nodeMove', id: n.id, sx: x, sy: y, ox: n.x, oy: n.y, page, multi: keepMulti, ownerGroup: groupOwnerOf(doc, n.id) },
        sel: keepMulti ? null : selIds,
      }
    }
    // 选择模式：主体 = 移动；边带/角 = 画箭头（无手柄，Q1）
    if (loc.mode !== 'inside') {
      const page = pageOf(doc, n)
      const fromAnchor = anchorFromPoint(n, x, y)
      return {
        kind: 'arrow',
        drag: { mode: 'arrow', sourceId: n.id, fromAnchor, sx: x, sy: y, page },
        sel: [n.id], // 起笔即选中源节点（视觉提示）
      }
    }
    if (ctx.ctrl) {
      const has = selectedIds.indexOf(n.id) !== -1
      const next = has ? selectedIds.filter((i) => i !== n.id) : selectedIds.concat([n.id])
      return { kind: 'toggle', ids: next }
    }
    const keepMulti = selectedIds.length > 1 && selectedIds.indexOf(n.id) !== -1
    const selIds = keepMulti ? selectedIds : [n.id]
    const page = pageOf(doc, n)
    return {
      kind: 'nodeMove',
      drag: { mode: 'nodeMove', id: n.id, sx: x, sy: y, ox: n.x, oy: n.y, page, multi: keepMulti },
      sel: keepMulti ? null : selIds,
    }
  }
  // 空白：选择模式 = 框选；绘制模式 = 页面外建页 / 页面内建节点
  if (mode === 'select') {
    return { kind: 'marquee', drag: { mode: 'marquee', sx: x, sy: y } }
  }
  if ((doc.nodes.length + doc.edges.length) >= MAX_ELEMENTS) return { kind: 'limit' }
  const page = doc.pages.find((p) => x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h)
  if (page) {
    const tmp = createNode(page.id, 'rectangle', x, y, 4, 4)
    tmp.dragTmp = true
    return {
      kind: 'nodeCreate',
      drag: { mode: 'nodeCreate', tmpId: tmp.id, sx: x, sy: y, page: { x: page.x, y: page.y, w: page.w, h: page.h } },
      element: tmp,
    }
  }
  if (doc.pages.length >= 12) return { kind: 'limit' }
  const tmp = createPage(x, y, 4, 4)
  tmp.dragTmp = true
  return {
    kind: 'pageCreate',
    drag: { mode: 'pageCreate', tmpId: tmp.id, sx: x, sy: y },
    element: tmp,
  }
}

export function pageOf(doc, node) {
  const p = (doc.pages || []).find((x) => x.id === node.pageId)
  return p ? { x: p.x, y: p.y, w: p.w, h: p.h } : null
}

// 节点当前所属组 id（拖入/拖出结算用）；无 → null
function groupOwnerOf(doc, nodeId) {
  const g = (doc.nodes || []).find((n) => isGroup(n) && (n.children || []).includes(nodeId))
  return g ? g.id : null
}

// 多选成员起点快照（批量 resize 用；每帧以快照绝对重算，防增量累积漂移）
function memberSnapshot(doc, ids) {
  return (ids || []).map((id) => {
    const m = nodeById(doc, id)
    return m ? { id, x: m.x, y: m.y, w: m.w, h: m.h, shape: m.shape } : null
  }).filter(Boolean)
}

// ---------- pointer.move 计算 ----------
export function updateDrag(ctx, drag, x, y, clientX, clientY) {
  if (drag.mode === 'pan') return { pan: computePan(drag, clientX, clientY, ctx.rect, ctx.zoom) }
  if (drag.mode === 'pageCreate' || drag.mode === 'nodeCreate') {
    const r = computeCreate(ctx, drag, x, y)
    // 覆盖检测：nodeCreate 时附带 createCover（供预览透明/恢复背景）
    if (drag.mode === 'nodeCreate') {
      const cover = createCovers(ctx, drag, r)
      return { patch: r, createCover: cover }
    }
    return { patch: r }
  }
  if (drag.mode === 'pageResize') {
    const r = computePageResize(ctx, drag, x, y)
    return r ? { patch: r } : {}
  }
  if (drag.mode === 'nodeMove') return computeMove(ctx, drag, x, y)
  if (drag.mode === 'pageMove') return computePageMove(ctx, drag, x, y)
  if (drag.mode === 'marquee') return { nextDrag: Object.assign({}, drag, { mq: computeMarquee(drag, x, y) }) }
  if (drag.mode === 'resize') {
    const r = computeResize(ctx, drag, x, y)
    if (!r) return {}
    // 组合：子树等比缩放返回 patches（多节点）；普通节点：单 patch
    if (r.patches) return { patches: r.patches, snaps: r.snaps }
    const { snaps, ...patch } = r
    return { patch, snaps }
  }
  if (drag.mode === 'groupEdgeResize') {
    const r = computeGroupEdgeResize(ctx, drag, x, y)
    return { patches: r.patches, snaps: r.snaps, lastDx: r.appX, lastDy: r.appY }
  }
  if (drag.mode === 'groupCornerResize') {
    return { patches: computeGroupCornerResize(ctx, drag, x, y), lastDx: undefined, lastDy: undefined }
  }
  if (drag.mode === 'arrow') {
    return { ghost: arrowGhost(ctx.doc, drag, x, y, ctx.zoom) }
  }
  if (drag.mode === 'anchorDrag') {
    return { ghost: anchorDragGhost(ctx.doc, drag, x, y, ctx.zoom) }
  }
  return {}
}

// 创建：矩形归一 + 页面钳制（节点不允许超出页面；页面创建无钳制）
export function computeCreate(ctx, drag, x, y) {
  let nx = Math.min(x, drag.sx)
  let ny = Math.min(y, drag.sy)
  let nw = Math.max(MIN_CREATE, Math.abs(x - drag.sx))
  let nh = Math.max(MIN_CREATE, Math.abs(y - drag.sy))
  if (drag.page) {
    nw = Math.min(nw, drag.page.x + drag.page.w - nx)
    nh = Math.min(nh, drag.page.y + drag.page.h - ny)
  }
  return { x: nx, y: ny, w: Math.max(MIN_CREATE, nw), h: Math.max(MIN_CREATE, nh) }
}

// 绘制预览是否覆盖（相交）其他控件——覆盖时创建预览自动透明、松开后成为组合
export function createCovers(ctx, drag, rect) {
  if (drag.mode !== 'nodeCreate') return false
  const tmp = (ctx.doc.nodes || []).find((n) => n.id === drag.tmpId)
  if (!tmp) return false
  return coveredByRect(rect, ctx.doc.nodes, tmp.pageId).length > 0
}

// 页面宽高调整（Q1：仅绘制模式；四边单边缩放、右下角等比自由；最小尺寸 PAGE_MIN）
export function computePageResize(ctx, drag, x, y) {
  const page = (ctx.doc.pages || []).find((p) => p.id === drag.id)
  if (!page) return null
  const side = drag.side
  const dx = x - drag.sx
  const dy = y - drag.sy
  let nx = drag.ox
  let ny = drag.oy
  let w = drag.ow
  let h = drag.oh
  // 四角 + 四边统一分解（锚定对角自由缩放 / 单边单轴）
  const moved = {
    right: side === 'r' || side === 'br' || side === 'tr',
    bottom: side === 'b' || side === 'br' || side === 'bl',
    left: side === 'l' || side === 'tl' || side === 'bl',
    top: side === 't' || side === 'tl' || side === 'tr',
  }
  if (moved.right) w = Math.max(PAGE_MIN.w, drag.ow + dx)
  if (moved.bottom) h = Math.max(PAGE_MIN.h, drag.oh + dy)
  if (moved.left) w = Math.max(PAGE_MIN.w, drag.ow - dx)
  if (moved.top) h = Math.max(PAGE_MIN.h, drag.oh - dy)
  if (moved.left) nx = drag.ox + drag.ow - w
  if (moved.top) ny = drag.oy + drag.oh - h
  return { x: nx, y: ny, w, h }
}

// 节点移动：6 向对齐吸附 + 页面钳制 + 多选组移动 + 组合子树跟随（每帧增量，防重复累加）
export function computeMove(ctx, drag, x, y) {
  const { doc, zoom, selectedIds } = ctx
  const el = nodeById(doc, drag.id)
  if (!el) return {}
  const dx = x - drag.sx
  const dy = y - drag.sy
  let nx = drag.ox + dx
  let ny = drag.oy + dy
  const tol = SNAP_TOL / zoom
  const snaps = []
  const moving = new Set()
  if (drag.multi) {
    selectedIds.forEach((id) => moving.add(id))
  }
  moving.add(el.id)
  // 组合子树跟随：拖动组合时其全部子孙同帧增量移动
  if (isGroup(el)) {
    for (const d of descendantIds(doc, el.id)) moving.add(d)
  }
  const targets = (doc.nodes || []).filter((n) => !moving.has(n.id) && n.pageId === el.pageId)
  if (drag.page) targets.push(drag.page)
  let bx = null
  let by = null
  for (const t of targets) {
    const xs = [
      { d: Math.abs(nx - t.x), pos: t.x, line: t.x },
      { d: Math.abs(nx + el.w - (t.x + t.w)), pos: t.x + t.w - el.w, line: t.x + t.w },
      { d: Math.abs(nx + el.w / 2 - (t.x + t.w / 2)), pos: t.x + t.w / 2 - el.w / 2, line: t.x + t.w / 2 },
    ]
    const ys = [
      { d: Math.abs(ny - t.y), pos: t.y, line: t.y },
      { d: Math.abs(ny + el.h - (t.y + t.h)), pos: t.y + t.h - el.h, line: t.y + t.h },
      { d: Math.abs(ny + el.h / 2 - (t.y + t.h / 2)), pos: t.y + t.h / 2 - el.h / 2, line: t.y + t.h / 2 },
    ]
    for (const c of xs) if (c.d < tol && (!bx || c.d < bx.d)) bx = c
    for (const c of ys) if (c.d < tol && (!by || c.d < by.d)) by = c
  }
  if (bx) { nx = bx.pos; snaps.push({ axis: 'v', pos: bx.line }) }
  if (by) { ny = by.pos; snaps.push({ axis: 'h', pos: by.line }) }
  if (drag.page) {
    nx = clamp(nx, drag.page.x, drag.page.x + drag.page.w - el.w)
    ny = clamp(ny, drag.page.y, drag.page.y + drag.page.h - el.h)
  }
  const deltaX = nx - drag.ox
  const deltaY = ny - drag.oy
  const incX = deltaX - (drag.lastDx || 0)
  const incY = deltaY - (drag.lastDy || 0)
  const patches = []
  for (const id of moving) {
    const n = nodeById(doc, id)
    if (!n) continue
    if (id === el.id) {
      patches.push({ id, x: nx, y: ny })
      continue
    }
    // 跟随元素：本帧增量 + 各自页面钳制（页面不随节点移动，按其当前位置钳制）
    let ex = n.x + incX
    let ey = n.y + incY
    const pg = pageOf(doc, n)
    if (pg) {
      ex = clamp(ex, pg.x, pg.x + pg.w - n.w)
      ey = clamp(ey, pg.y, pg.y + pg.h - n.h)
    }
    patches.push({ id, x: ex, y: ey })
  }
  // 组合拖入反馈：移动块与「非宿主组」相交 → 高亮该组矩形
  const block = isGroup(el) ? subtreeBounds(doc, el.id) : { x: nx, y: ny, w: el.w, h: el.h }
  let groupHover = null
  if (block) {
    let bestArea = 0
    for (const g of doc.nodes || []) {
      if (!isGroup(g)) continue
      if (g.id === el.id || g.id === drag.ownerGroup) continue
      if (subtreeHasGroup(g, doc, el.id)) continue
      if (g.pageId !== el.pageId) continue
      if (!rectsOverlap(g, block)) continue
      if (g.w * g.h > bestArea) { bestArea = g.w * g.h; groupHover = g.id }
    }
  }
  return { patches, snaps, lastDx: deltaX, lastDy: deltaY, groupHover }
}

// g 的子树是否包含 el（g 为 el 的祖先组——拖动块不可与自己的祖先发生关系）
function subtreeHasGroup(g, doc, elId) {
  return descendantIds(doc, g.id).includes(elId)
}

// 页面移动：内部节点跟随（保持相对位置，不做钳制）；页面间保持间距
export function computePageMove(ctx, drag, x, y) {
  const { doc } = ctx
  const page = (doc.pages || []).find((p) => p.id === drag.id)
  if (!page) return {}
  let nx = drag.ox + (x - drag.sx)
  let ny = drag.oy + (y - drag.sy)
  for (const p of doc.pages || []) {
    if (p.id === page.id) continue
    const overlapX = nx < p.x + p.w + PAGE_GAP && nx + page.w > p.x - PAGE_GAP
    const overlapY = ny < p.y + p.h + PAGE_GAP && ny + page.h > p.y - PAGE_GAP
    if (!overlapX || !overlapY) continue
    const dLeft = Math.abs((p.x - PAGE_GAP - page.w) - nx)
    const dRight = Math.abs((p.x + p.w + PAGE_GAP) - nx)
    const dTop = Math.abs((p.y - PAGE_GAP - page.h) - ny)
    const dBottom = Math.abs((p.y + p.h + PAGE_GAP) - ny)
    const min = Math.min(dLeft, dRight, dTop, dBottom)
    if (min === dLeft) nx = p.x - PAGE_GAP - page.w
    else if (min === dRight) nx = p.x + p.w + PAGE_GAP
    else if (min === dTop) ny = p.y - PAGE_GAP - page.h
    else ny = p.y + p.h + PAGE_GAP
  }
  const deltaX = nx - drag.ox
  const deltaY = ny - drag.oy
  const incX = deltaX - (drag.lastDx || 0)
  const incY = deltaY - (drag.lastDy || 0)
  const patches = [{ id: 'page:' + page.id, x: nx, y: ny }]
  for (const n of doc.nodes || []) {
    if (n.pageId !== page.id) continue
    patches.push({ id: n.id, x: n.x + incX, y: n.y + incY })
  }
  return { patches, lastDx: deltaX, lastDy: deltaY }
}

// 框选：实时更新选框矩形
export function computeMarquee(drag, x, y) {
  return { x: Math.min(x, drag.sx), y: Math.min(y, drag.sy), w: Math.abs(x - drag.sx), h: Math.abs(y - drag.sy) }
}

// 改尺寸（绘制模式：贴边/角）：最小尺寸 + 页面钳制 + 移动边吸附
export function computeResize(ctx, drag, x, y) {
  const el = nodeById(ctx.doc, drag.id)
  if (!el) return null
  const { zoom } = ctx
  const min = shapeOf(el.shape).min
  const side = drag.side
  const dx = x - drag.sx
  const dy = y - drag.sy
  let nx = drag.ox
  let ny = drag.oy
  let w = drag.ow
  let h = drag.oh
  // 四角 + 四边统一分解为「移动边集合」：自由缩放（锚定对角），单边 = 单轴
  const moved = {
    right: side === 'r' || side === 'br' || side === 'tr',
    bottom: side === 'b' || side === 'br' || side === 'bl',
    left: side === 'l' || side === 'tl' || side === 'bl',
    top: side === 't' || side === 'tl' || side === 'tr',
  }
  if (moved.right) w = Math.max(min.w, drag.ow + dx)
  if (moved.bottom) h = Math.max(min.h, drag.oh + dy)
  if (moved.left) w = Math.max(min.w, drag.ow - dx)
  if (moved.top) h = Math.max(min.h, drag.oh - dy)
  if (moved.left) nx = drag.ox + drag.ow - w
  if (moved.top) ny = drag.oy + drag.oh - h
  // 吸附（仅吸附正在移动的边；与已有 br/单边语义一致）
  const tol = SNAP_TOL / zoom
  const snaps = []
  const targets = (ctx.doc.nodes || []).filter((t) => t.id !== el.id && t.pageId === el.pageId)
  if (drag.page) targets.push(drag.page)
  if (moved.right) {
    const rightX = nx + w
    let bw = null
    for (const t of targets) {
      for (const [d, pos] of [[Math.abs(rightX - t.x), t.x], [Math.abs(rightX - (t.x + t.w)), t.x + t.w]]) {
        if (d < tol && (!bw || d < bw.d)) bw = { d, pos }
      }
    }
    if (bw) { w = Math.max(min.w, bw.pos - nx); snaps.push({ axis: 'v', pos: bw.pos }) }
  }
  if (moved.bottom) {
    const bottomY = ny + h
    let bh = null
    for (const t of targets) {
      for (const [d, pos] of [[Math.abs(bottomY - t.y), t.y], [Math.abs(bottomY - (t.y + t.h)), t.y + t.h]]) {
        if (d < tol && (!bh || d < bh.d)) bh = { d, pos }
      }
    }
    if (bh) { h = Math.max(min.h, bh.pos - ny); snaps.push({ axis: 'h', pos: bh.pos }) }
  }
  if (moved.left) {
    const leftX = nx
    let bw = null
    for (const t of targets) {
      for (const [d, pos] of [[Math.abs(leftX - t.x), t.x], [Math.abs(leftX - (t.x + t.w)), t.x + t.w]]) {
        if (d < tol && (!bw || d < bw.d)) bw = { d, pos }
      }
    }
    if (bw) { nx = bw.pos; w = Math.max(min.w, drag.ox + drag.ow - nx); snaps.push({ axis: 'v', pos: bw.pos }) }
  }
  if (moved.top) {
    const topY = ny
    let bh = null
    for (const t of targets) {
      for (const [d, pos] of [[Math.abs(topY - t.y), t.y], [Math.abs(topY - (t.y + t.h)), t.y + t.h]]) {
        if (d < tol && (!bh || d < bh.d)) bh = { d, pos }
      }
    }
    if (bh) { ny = bh.pos; h = Math.max(min.h, drag.oy + drag.oh - ny); snaps.push({ axis: 'h', pos: bh.pos }) }
  }
  // 页面边界钳制（按移动边）
  if (drag.page) {
    if (moved.right) w = Math.min(w, drag.page.x + drag.page.w - nx)
    if (moved.bottom) h = Math.min(h, drag.page.y + drag.page.h - ny)
    if (moved.left) {
      const minX = drag.page.x
      if (nx < minX) { nx = minX; w = Math.max(min.w, drag.ox + drag.ow - nx) }
    }
    if (moved.top) {
      const minY = drag.page.y
      if (ny < minY) { ny = minY; h = Math.max(min.h, drag.oy + drag.oh - ny) }
    }
  }
  // 组合 resize：矩形变化 → 子孙等比缩放（基于**拖动起点快照** drag.members；页面钳制；最小尺寸）——
  // 保证「完全包裹」不变式：组缩小也不会把成员顶出（成员随比例缩放）；
  // 以起点快照为基准重算（非当前渲染值），杜绝多帧相对比例的累积漂移
  if (isGroup(el)) {
    const oldB = { x: drag.ox, y: drag.oy, w: drag.ow, h: drag.oh }
    const newB = { x: nx, y: ny, w, h }
    const patches = [{ id: el.id, x: newB.x, y: newB.y, w: newB.w, h: newB.h }]
    for (const m of drag.members || []) {
      const min = shapeOf(m.shape || 'rectangle').min
      const px = oldB.w > 0 ? (m.x - oldB.x) / oldB.w : 0
      const py = oldB.h > 0 ? (m.y - oldB.y) / oldB.h : 0
      const pw = oldB.w > 0 ? m.w / oldB.w : 1
      const ph = oldB.h > 0 ? m.h / oldB.h : 1
      let ex = newB.x + px * newB.w
      let ey = newB.y + py * newB.h
      let ew = Math.max(min.w, pw * newB.w)
      let eh = Math.max(min.h, ph * newB.h)
      const cur = nodeById(ctx.doc, m.id)
      const pg = cur ? pageOf(ctx.doc, cur) : null
      if (pg) {
        ex = clamp(ex, pg.x, pg.x + pg.w - ew)
        ey = clamp(ey, pg.y, pg.y + pg.h - eh)
        ew = Math.max(min.w, Math.min(ew, pg.x + pg.w - ex))
        eh = Math.max(min.h, Math.min(eh, pg.y + pg.h - ey))
      }
      patches.push({ id: m.id, x: ex, y: ey, w: ew, h: eh })
    }
    return { patches, snaps }
  }
  return { x: nx, y: ny, w, h, snaps }
}

// 多选外框边批量调整（单轴、四边可用）：移动边一侧增量，对侧不动；以**起点快照** drag.members 绝对重算，
// 吸附非选中元素（绝对式防多帧增量累积）；页面钳制防越界。
// r：各成员 w 增减（x 不动）；l：各成员 x 随动、右缘固定（w 增减）；b：h 增减；t：y 随动、底缘固定
export function computeGroupEdgeResize(ctx, drag, x, y) {
  const side = drag.side
  const gb = drag.gb
  const cumX = x - drag.sx
  const cumY = y - drag.sy
  const tol = SNAP_TOL / (ctx.zoom || 1)
  const snaps = []
  const targets = (ctx.doc.nodes || []).filter((t) => !(drag.members || []).some((m) => m.id === t.id))
  let adjX = 0
  let adjY = 0
  // 移动边吸附（r/l 吸 x 线；b/t 吸 y 线）
  if (side === 'r' || side === 'l') {
    const edge = (side === 'r' ? gb.x + gb.w : gb.x) + cumX
    let bw = null
    for (const t of targets) {
      for (const [d, pos] of [[Math.abs(edge - t.x), t.x], [Math.abs(edge - (t.x + t.w)), t.x + t.w]]) {
        if (d < tol && (!bw || d < bw.d)) bw = { d, pos }
      }
    }
    if (bw) { adjX = bw.pos - edge; snaps.push({ axis: 'v', pos: bw.pos }) }
  } else if (side === 'b' || side === 't') {
    const edge = (side === 'b' ? gb.y + gb.h : gb.y) + cumY
    let bh = null
    for (const t of targets) {
      for (const [d, pos] of [[Math.abs(edge - t.y), t.y], [Math.abs(edge - (t.y + t.h)), t.y + t.h]]) {
        if (d < tol && (!bh || d < bh.d)) bh = { d, pos }
      }
    }
    if (bh) { adjY = bh.pos - edge; snaps.push({ axis: 'h', pos: bh.pos }) }
  }
  const appX = cumX + adjX
  const appY = cumY + adjY
  const patches = []
  for (const m of drag.members || []) {
    const min = shapeOf(m.shape || 'rectangle').min
    const p = { id: m.id }
    // 页面钳制（批量改宽高不允许越出所属页面——控件漂移的防御）
    const cur = nodeById(ctx.doc, m.id)
    const pg = cur ? pageOf(ctx.doc, cur) : null
    if (side === 'r') {
      p.w = Math.max(min.w, m.w + appX)
      if (pg) p.w = Math.min(p.w, pg.x + pg.w - m.x)
    } else if (side === 'l') {
      // 左缘随动、右缘固定：x 增量 = appX，w 相应反向增减；最小尺寸时锚定右缘
      const right = m.x + m.w
      let nx = m.x + appX
      let nw = Math.max(min.w, right - nx)
      nx = right - nw
      if (pg && nx < pg.x) { nx = pg.x; nw = Math.max(min.w, right - nx) }
      p.x = nx
      p.w = nw
    } else if (side === 'b') {
      p.h = Math.max(min.h, m.h + appY)
      if (pg) p.h = Math.min(p.h, pg.y + pg.h - m.y)
    } else if (side === 't') {
      // 上缘随动、下缘固定：y 增量 = appY，h 相应反向增减；最小尺寸时锚定下缘
      const bottom = m.y + m.h
      let ny = m.y + appY
      let nh = Math.max(min.h, bottom - ny)
      ny = bottom - nh
      if (pg && ny < pg.y) { ny = pg.y; nh = Math.max(min.h, bottom - ny) }
      p.y = ny
      p.h = nh
    }
    patches.push(p)
  }
  return { patches, snaps, appX, appY }
}

// 多选外框右下角等比缩放（锚定左上角，scale 0.1–10；结果按各节点所属页面钳制）
// 以**起点快照** drag.members 绝对重算（防多帧累积漂移）
export function computeGroupCornerResize(ctx, drag, x, y) {
  const gb = drag.gb
  const scale = Math.max(0.1, Math.min(10, (x - gb.x) / Math.max(1, gb.w)))
  const patches = []
  for (const m of drag.members || []) {
    const min = shapeOf(m.shape || 'rectangle').min
    let nx = gb.x + (m.x - gb.x) * scale
    let ny = gb.y + (m.y - gb.y) * scale
    let w = Math.max(min.w, m.w * scale)
    let h = Math.max(min.h, m.h * scale)
    const cur = nodeById(ctx.doc, m.id)
    const pg = cur ? pageOf(ctx.doc, cur) : null
    if (pg) {
      // 页面钳制：位置夹回、尺寸不越界（批量等比不允许飞出页面）
      nx = clamp(nx, pg.x, pg.x + pg.w - min.w)
      ny = clamp(ny, pg.y, pg.y + pg.h - min.h)
      w = Math.max(min.w, Math.min(w, pg.x + pg.w - nx))
      h = Math.max(min.h, Math.min(h, pg.y + pg.h - ny))
    }
    patches.push({ id: m.id, x: nx, y: ny, w, h })
  }
  return patches
}

// ---------- 箭头绘制（E1：锚点归一化；E2：跨页取消） ----------
// 返回 { source, fromAnchor, target, toAnchor, crossPage, x, y }
export function arrowGhost(doc, drag, x, y, zoom) {
  const source = nodeById(doc, drag.sourceId)
  if (!source) return null
  const page = drag.page
  let crossPage = false
  let target = null
  let toAnchor = null
  let bestD = Infinity
  for (const n of doc.nodes || []) {
    if (n.id === source.id || n.pageId !== source.pageId) continue
    const near = n.x - ARROW_SNAP / zoom <= x && x <= n.x + n.w + ARROW_SNAP / zoom
      && n.y - ARROW_SNAP / zoom <= y && y <= n.y + n.h + ARROW_SNAP / zoom
    if (!near) continue
    const a = anchorFromPoint(n, clamp(x, n.x, n.x + n.w), clamp(y, n.y, n.y + n.h))
    const wpt = anchorToWorld(n, a)
    const d = Math.hypot(wpt.x - x, wpt.y - y)
    if (d <= ARROW_SNAP / zoom && d < bestD) {
      bestD = d
      target = n
      toAnchor = a
    }
  }
  if (page) {
    const p = page
    if (!(x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h)) crossPage = true
  }
  return { source, fromAnchor: drag.fromAnchor, target, toAnchor, crossPage, x, y }
}

// ---------- hover 光标 + 连线起点预览（Q1 语义） ----------
// ctx = { doc, mode, zoom, selectedEdge }
// 返回：'' = 用画布兜底光标（绘制模式 crosshair / 选择模式 default）；
//       'ew-resize' | 'ns-resize' | 'nwse-resize' | 'nesw-resize'（draw 模式边带/角）；
//       'grab'（选中箭头锚点手柄）；'crosshair'（选择模式节点边带 = 连线起笔）；'move'（页面标题条）
export function hoverCursorFor(ctx, x, y) {
  const { doc, mode, zoom, selectedEdge } = ctx
  if (mode === 'select' && selectedEdge) {
    const edge = (doc.edges || []).find((e) => e.id === selectedEdge)
    if (edge) {
      const probes = [
        { node: nodeById(doc, edge.from), anchor: edge.fromAnchor },
        { node: nodeById(doc, edge.to), anchor: edge.toAnchor },
      ]
      for (const p of probes) {
        if (!p.node || !p.anchor) continue
        const wpt = anchorToWorld(p.node, p.anchor)
        if (Math.hypot(x - wpt.x, y - wpt.y) <= 9 / zoom) return 'grab'
      }
    }
  }
  // 多选外框（两种模式语义一致）：边带 = 批量改宽高、右下角 = 批量等比 → 方向光标
  if (ctx.selectedIds && ctx.selectedIds.length > 1) {
    const gb = groupBounds(doc.nodes, ctx.selectedIds)
    if (gb) {
      const gSide = hitGroupEdge(gb, x, y, 10 / zoom, 4 / zoom)
      if (gSide) return sideCursor(gSide)
      const csz = 12 / zoom
      if (x >= gb.x + gb.w - csz && x <= gb.x + gb.w + csz && y >= gb.y + gb.h - csz && y <= gb.y + gb.h + csz) {
        return 'nwse-resize'
      }
    }
  }
  const loc = hitPriority(doc, x, y, zoom)
  if (mode !== 'draw') {
    // 选择模式：节点边带/角 = 连线起笔（crosshair + 起点圆点预览）；
    // 页面标题条 = 页面移动（move）
    if (loc && loc.kind === 'node' && (loc.mode === 'edge' || loc.mode === 'corner')) return 'crosshair'
    if (loc && loc.kind === 'pageTitle') return 'move'
    return ''
  }
  if (loc && loc.kind === 'node' && (loc.mode === 'edge' || loc.mode === 'corner')) {
    return sideCursor(loc.side)
  }
  if (loc && (loc.kind === 'pageEdge' || loc.kind === 'pageCorner')) {
    return sideCursor(loc.side)
  }
  return ''
}

// 连线起点 hover 预览：选择模式贴近节点边带/角 → { node, anchor, wpt } | null
// （用户在按下前即看到起点圆点，明确「按住此处 = 开始连线」）
export function hoverAnchorFor(doc, x, y, zoom) {
  const loc = hitPriority(doc, x, y, zoom)
  if (!loc || loc.kind !== 'node' || !(loc.mode === 'edge' || loc.mode === 'corner')) return null
  const a = anchorFromPoint(loc.node, x, y)
  return { node: loc.node, anchor: a, wpt: anchorToWorld(loc.node, a) }
}

function sideCursor(side) {
  if (side === 'r' || side === 'l') return 'ew-resize'
  if (side === 'b' || side === 't') return 'ns-resize'
  if (side === 'tr' || side === 'bl') return 'nesw-resize'
  return 'nwse-resize' // tl / br
}


// ---------- 锚点挪动（选中箭头两端手柄；脱离吸附松开 = 取消连线） ----------
// 返回 { kind:'anchor', source, target, fromAnchor, toAnchor, dot, end, detach }
//  detach：鼠标点距控件边框距离 > ANCHOR_SNAP/zoom → 脱离态（松开取消连线）
export const ANCHOR_SNAP = 12
export function anchorDragGhost(doc, drag, x, y, zoom) {
  const edge = (doc.edges || []).find((e) => e.id === drag.edgeId)
  const node = nodeById(doc, drag.nodeId)
  if (!edge || !node) return null
  const other = end => (end === 'from'
    ? { node: nodeById(doc, edge.from), anchor: edge.fromAnchor }
    : { node: nodeById(doc, edge.to), anchor: edge.toAnchor })
  const moved = other(drag.end)
  if (!moved.node || !moved.anchor) return null
  const proj = anchorFromPoint(moved.node, x, y)
  const wpt = anchorToWorld(moved.node, proj)
  // 鼠标到控件边框距离（矩形外侧距离）：0 = 在边内/边上
  const dx = Math.max(moved.node.x - x, 0, x - (moved.node.x + moved.node.w))
  const dy = Math.max(moved.node.y - y, 0, y - (moved.node.y + moved.node.h))
  const dist = Math.hypot(dx, dy)
  const fromSide = drag.end === 'from' ? proj : edge.fromAnchor
  const toSide = drag.end === 'to' ? proj : edge.toAnchor
  return {
    kind: 'anchor',
    source: nodeById(doc, edge.from),
    target: nodeById(doc, edge.to),
    fromAnchor: fromSide,
    toAnchor: toSide,
    dot: wpt,
    end: drag.end,
    detach: dist > ANCHOR_SNAP / zoom,
  }
}

// ---------- pointer.up 结算 ----------
// 返回 { patches?, pagePatch?, remove?, selection?, selEdge?, edge?, commit }
export function settleDrag(ctx, drag) {
  if (drag.mode === 'pageCreate') {
    const tmp = (ctx.doc.pages || []).find((p) => p.id === drag.tmpId)
    if (!tmp) return { commit: true }
    const tiny = tmp.w < PAGE_MIN.w || tmp.h < PAGE_MIN.h
    if (tiny) return { removePage: [drag.tmpId], commit: true }
    const c = Object.assign({}, tmp)
    delete c.dragTmp
    return { pagePatch: c, commit: true }
  }
  if (drag.mode === 'nodeCreate') {
    const tmp = (ctx.doc.nodes || []).find((n) => n.id === drag.tmpId)
    if (!tmp) return { commit: true }
    if (tmp.w < 20 || tmp.h < 16) return { remove: [drag.tmpId], commit: true }
    // 覆盖了其他控件 → 创建组合（透明矩形 + 成员包裹 + 全部框选）；否则普通节点
    const covered = coveredByRect(tmp, ctx.doc.nodes, tmp.pageId).filter((id) => id !== tmp.id)
    if (covered.length) {
      const group = buildGroupNode(tmp, ctx.doc, covered)
      return { groupPatch: group, commit: true, select: [group.id].concat(group.children) }
    }
    const c = Object.assign({}, tmp)
    delete c.dragTmp
    return { patch: c, commit: true, select: [c.id] }
  }
  if (drag.mode === 'marquee') {
    const m = drag.mq
    let selection = null
    let selEdge = null
    if (m && m.w > 4 && m.h > 4) {
      const picked = (ctx.doc.nodes || []).filter((n) =>
        n.x >= m.x && n.y >= m.y && n.x + n.w <= m.x + m.w && n.y + n.h <= m.y + m.h).map((n) => n.id)
      selection = picked
      const edge = (ctx.doc.edges || []).find((e) => picked.indexOf(e.from) !== -1 && picked.indexOf(e.to) !== -1)
      selEdge = edge ? edge.id : null
    }
    return { selection, selEdge, commit: true }
  }
  if (drag.mode === 'arrow') {
    const g = drag.ghost
    const src = (ctx.doc.nodes || []).find((n) => n.id === drag.sourceId)
    if (!g || !g.target || g.crossPage || !src || g.target.id === drag.sourceId) {
      return { commit: true } // 取消：不创建、无残留
    }
    const edge = createEdge(src.pageId, drag.sourceId, g.fromAnchor, g.target.id, g.toAnchor, 'solid')
    return { edge, commit: true, selEdge: edge.id }
  }
  if (drag.mode === 'anchorDrag') {
    const g = drag.ghost
    if (!g) return { commit: true }
    if (g.detach) {
      // 脱离控件边吸附并松开 → 取消连线（删除箭头）
      return { edgeRemove: drag.edgeId, commit: true }
    }
    // 按用户移动后的圆点位置确定锚点
    return {
      edgePatch: {
        id: drag.edgeId,
        patch: drag.end === 'from' ? { fromAnchor: g.fromAnchor } : { toAnchor: g.toAnchor },
      },
      commit: true,
    }
  }
  if (drag.mode === 'pageMove' || drag.mode === 'resize'
    || drag.mode === 'pageResize'
    || drag.mode === 'groupEdgeResize' || drag.mode === 'groupCornerResize') {
    return { commit: true }
  }
  // 组合结算（拖入/拖出/归一）：normalizeMove 输出 childBinds/groupPatches/adjustments
  if (drag.mode === 'nodeMove') {
    const r = normalizeMove(ctx.doc, drag.id)
    return Object.assign({ commit: true }, r)
  }
  return {}
}
