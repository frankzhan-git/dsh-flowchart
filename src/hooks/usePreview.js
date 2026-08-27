// dsh-flowchart hooks/usePreview.js —— 派生：doc → 每页 Mermaid 代码 + issues（P4 纯函数 + memo）
import React from 'react'
import { buildResult } from '../core/pipeline.js'

export function usePreview(doc) {
  return React.useMemo(() => buildResult(doc), [doc])
}
