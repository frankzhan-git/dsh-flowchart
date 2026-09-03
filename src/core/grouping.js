// dsh-flowchart core/grouping.js —— 组合控件（P8：大矩形包裹其他控件的纯函数语义）
// 边界：零 React/DSH；只依赖传入的 doc 数据；导出全部纯函数供 interactions/渲染/verify 使用
// 数据形态：组合节点 = { id, pageId, x, y, w, h, text, group: true, children: [childId...] }
//   - children 为「直接子」id（后代任意深度）；被包裹控件完全位于组矩形内部（边距 GROUP_PAD）
//   - 不变式（正常态）：任一控件与任一组合矩形要么完全在外不重叠，要么完全包裹在内
export const GROUP_PAD = 4

export function isGroup(n) {
  return !!(n && n.group)
}

export function groupOf(doc, nodeId) {
  return (doc.nodes || []).find((n) => isGroup(n) && (n.children || []).includes(nodeId))
}

// 完全包含（outer 含 inner；pad 为内边距余量）
export function rectContains(outer, inner, pad) {
  const p = pad == null ? 0 : pad
  return inner.x >= outer.x - p + 0 && inner.y >= outer.y - p && inner.x + inner.w <= outer.x + outer.w + p
    && inner.y + inner.h <= outer.y + outer.h + p
}

// 相交（面积重叠 > 0；边缘接触不算）
export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

// 完全包含点
export function pointInRect(r, x, y) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
}

// 该节点的全部子孙 id（直接子 + 递归；不包含自身）；visited 去重（重复归属数据防御）
export function descendantIds(doc, nodeId) {
  const out = []
  const seen = new Set()
  const walk = (id) => {
    const n = (doc.nodes || []).find((x) => x.id === id)
    if (!n) return
    for (const c of n.children || []) {
      if (seen.has(c)) continue
      seen.add(c)
      out.push(c)
      walk(c)
    }
  }
  walk(nodeId)
  return out
}

// 子树包围盒（含自身）；无节点返回 null
export function subtreeBounds(doc, nodeId) {
  const ids = [nodeId].concat(descendantIds(doc, nodeId))
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const id of ids) {
    const n = (doc.nodes || []).find((x) => x.id === id)
    if (!n) continue
    x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y)
    x1 = Math.max(x1, n.x + n.w); y1 = Math.max(y1, n.y + n.h)
  }
  if (x0 === Infinity) return null
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

// 绘制成组：被绘制矩形「覆盖」（相交）的节点 id 列表（同页、不含组自身——组可被新组包裹）。
// 唯一归属（0.2.8）：只收「顶层被覆盖对象」——若被覆盖的是某个组，其成员随该组归入新组，
// 不重复收编（否则 children 重复归属，嵌套 subgraph 输出随数组序漂移）。
export function coveredByRect(rect, nodes, pageId) {
  const list = nodes || []
  const hits = list
    .filter((n) => n.pageId === pageId && rectsOverlap(rect, n))
    .map((n) => n.id)
  const coveredGroups = hits.filter((id) => {
    const n = list.find((x) => x.id === id)
    return !!(n && isGroup(n))
  })
  if (!coveredGroups.length) return hits
  const belongsToCovered = (id) => coveredGroups.some((gid) =>
    gid !== id && descendantIds({ nodes: list }, gid).includes(id))
  return hits.filter((id) => !belongsToCovered(id))
}

// 组合矩形扩展：扩展到完全包含 bounds（+GROUP_PAD 边距；尺寸只增不减，锚定左上不动）
export function expandToContain(rect, bounds) {
  const x = Math.min(rect.x, bounds.x - GROUP_PAD)
  const y = Math.min(rect.y, bounds.y - GROUP_PAD)
  const x2 = Math.max(rect.x + rect.w, bounds.x + bounds.w + GROUP_PAD)
  const y2 = Math.max(rect.y + rect.h, bounds.y + bounds.h + GROUP_PAD)
  return { x, y, w: x2 - x, h: y2 - y }
}

