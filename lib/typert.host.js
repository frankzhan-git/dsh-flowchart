// dsh-mermaid 宿主线协议贡献（gateway 严格路径）：ctx.typert.register(TYPERT_HOST)
// invocations 与客户端 remote contribution 的 descriptors 共用单一来源（lib/wire.js）
import { MM_INVOCATIONS } from './wire.js'

export const TYPERT_HOST = {
  package: 'dsh-mermaid',
  face: 'host',
  model: { name: 'dsh-mermaid', description: 'Mermaid 流程图库存储服务（CanvasStore 契约）' },
  schemas: [],
  invocations: MM_INVOCATIONS,
}

export default TYPERT_HOST
