// dsh-flowchart core/codegen.js —— 代码一等公民（C1：任何状态 → 合法可解析代码）
// 管线：normalize（转义/孤儿边剔除/未知形状回退/id sanitize）→ serialize（注册表语法）→ validate（可解析自检；mermaid.parse 由 verify 兜底）
// 边界：零 React/DSH；只依赖 shapes/edge-kinds/config-schema；输出字符串可单测
// 导出：buildMermaidDoc / buildPageCode / escapeLabel / buildInsertText / sanitizeNodeId / escapeText
import { shapeOf } from './shapes.js'
import { edgeKindOf } from './edge-kinds.js'
import { CONFIG_DEFAULTS, collectNonDefaultConfig } from './config-schema.js'
import { pageTypeOf } from './page-types.js'

// ---------- normalize ----------

export function sanitizeNodeId(id) {
  const s = String(id == null ? 'n' : id).replace(/[^A-Za-z0-9_-]/g, '')
  return s || 'n'
}

// 标签转义：引号 → #quot;；\n → <br/>（htmlLabels 默认 true；false 时保留换行字面量）；恒引号包裹
// 空文本 → '" "'（mermaid 解析空字符串 label 会报 SQE 语法错误；单空格是合法的空标签）
export function escapeLabel(text, htmlLabels) {
  let s = String(text == null ? '' : text)
  if (s === '') return '" "'
  s = s.replace(/"/g, '#quot;')
  if (htmlLabels !== false) s = s.replace(/\r/g, '').replace(/\n/g, '<br/>')
  return '"' + s + '"'
}

// 边标签（同转义；仅用于 -- label --> 段）
export function escapeText(text) {
  return String(text == null ? '' : text)
}

// ---------- serialize ----------

// 单页代码：front-matter（仅非默认配置）+ 图头 + 节点语句 + 边语句
export function buildPageCode(page, doc) {
  const issues = []
  const pageId = page && page.id
  const htmlLabels = !(page && page.config && page.config.htmlLabels === false)
  const nodes = (doc.nodes || []).filter((n) => n.pageId === pageId)
  const edges = (doc.edges || []).filter((e) => e.pageId === pageId)

  // 归一化（C1）：未知形状回退矩形；孤儿边剔除记 issue；id sanitize
  const nodeById = new Map()
  const lines = []
  for (const n of nodes) {
    const shape = shapeOf(n.shape)
    const id = sanitizeNodeId(n.id)
    nodeById.set(id, n.id)
    lines.push('    ' + id + shape.syntax(escapeLabel(n.text, htmlLabels)))
  }
  for (const e of edges) {
    const from = sanitizeNodeId(e.from)
    const to = sanitizeNodeId(e.to)
    if (!nodeById.has(from) || !nodeById.has(to)) {
      issues.push({ level: 'warn', text: '箭头的端点节点不存在，已跳过（' + from + ' → ' + to + '）' })
      continue
    }
    const label = typeof e.label === 'string' && e.label.length ? escapeLabel(e.label, htmlLabels) : null
    lines.push('    ' + edgeLine(from, to, e.kind, label))
  }

  // 空页面：不输出（节点/边均为空 → 无图内容）
  if (!nodes.length && !edges.length) {
    issues.push({ level: 'info', text: '页面「' + (page.name || '未命名') + '」为空，未生成代码' })
    return { code: '', issues }
  }

  const dir = ((page && page.direction) || 'TD') === 'TB' ? 'TD' : ((page && page.direction) || 'TD')
  const header = 'flowchart ' + dir

  // front-matter：标题（页面名 = 图命名）+ 仅非默认配置
  const { doc: dcfg, flow } = collectNonDefaultConfig(doc.config, page.config)
  const fm = buildFrontMatter(dcfg, flow, page && page.name)
  const blocks = []
  if (fm) blocks.push(fm)
  blocks.push(header)
  const code = blocks.join('\n') + '\n' + lines.join('\n')
  return { code, issues }
}

function edgeLine(from, to, kindId, label) {
  const k = edgeKindOf(kindId)
  if (label) return from + k.conn(label)[0] + label + k.conn(label)[1] + to
  return from + k.conn(null)[0] + to
}

// front-matter：title（mermaid 官方支持，渲染时作为图标题显示）+ config（仅非默认项）
function buildFrontMatter(docCfg, flow, title) {
  const dkeys = Object.keys(docCfg)
  const fkeys = Object.keys(flow)
  const hasTitle = typeof title === 'string' && title.trim().length > 0
  if (!dkeys.length && !fkeys.length && !hasTitle) return ''
  const lines = ['---']
  if (hasTitle) lines.push('title: ' + yamlScalar(title.trim()))
  if (dkeys.length || fkeys.length) {
    lines.push('config:')
    for (const k of dkeys) lines.push('  ' + k + ': ' + yamlScalar(docCfg[k]))
    if (fkeys.length) {
      lines.push('  flowchart:')
      for (const k of fkeys) lines.push('    ' + k + ': ' + yamlScalar(flow[k]))
    }
  }
  lines.push('---')
  return lines.join('\n')
}

function yamlScalar(v) {
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'string' && /^[A-Za-z0-9_\-./]*$/.test(v)) return v
  return JSON.stringify(v)
}

// ---------- 文档级 ----------

// 每页一个图块；空页跳过并记 issue（C1：只有非空页进入产出）
export function buildMermaidDoc(doc) {
  const issues = []
  const pages = []
  for (const page of (doc.pages || [])) {
    const r = buildPageCode(page, doc)
    const pageIssues = r.issues || []
    if (r.code) {
      pages.push({ pageId: page.id, name: page.name || '未命名', code: r.code, issues: pageIssues })
    }
    for (const i of pageIssues) issues.push(Object.assign({ pageId: page.id }, i))
  }
  return { pages, issues }
}

// ---------- 插入文本（Q5 方案 A：引导语 + 代码块；withNote=false → 仅代码） ----------

export const INSERT_NOTE = '按以下 Mermaid 流程图理解结构，并据此完成我的需求：'

export function buildInsertText(pages, withNote) {
  const out = []
  if (withNote !== false) out.push(INSERT_NOTE)
  for (const p of pages) out.push('```mermaid\n' + p.code + '\n```')
  return out.join('\n\n')
}

// ---------- 校验辅助（verify 用；运行时 mermaid.parse 由 preview 层承接） ----------

// 基本结构自检：引号配对、括号配对、无空行残缺（verify-codegen 断言；mermaid.parse 兜底）
export function syntaxCheck(code) {
  let quoted = false
  let depth = 0
  for (const ch of code) {
    if (ch === '"') quoted = !quoted
    else if (!quoted) {
      if (ch === '[' || ch === '(' || ch === '{') depth++
      else if (ch === ']' || ch === ')' || ch === '}') depth--
      if (depth < 0) return false
    }
  }
  return !quoted && depth === 0
}

export { CONFIG_DEFAULTS, pageTypeOf }