// 拖放/绘制结算：归一化「包裹关系」，满足不变式（完全在外 或 完全包裹）。
// movedId = 被移动节点 id（其移动后位置已计入 doc 的 x/y）。
// 返回：{ childBinds: [{id, children}], groupPatches: [{id,x,y,w,h}], adjustments: [{id,x,y}] }
//   - childBinds：组节点 children 新数组（写回 doc）
//   - groupPatches：被扩展的组矩形 bounds（拖入意图：组自动扩大以完全包裹）
//   - adjustments：被移动节点的纠偏位移（推离 / 归一）
// 规则（对移动块 = 节点自身或整棵子树包围盒）：
//   1) 完全包含于某组 → 归入该组（同页唯一归属；摘除其他组引用）
//   2) 与某组部分重叠且块中心在组内 → 拖入意图：组扩展至完全包含（expandToContain）后归入
//   3) 其余部分重叠：原属组 → 解除归属；并把块推离到完全在外
export function normalizeMove(doc, movedId) {
  const childBinds = []
  const groupPatches = []
  const adjustments = []
  const moved = (doc.nodes || []).find((n) => n.id === movedId)
  const origGroups = (doc.nodes || []).filter((n) => isGroup(n))
  const adjustedIds = new Set()
  if (!moved || !origGroups.length) return { childBinds, groupPatches, adjustments }

  const block = subtreeBounds(doc, movedId)
  if (!block) return { childBinds, groupPatches, adjustments }
  const hasId = (g, id) => g.id === id || descendantIds(doc, id).includes(g.id)

  // ---- 完全包含：取包围块的最小面积组（内层优先） ----
  let host = null
  let hostArea = Infinity
  for (const g of origGroups) {
    if (hasId(g, movedId)) continue
    if (g.pageId !== moved.pageId) continue
    if (rectContains(g, block, 0) && rectsOverlap(g, block)) {
      const area = g.w * g.h
      if (area < hostArea) { host = g; hostArea = area }
    }
  }
  if (host) {
    bindInto(childBinds, origGroups, host, movedId)
    return { childBinds, groupPatches, adjustments }
  }

  // ---- 部分重叠：中心落于组内 → 拖入（组扩展包裹） ----
  for (const g of origGroups) {
    if (hasId(g, movedId)) continue
    if (g.pageId !== moved.pageId) continue
    if (!rectsOverlap(g, block)) continue
    if (!pointInRect(g, block.x + block.w / 2, block.y + block.h / 2)) continue
    const expanded = expandToContain(g, block)
    groupPatches.push({ id: g.id, x: expanded.x, y: expanded.y, w: expanded.w, h: expanded.h })
    bindInto(childBinds, origGroups, Object.assign({}, g, expanded), movedId)
    return { childBinds, groupPatches, adjustments }
  }

  // ---- 其余部分重叠：原属组 → 解除；推离到完全在外 ----
  const wasMemberOf = origGroups.filter((g) => (g.children || []).includes(movedId))
  if (wasMemberOf.length) {
    for (const g of wasMemberOf) {
      childBinds.push({ id: g.id, children: (g.children || []).filter((c) => c !== movedId) })
    }
  }
  const blockNow = Object.assign({}, block)
  for (const g of origGroups) {
    if (hasId(g, movedId)) continue
    if (g.pageId !== moved.pageId || !rectsOverlap(g, blockNow)) continue
    const out = pushOutOf(g, blockNow)
    blockNow.x = out.x; blockNow.y = out.y
    adjustments.push({ id: movedId, x: out.x, y: out.y })
    adjustedIds.add(movedId)
  }
  return { childBinds, groupPatches, adjustments }
}

// 把 movedId 从所有组摘除、并绑定进 host（唯一归属；同组幂等）
function bindInto(childBinds, groups, host, movedId) {
  for (const g of groups) {
    const without = (g.children || []).filter((c) => c !== movedId)
    if (g.id === host.id) {
      if (!without.includes(movedId)) without.push(movedId)
      childBinds.push({ id: g.id, children: without })
    } else if (without.length !== (g.children || []).length) {
      childBinds.push({ id: g.id, children: without })
    }
  }
}

// 把块推到组外最近位置（只产生位移；返回新块 x/y）
export function pushOutOf(groupRect, block) {
  const dxL = groupRect.x - (block.x + block.w)   // 向左（负值=重叠量）
  const dxR = groupRect.x + groupRect.w - block.x // 向右
  const dyT = groupRect.y - (block.y + block.h)
  const dyB = groupRect.y + groupRect.h - block.y
  const candidates = [
    { x: block.x + dxL, y: block.y },
    { x: block.x + dxR, y: block.y },
    { x: block.x, y: block.y + dyT },
    { x: block.x, y: block.y + dyB },
  ]
  let best = candidates[0]
  let bestD = Math.abs(candidates[0].x - block.x) + Math.abs(candidates[0].y - block.y)
  for (const c of candidates.slice(1)) {
    const d = Math.abs(c.x - block.x) + Math.abs(c.y - block.y)
    if (d < bestD) { bestD = d; best = c }
  }
  return best
}

// 若干节点（含其子树）的合并包围盒；ids 为空返回 null
export function boundsOfNodes(doc, ids) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const id of ids) {
    const b = subtreeBounds(doc, id)
    if (!b) continue
    x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y)
    x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h)
  }
  if (x0 === Infinity) return null
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

