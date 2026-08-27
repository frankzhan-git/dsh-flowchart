// dsh-flowchart core/config-schema.js
// 职责：codegen 配置默认值表（非默认项才输出 front-matter）+ 透传位说明
// 面板仅提供业务语义设置（图命名/连线类型/标签）——排序/配色等呈现配置已从面板剔除，
// 但数据层与 codegen 完整保留（旧数据/高级透传仍正确输出）
// 导出：CONFIG_DEFAULTS / collectNonDefaultConfig

// 默认值集合（codegen 省略判定）
export const CONFIG_DEFAULTS = {
  theme: 'default',
  fontFamily: '',
  direction: 'TD',
  curve: 'basis',
  nodeSpacing: 50,
  rankSpacing: 50,
  padding: 8,
  useMaxWidth: true,
  htmlLabels: true,
}

// { docConfig, pageConfig } → 仅非默认项（浅层；config.advanced 透传位原样输出）
export function collectNonDefaultConfig(docConfig, pageConfig) {
  const doc = {}
  const flow = {}
  const src = Object.assign({}, docConfig || {}, pageConfig || {})
  for (const k of Object.keys(CONFIG_DEFAULTS)) {
    const v = src[k]
    if (v === undefined || v === null) continue
    if (String(v) === String(CONFIG_DEFAULTS[k])) continue
    if (k === 'theme' || k === 'fontFamily') doc[k] = v
    else if (k !== 'direction') flow[k] = v
  }
  return { doc, flow }
}
