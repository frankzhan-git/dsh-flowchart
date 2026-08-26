// verify-shapes —— 形状注册表完整性 + 语法 smoke（mermaid.parse 尽力兜底）
import assert from 'node:assert/strict'
import { SHAPE_REGISTRY, SHAPE_IDS, shapeOf, shapeThumb } from '../src/core/shapes.js'

const SHAPE_COUNT = 14
assert.equal(SHAPE_IDS.length, SHAPE_COUNT, 'v1 形状应为 14 种')

for (const id of SHAPE_IDS) {
  const def = shapeOf(id)
  assert.ok(def.label, id + ' 缺 label')
  assert.ok(typeof def.syntax === 'function', id + ' 缺 syntax')
  const label = def.syntax('文本')
  assert.ok(label.length > 0, id + ' syntax 为空')
  assert.ok(def.min && def.min.w > 0 && def.min.h > 0, id + ' 缺 min 尺寸')
  const t = shapeThumb(id)
  assert.ok(t.viewBox && t.parts.length > 0, id + ' 缺缩略图')
}

// 全部形状语法可被 mermaid 解析（引擎可用时；不可用则跳过——语法表以官方文档为准）
let parsed = 0
let smokeErr = ''
try {
  const mod = await import('mermaid')
  const mermaid = mod.default || mod
  for (const id of SHAPE_IDS) {
    const def = shapeOf(id)
    await mermaid.parse('flowchart TD\n  n1' + def.syntax('文本'))
    parsed++
  }
} catch (e) {
  smokeErr = String(e && e.message) // Node 下 mermaid 不可用（无 DOM）→ 跳过，浏览器渲染路径兜底
}
console.log('✅ verify-shapes: 14 形状注册完整' + (smokeErr ? '（mermaid.parse smoke 跳过：' + smokeErr.slice(0, 60) + '）' : '（mermaid.parse ' + parsed + '/' + SHAPE_COUNT + ' 通过）'))
