// dsh-flowchart client half —— 正式插件入口（esbuild 构建为 ModuleLoader bundle）
// 装配层：样式注入 + 两个槽位注册 + 官方 @Remote 网关挂载（P6：DSH 知识仅在此层）
// 入口位置：会话输入框工具行左端（conversation.input.left）+ 输入框浮层（conversation.input.overlay）
//
// 存储装配规范（v0.2.4，与 DSH 内部插件一致）：
//   1) 本插件 apply 内 await ctx.remote.$mount(contribution)——api-gateway 会把每个命名空间注册为
//      cordis 服务 "remote.<namespace>"（RemoteNamespaceService）；
//   2) 消费命名空间必须走「驻扎插件」：声明 inject: ['remote.flowchartStorage'] 由 cordis 将命名空间
//      注入（等待其就绪），而非直接 remote.flowchartStorage 属性访问（那会命中 cordis 的
//      "cannot get property ... without inject" 守卫，宿主存储永远无法激活）。
import React from 'react'
import { MM_CSS } from './css/index.js'
import { FlowchartButton } from './components/FlowchartButton.js'
import { FlowchartModal } from './components/FlowchartModal.js'
import { flowchartRemoteContribution } from './core/storage/remote.js'
import { defaultStore, reportMountError } from './core/storage/index.js'

const el = React.createElement

export default {
  name: 'dsh-flowchart',
  inject: ['remote'],
  async apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return

    const styleEl = document.createElement('style')
    styleEl.textContent = MM_CSS
    document.head.appendChild(styleEl)
    ctx.effect(() => () => { if (styleEl.parentNode) styleEl.parentNode.removeChild(styleEl) })

    // 挂载贡献（命名空间服务随后由 gateway 注册）；失败原因上屏（防静默）
    try {
      const dispose = await ctx.remote.$mount(flowchartRemoteContribution)
      ctx.effect(() => () => { dispose() })
    } catch (e) {
      reportMountError(e && e.message ? e.message : String(e))
    }

    // 驻扎插件：命名空间服务就绪即在页面生命周期内接管存储装配（不再是"一次性探测"）。
    // v0.2.5：命名空间服务对象直传 domainAdapter（官方消费范式 = 位置参数直调 remote.<ns>.*）
    ctx.plugin({
      name: 'dsh-flowchart-store',
      inject: ['remote.flowchartStorage'],
      apply: (storeCtx) => {
        try {
          const ns = storeCtx.get('remote.flowchartStorage')
          reportMountError(null)
          defaultStore(ns)
        } catch (e) {
          reportMountError(e && e.message ? e.message : String(e))
        }
      },
    })

    // 输入框工具行左端的小按钮（order 5）
    slots.inject('conversation.input.left', () => slots.register(
      { name: 'conversation.input.left', id: 'mm-button', order:5, label: '流程图' },
      () => el(FlowchartButton, null),
    ))

    // 画板浮层：锚定输入框区域的浮动层，关闭时渲染 null
    slots.inject('conversation.input.overlay', () => slots.register(
      { name: 'conversation.input.overlay', id: 'mm-panel', order: 5 },
      (props) => el(FlowchartModal, props),
    ))
  },
}
