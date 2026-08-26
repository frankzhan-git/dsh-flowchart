// dsh-mermaid components/preview/CodeView.js —— Mermaid 代码视图（只读 + 轻量高亮，无 dangerouslySetInnerHTML）
import React from 'react'

const el = React.createElement

function renderLine(line, i) {
  if (/^\s*%%/.test(line)) return el('div', { key: i, className: 'mm-code-cm' }, line)
  const parts = line.split(/(-->|-.->|==>|---|--)/g)
  if (parts.length > 1) {
    return el('div', { key: i }, parts.map((p, j) =>
      /^(-->|-.->|==>|---|--)$/.test(p)
        ? el('span', { key: j, className: 'mm-code-st' }, p)
        : p))
  }
  if (/^\s*flowchart\b/.test(line)) return el('div', { key: i, className: 'mm-code-h1' }, line)
  if (/^\s*(---|config:)/.test(line)) return el('div', { key: i, className: 'mm-code-kw' }, line)
  return el('div', { key: i }, line)
}

export function CodeView(props) {
  const { code, issues } = props
  if (!code) {
    return el('pre', { className: 'mm-codeview' }, '（空）')
  }
  return el('div', null,
    issues && issues.length ? el('div', { className: 'mm-hint', style: { margin: '0 0 6px' } },
      issues.map((i) => i.text + ' ').join('；')) : null,
    el('pre', { className: 'mm-codeview' },
      code.split('\n').map(renderLine)),
  )
}