// 构建组合节点：矩形 bound（绘制/已有）+ 成员 ids → 组数据（组矩形扩展至完全覆盖成员）。
// 名称留空（与普通控件一致）：mermaid 侧空文本以 " " 占位（escapeLabel），避免渲染报错
export function buildGroupNode(base, doc, memberIds) {
  const members = (memberIds || []).filter((id) => id !== base.id)
  const b = members.length ? boundsOfNodes(doc, members) : null
  let rect = { x: base.x, y: base.y, w: base.w, h: base.h }
  if (b) rect = expandToContain(rect, b)
  const out = Object.assign({}, base, rect, {
    group: true,
    children: members,
    text: base.text || '',
  })
  // 运行时标志（dragTmp）绝不出组数据（0.2.7 曾把 dragTmp 持久化进存储）
  delete out.dragTmp
  return out
}

// 新组接纳 members 后：从其它组（非 newGroup.id）的 children 中解除这些成员（唯一归属）。
// 返回 [{ id, children }] 供应用层写回。
export function unbindFromOthers(doc, newGroup) {
  const set = new Set(newGroup.children || [])
  const out = []
  for (const g of (doc.nodes || [])) {
    if (!isGroup(g) || g.id === newGroup.id) continue
    const kids = (g.children || []).filter((c) => !set.has(c))
    if (kids.length !== (g.children || []).length) out.push({ id: g.id, children: kids })
  }
  return out
}

// ---------- 唯一归属（容器树不变式：每个成员至多一个父组；歧义取嵌套最深者，同深取数组序先者） ----------

// 归属解析（纯函数，不修改输入）：返回 Map<nodeId, groupId>
// 规则：剔除自指/跨页引用/不存在节点；环上组的归属不生效（防祖孙环）
export function ownershipMap(nodes) {
  const list = nodes || []
  const byId = new Map(list.map((n) => [n.id, n]))
  const depthMemo = new Map()
  const depthOf = (id, stack) => {
    if (depthMemo.has(id)) return depthMemo.get(id)
    const n = byId.get(id)
    if (!n || !isGroup(n)) return 0
    const chain = stack || new Set()
    if (chain.has(id)) return -1
    chain.add(id)
    let d = 1
    for (const g of list) {
      if (isGroup(g) && (g.children || []).includes(id)) {
        const dd = depthOf(g.id, chain)
        if (dd >= 0) d = Math.max(d, 1 + dd)
      }
    }
    chain.delete(id)
    depthMemo.set(id, d)
    return d
  }
  const parent = new Map()
  let order = 0
  for (const g of list) {
    if (!isGroup(g)) continue
    const idx = order++
    const dg = depthOf(g.id)
    if (dg < 0) continue
    for (const c of g.children || []) {
      if (c === g.id) continue
      const cn = byId.get(c)
      if (!cn || cn.pageId !== g.pageId) continue
      const prev = parent.get(c)
      if (!prev || prev.depth < dg || (prev.depth === dg && prev.order > idx)) {
        parent.set(c, { groupId: g.id, depth: dg, order: idx })
      }
    }
  }
  // 环修复：父链回溯到自身 → 删除该绑定（断裂环，防止无限递归）
  for (const [c, p] of [...parent.entries()]) {
    let cur = c
    let guard = 0
    while (parent.has(cur) && guard++ < 4096) {
      cur = parent.get(cur).groupId
      if (cur === c) { parent.delete(c); break }
    }
  }
  const out = new Map()
  for (const [c, p] of parent) out.set(c, p.groupId)
  return out
}

// 归一化（返回新数组，不修改输入）：以 ownershipMap 重建各组 children（唯一归属 + 孤儿/自指/跨页清理）
// 返回 { nodes, fixes }；fixes = 被修正的 children 绑定数
export function applyOwnership(nodes) {
  const list = nodes || []
  const owned = ownershipMap(list)
  let fixes = 0
  const out = list.map((n) => {
    if (!isGroup(n)) return n
    const raw = n.children || []
    const kids = raw.filter((c) => owned.get(c) === n.id)
    if (kids.length !== raw.length) {
      fixes += raw.length - kids.length
      return Object.assign({}, n, { children: kids })
    }
    return n
  })
  return { nodes: out, fixes }
}

// 渲染顺序：先画组合（底层），再画普通控件（覆盖层）。
// 层（layer）= 该节点被多少层组链包裹（顶层组=0、其直接成员=1、嵌套成员递增）；
// 顶层普通节点与顶层组同层 0——同层时组优先（组底、普通后），其余按数组原序（稳定）。
export function sortForRender(nodes) {
  const chainDepth = (id, visited) => {
    if (visited.has(id)) return 0
    visited.add(id)
    let d = 0
    for (const g of nodes) {
      if (isGroup(g) && (g.children || []).includes(id)) {
        d = Math.max(d, 1 + chainDepth(g.id, visited))
      }
    }
    return d
  }
  return nodes.slice().map((n, i) => {
    const layer = chainDepth(n.id, new Set())
    return { n, i, layer, group: isGroup(n) ? 0 : 1 }
  }).sort((a, b) =>
    (a.layer - b.layer) || (a.group - b.group) || (a.i - b.i)
  ).map((x) => x.n)
}
