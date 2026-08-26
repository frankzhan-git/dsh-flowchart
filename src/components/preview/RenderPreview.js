// dsh-mermaid components/preview/RenderPreview.js —— 渲染预览（内置渲染器：插件内 mermaid.render，500ms 防抖）
import React from 'react'
import { renderMermaid } from '../../core/preview.js'
import { t } from '../../i18n/index.js'

const el = React.createElement

export function RenderPreview(props) {
  const { code, salt, showToast } = props
  const [state, setState] = React.useState({ loading: true, svg: '', error: '' })
  React.useEffect(() => {
    let alive = true
    setState({ loading: true, svg: '', error: '' })
    const timer = setTimeout(async () => {
      const r = await renderMermaid(code, salt)
      if (!alive) return
      if (r.ok) setState({ loading: false, svg: r.svg, error: '' })
      else setState({ loading: false, svg: '', error: r.error })
    }, 500)
    return () => { alive = false; clearTimeout(timer) }
  }, [code, salt])
  if (state.loading) return el('div', { className: 'mm-empty' }, t('renderLoading'))
  if (state.error) {
    return el('div', { className: 'mm-render-err' },
      t('previewError', { error: state.error }),
    )
  }
  return el('div', null,
    el('div', { className: 'mm-render-note' }, t('previewNote')),
    el('div', { className: 'mm-render-body', dangerouslySetInnerHTML: { __html: state.svg } }),
  )
}
