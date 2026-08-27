// dsh-flowchart core/storage/integrity.js
// 职责：P5 容错——sanitizeDoc 逐记录清洗（非法丢弃并计数）；isValidMeta 列表条目校验
// 边界：读取路径永不抛（解析失败由适配器/宿主层隔离）
const SIDES = ['l', 'r', 't', 'b']
const SHAPES = ['rectangle', 'rounded', 'stadium', 'subroutine', 'cylinder', 'circle', 'doubleCircle',
  'asymmetric', 'diamond', 'hexagon', 'parallelogram', 'parallelogramAlt', 'trapezoid', 'trapezoidAlt']

function clamp01(v) { return typeof v === 'number' ? Math.max(0, Math.min(1, v)) : 0.5 }

function cleanAnchor(a) {
  if (!a || typeof a !== 'object') return null
  const side = SIDES.indexOf(a.side) === -1 ? 'r' : a.side
  return { side, t: clamp01(a.t) }
}

export function sanitizeDoc(raw) {
  const pages = []
  const nodes = []
  const edges = []
  let dropped = 0
  if (raw && typeof raw === 'object') {
    for (const p of Array.isArray(raw.pages) ? raw.pages : []) {
      if (p && typeof p === 'object' && typeof p.id === 'string' && p.id &&
        typeof p.x === 'number' && typeof p.y === 'number' && typeof p.w === 'number' && typeof p.h === 'number') {
        pages.push(Object.assign({}, p, { type: typeof p.type === 'string' ? p.type : 'flowchart', config: p.config && typeof p.config === 'object' ? p.config : {} }))
      } else dropped++
    }
    for (const n of Array.isArray(raw.nodes) ? raw.nodes : []) {
      if (n && typeof n === 'object' && typeof n.id === 'string' && n.id &&
        typeof n.pageId === 'string' && typeof n.x === 'number' && typeof n.y === 'number' &&
        typeof n.w === 'number' && typeof n.h === 'number') {
        nodes.push(Object.assign({}, n, { shape: SHAPES.indexOf(n.shape) === -1 ? 'rectangle' : n.shape, text: typeof n.text === 'string' ? n.text : '' }))
      } else dropped++
    }
    for (const e of Array.isArray(raw.edges) ? raw.edges : []) {
      if (e && typeof e === 'object' && typeof e.id === 'string' && e.id &&
        typeof e.pageId === 'string' && typeof e.from === 'string' && typeof e.to === 'string') {
        edges.push(Object.assign({}, e, {
          fromAnchor: cleanAnchor(e.fromAnchor),
          toAnchor: cleanAnchor(e.toAnchor),
          label: typeof e.label === 'string' ? e.label : '',
          kind: ['solid', 'dotted', 'thick', 'open'].indexOf(e.kind) === -1 ? 'solid' : e.kind,
        }))
      } else dropped++
    }
  }
  // 引用完整性：孤儿节点归属（pageId 不存在 → 中心在页面内则归该页，否则归首页）——
  // 防止「无页面归属的节点不受钳制、任意漂移」（控件飞到其它页面的根因防御）
  for (const n of nodes) {
    if (pages.some((p) => p.id === n.pageId)) continue
    const cx = n.x + n.w / 2
    const cy = n.y + n.h / 2
    const owner = pages.find((p) => cx >= p.x && cx <= p.x + p.w && cy >= p.y && cy <= p.y + p.h)
    if (owner) n.pageId = owner.id
    else if (pages.length) n.pageId = pages[0].id
  }
  // 引用完整性：孤儿边剔除（节点缺失）防「代码生成停滞」与渲染越界
  const kept = []
  for (const e of edges) {
    if (nodes.some((n) => n.id === e.from) && nodes.some((n) => n.id === e.to)) kept.push(e)
    else dropped++
  }
  return {
    doc: {
      pages, nodes, edges: kept,
      config: raw && raw.config && typeof raw.config === 'object' ? raw.config : { theme: 'default', fontFamily: '' },
    },
    dropped,
  }
}

export function isValidMeta(m) {
  return !!(m && typeof m === 'object' &&
    typeof m.id === 'string' && m.id &&
    typeof m.name === 'string' &&
    typeof m.updatedAt === 'string')
}
