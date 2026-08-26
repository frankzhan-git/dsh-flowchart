// dsh-mermaid components/common/Toast.js —— 浮动提示（纯展示）
import React from 'react'

const el = React.createElement

export function Toast(props) {
  const { toast } = props
  if (!toast) return null
  const cls = 'mm-toast' + (toast.type === 'error' ? ' mm-toast-error' : toast.type === 'warn' ? ' mm-toast-warn' : '')
  return el('div', { className: cls }, toast.text)
}
