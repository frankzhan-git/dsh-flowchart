// dsh-flowchart core/storage/remote.js —— 客户端 Remote 贡献（唯一职责：$mount 输入的 contribution）
// descriptors 与宿主 typert.host.js 的 invocations 共用单一来源（lib/wire.js）。
// 消费规范（v0.2.5 重构）：命名空间服务经「驻扎插件」（inject: ['remote.flowchartStorage']）注入，
// 直接传给 domainAdapter 按官方位置参数范式调用；本文件不再持有任何 RPC 封装层。
import { MM_INVOCATIONS } from '../../../lib/wire.js'

export const flowchartRemoteContribution = { package: 'dsh-flowchart', descriptors: MM_INVOCATIONS }
