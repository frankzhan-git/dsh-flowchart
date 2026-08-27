// dsh-flowchart core/model.js
// 职责：文档（Doc）/页面/节点/边 工厂 + id 分配 + 克隆 + 空文档（纯数据，零 React）
// 边界：不 import React/DSH；只依赖自身
// 导出：CANVAS_W/CANVAS_H/MAX_ELEMENTS/PASTE_OFFSET、nextId、reserveSeqs、
//       createPage/createNode/createEdge、cloneDoc、freshDoc、docStats

export const CANVAS_W = 800
export const CANVAS_H = 520
export const MAX_ELEMENTS = 300
export const PASTE_OFFSET = 24

// id 前缀：p=页面 / n=节点 / e=边（与 mermaid 代码内节点 id 一致；三命名空间独立）
const seqs = { p: 0, n: 0, e: 0 }
export function nextId(kind) {
  const k = kind && kind[0]
  if (k !== 'p' && k !== 'n' && k !== 'e') return 'n' + (++seqs.n)
  seqs[k] += 1
  return k + seqs[k]
}

// 载入既有文档后推进 id 序列：保证 nextId 与已载入元素 id 永不冲突
// （浏览器刷新后模块 seq 归零，复制粘贴/新建会产生重复 id——wf 历史事故的防御）
export function reserveSeqs(doc) {
  for (const p of (doc && doc.pages) || []) {
    const m = /^p(\d+)$/.exec(String((p && p.id) || ''))
    if (m) seqs.p = Math.max(seqs.p, Number(m[1]))
  }
  for (const n of (doc && doc.nodes) || []) {
    const m = /^n(\d+)$/.exec(String((n && n.id) || ''))
    if (m) seqs.n = Math.max(seqs.n, Number(m[1]))
  }
  for (const e of (doc && doc.edges) || []) {
    const m = /^e(\d+)$/.exec(String((e && e.id) || ''))
    if (m) seqs.e = Math.max(seqs.e, Number(m[1]))
  }
}

// 页面（= 一个 Mermaid 图）；config 为空对象表示全部使用默认值（codegen 仅输出非默认）
export function createPage(x, y, w, h, seq) {
  return {
    id: nextId('p'),
    type: 'flowchart',
    name: '页面' + (seq == null ? Math.max(seqs.p, 1) : seq),
    x, y, w, h,
    direction: 'TD',
    config: {},
  }
}

// 节点（= 一个 flowchart 形状）；text 为原文（\n 换行），转义由 codegen 负责
export function createNode(pageId, shape, x, y, w, h) {
  return {
    id: nextId('n'),
    pageId,
    shape: shape || 'rectangle',
    x, y, w, h,
    text: '',
  }
}

// 边（= 一条有向边）；锚点 = { side:'l'|'r'|'t'|'b', t:0..1 }（边 + 归一化位置）
export function createEdge(pageId, from, fromAnchor, to, toAnchor, kind) {
  return {
    id: nextId('e'),
    pageId,
    from, to,
    fromAnchor, toAnchor,
    label: '',
    kind: kind || 'solid',
  }
}

export function cloneDoc(doc) {
  // 文档为纯数据（无函数/引用），JSON 深拷贝即可
  return JSON.parse(JSON.stringify(doc))
}

// 新画布：预置一个默认 flowchart 页面（页面外绘制 = 新建页面；页面内 = 节点）
export function freshDoc() {
  const page = createPage(20, 20, 760, 480, 1)
  page.name = '页面1'
  return {
    pages: [page],
    nodes: [],
    edges: [],
    config: { theme: 'default', fontFamily: '' },
  }
}

// 统计（meta 用）
export function docStats(doc) {
  return {
    elementCount: (doc.nodes ? doc.nodes.length : 0) + (doc.edges ? doc.edges.length : 0),
    hasMedia: false,
  }
}

// 页面最小尺寸（创建时防呆）
export const PAGE_MIN = { w: 200, h: 120 }
