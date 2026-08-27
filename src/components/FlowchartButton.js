// dsh-flowchart components/FlowchartButton.js —— 槽位按钮（宿主适配层：conversation.input.left）
// 使用 dsh 内置图标库（@deepseek-ai/dsh-client-ui-primitives），与 wf SketchButton 同构
import React from 'react'
import { IconBranchOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import { setOpen, getOpen, subscribe } from '../core/store.js'

const el = React.createElement

export function FlowchartButton() {
  const [open, setOpenState] = React.useState(getOpen())
  React.useEffect(() => subscribe(setOpenState), [])
  return el('button', {
    type: 'button',
    className: 'mm-input-btn' + (open ? ' mm-input-btn-on' : ''),
    title: open ? '关闭流程图画板' : '绘制 Mermaid 流程图：画布绘制，实时生成标准 Mermaid 代码插入输入框',
    'aria-pressed': open,
    'aria-label': '流程图',
    onClick: () => setOpen(!open),
  }, el(IconBranchOutline16, { size: 16 }))
}
