// dsh-mermaid components/inspector/PropField.js —— 注册表驱动通用表单（同 wf PropField 模式）
// def.desc：配置项解释 —— 显示在字段标题后的 ⓘ 图标上，hover 弹出 tooltip（portal 渲染到 body，
//           避免被右栏滚动容器裁剪）；字段本身不再占解释文字空间
import React from 'react'
import ReactDOM from 'react-dom'

const el = React.createElement

// ⓘ 信息图标 + hover 解释浮层（fixed 定位跟随图标上方；focus 键盘可达）
export function InfoTip(props) {
  const { text } = props
  const [tip, setTip] = React.useState(null)
  const show = (ev) => {
    const r = ev.currentTarget.getBoundingClientRect()
    setTip({ left: r.left + r.width / 2, top: r.top })
  }
  const hide = () => setTip(null)
  return el('span', {
    className: 'mm-info',
    tabIndex: 0,
    'aria-label': text,
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
  },
    'ⓘ',
    tip ? ReactDOM.createPortal(
      el('div', {
        className: 'mm-info-tip',
        style: { left: tip.left + 'px', top: tip.top + 'px', transform: 'translate(-50%, calc(-100% - 22px))' },
      }, text),
      document.body,
    ) : null,
  )
}

export function PropField(props) {
  const { def, value, onChange } = props
  const val = value !== undefined && value !== null ? value : def.default
  let control = null
  if (def.type === 'select') {
    control = el('select', {
      className: 'mm-select',
      value: String(val),
      onChange: (ev) => onChange(ev.target.value),
    },
      def.options.map((o) => el('option', { key: o, value: o }, o)),
    )
  } else if (def.type === 'boolean') {
    control = el('label', { className: 'mm-check' },
      el('input', {
        type: 'checkbox',
        checked: !!val,
        onChange: (ev) => onChange(ev.target.checked),
      }),
      val ? '开' : '关',
    )
  } else if (def.type === 'number') {
    control = el('input', {
      className: 'mm-input', type: 'number',
      value: val === '' ? '' : Number(val),
      onChange: (ev) => onChange(ev.target.value === '' ? '' : Number(ev.target.value)),
    })
  } else {
    control = el('input', {
      className: 'mm-input', type: 'text',
      value: val,
      onChange: (ev) => onChange(ev.target.value),
    })
  }
  return el('div', { className: 'mm-form-row' },
    el('div', { className: 'mm-form-label' },
      def.label,
      def.desc ? el(InfoTip, { text: def.desc }) : null,
    ),
    el('div', { className: 'mm-form-control' }, control),
  )
}
