// dsh-flowchart components/common/ShapeSvg.js —— 形状描述子 → SVG 元素（节点渲染 + 缩略图共用）
import React from 'react'
import { shapeThumb } from '../../core/shapes.js'

const el = React.createElement

export function shapePartsToEls(parts, keyPrefix) {
  return parts.map((p, i) => {
    const props = Object.assign({}, p.attrs)
    return el(p.tag, { key: (keyPrefix || 's') + i, className: 'mm-shape-part', ...props })
  })
}

// 缩略图 SVG（ShapePicker 网格 + 右键形状菜单共用）
export function ShapeThumb(props) {
  const { shapeId, width, height, className } = props
  const t = shapeThumb(shapeId)
  return el('svg', {
    className: className || 'mm-shape-thumb',
    viewBox: t.viewBox,
    width: width || 56,
    height: height || 28,
    preserveAspectRatio: 'xMidYMid meet',
  }, shapePartsToEls(t.parts, shapeId + '-'))
}
