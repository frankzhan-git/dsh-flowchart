// dsh-mermaid core/preview.js —— 渲染预览（内置渲染器：mermaid 内联进插件 bundle，随插件离线可用）
// 边界：仅 client 侧使用（esbuild 内联 mermaid）
// 错误洁净：mermaid.render 失败时残留临时 DOM 一并移除
// 关键：渲染 id 每次唯一（mermaid.render 对重复 id 抛 "already exists" 错误 → 预览反复失败）
import mermaid from 'mermaid'

let inited = false
let seq = 0

export function setupMermaid() {
  if (inited) return
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'default',
    fontFamily: 'Consolas, "Cascadia Code", Menlo, monospace',
  })
  inited = true
}

// 渲染：成功 → { ok:true, svg }；失败 → { ok:false, error }（绝不抛）
export async function renderMermaid(code, salt) {
  setupMermaid()
  const id = 'mm-' + (salt || 'x') + '-' + (++seq)
  try {
    const r = await mermaid.render(id, code)
    cleanupTemp(id)
    return { ok: true, svg: (r && r.svg) || '' }
  } catch (e) {
    cleanupTemp(id)
    const msg = e && e.message ? e.message : (e ? String(e) : '渲染失败')
    return { ok: false, error: msg }
  }
}

function cleanupTemp(id) {
  try {
    const el = document.getElementById(id)
    if (el && el.parentNode) el.parentNode.removeChild(el)
  } catch (e) { /* 尽力 */ }
}
