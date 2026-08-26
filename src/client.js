// dsh-mermaid client half —— 正式插件入口（esbuild 构建为 ModuleLoader bundle）
// 装配层：样式注入 + 两个槽位注册 + 官方 @Remote 网关挂载（P6：DSH 知识仅在此层）
// 入口位置：会话输入框工具行左端（conversation.input.left）+ 输入框浮层（conversation.input.overlay）
import React from 'react'
import { MM_CSS } from './css/index.js'
import { MermaidButton } from './components/MermaidButton.js'
import { MermaidModal } from './components/MermaidModal.js'
import { mermaidRemoteContribution, createDomainRemote } from './core/storage/remote.js'
import { defaultStore } from './core/storage/index.js'

const el = React.createElement

export default {
  name: 'dsh-mermaid',
  async apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return

    const styleEl = document.createElement('style')
    styleEl.textContent = MM_CSS
    document.head.appendChild(styleEl)
    ctx.effect(() => () => { if (styleEl.parentNode) styleEl.parentNode.removeChild(styleEl) })

    // 官方 @Remote 网关挂载（异步；失败 → 降级 localStorage，不阻塞槽位注册）
    const remote = ctx.get('remote')
    if (remote) {
      try {
        const dispose = await remote.$mount(mermaidRemoteContribution)
        ctx.effect(() => () => { dispose() })
        defaultStore(createDomainRemote(remote))
      } catch (e) { /* 挂载失败 → 保持 localStorage 兜底 */ }
    }

    // 输入框工具行左端的小按钮（order 5）
    slots.inject('conversation.input.left', () => slots.register(
      { name: 'conversation.input.left', id: 'mm-button', order:5, label: '流程图' },
      () => el(MermaidButton, null),
    ))

    // 画板浮层：锚定输入框区域的浮动层，关闭时渲染 null
    slots.inject('conversation.input.overlay', () => slots.register(
      { name: 'conversation.input.overlay', id: 'mm-panel', order: 5 },
      (props) => el(MermaidModal, props),
    ))
  },
}
