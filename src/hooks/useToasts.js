// dsh-mermaid hooks/useToasts.js —— 浮动提示（3s 自消）
import React from 'react'

export function useToasts(open) {
  const [toast, setToast] = React.useState(null)
  const timer = React.useRef(null)
  const showToast = React.useCallback((text, type) => {
    if (timer.current) clearTimeout(timer.current)
    setToast({ text, type: type || 'info' })
    timer.current = setTimeout(() => setToast(null), 3000)
  }, [])
  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  React.useEffect(() => { if (!open) setToast(null) }, [open])
  return { toast, showToast }
}
