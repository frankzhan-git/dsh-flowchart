// dsh-flowchart components/common/HoverTip.js —— 通用 hover 浮窗（业务语义解释）
// 包裹任意子元素：鼠标划入（或键盘 focus）在元素上方弹出说明浮层；
// portal 渲染到 body + fixed 定位（不被滚动容器裁剪），展示内容不拦截点击
// 注意：包裹层必须有盒模型（禁用 display:contents——rect 为零会使浮窗定位失效）
import React from 'react'
import ReactDOM from 'react-dom'

const el = React.createElement

export function HoverTip(props) {
  const { text, children, className } = props
  const [tip, setTip] = React.useState(null)
  const show = (ev) => {
    const r = ev.currentTarget.getBoundingClientRect()
    setTip({ left: r.left + r.width / 2, top: r.top })
  }
  const hide = () => setTip(null)
  return el('span', {
    className: className || 'mm-hover-tip',
    tabIndex: 0,
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
  },
    children,
    tip ? ReactDOM.createPortal(
      el('div', {
        className: 'mm-info-tip',
        style: { left: tip.left + 'px', top: tip.top + 'px', transform: 'translate(-50%, calc(-100% - 20px))' },
      }, text),
      document.body,
    ) : null,
  )
}
