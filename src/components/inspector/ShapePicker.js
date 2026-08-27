// dsh-flowchart components/inspector/ShapePicker.js —— 14 形状缩略图网格（右键「更换形状」级联菜单）
// 紧凑尺寸：32×16 缩略图、4 列网格、无文字标签（hover title 显示中文名），减少视觉噪音
import React from 'react'
import { SHAPE_IDS, shapeOf } from '../../core/shapes.js'
import { ShapeThumb } from '../common/ShapeSvg.js'

const el = React.createElement

export function ShapePicker(props) {
  const { value, onPick } = props
  return el('div', { className: 'mm-shape-grid' },
    SHAPE_IDS.map((id) => {
      const on = id === value
      return el('div', {
        key: id,
        className: 'mm-shape-cell' + (on ? ' mm-shape-cell-on' : ''),
        title: shapeOf(id).label,
        onClick: () => onPick(id),
      },
        el(ShapeThumb, { shapeId: id, width: 32, height: 16 }),
      )
    }),
  )
}
