// dsh-flowchart host half —— 正式 Cordis 插件入口（命名空间目录存储 + Typert Remote 网关）
// 存储介质：宿主半 node:fs 自管目录文件（每画布一个 JSON，原子写：临时文件 + fsync + rename）
//   → 数据落 <DSH 数据根>/storages/dsh-flowchart/{MANIFEST.json, canvases/{canvasId}.json}
//     （唯一命名空间目录 + 清单 + 分层子目录；旧 storages/mermaid-canvases/ 启动自动迁移）
// 传输：ctx.typert.register(TYPERT_HOST) 严格描述符（zod 线协议校验）+ ctx.provide('flowchartStorage')
//   + bindTypertRemote → 浏览器经 api-gateway 以 remote.flowchartStorage.* 调用（官方 @Remote 范式）
// 生命周期：ctx.effect 注册 typert 卸载 + service.close
// 依赖可选（ctx.get）：非 web profile（无 typert）时宿主半无效果，client 自动降级 localStorage
import { homedir } from 'node:os'
import { join } from 'node:path'
import { bindTypertRemote } from '@deepseek-ai/dsh-typert-protocol'
import { createFlowchartService } from './flowchart-service.js'
import { TYPERT_HOST } from './typert.host.js'

export default {
  name: 'dsh-flowchart',
  apply(ctx) {
    const typert = ctx.get('typert')
    if (typert === undefined) return

    const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh')
    const storagesRoot = join(dshHome, 'storages')

    ctx.effect(async () => {
      const service = await createFlowchartService({ storagesRoot })

      // 服务注册（fiber 生命周期内）+ 网关绑定 + 严格描述符（gateway 发现 flowchartStorage/* 端点）
      ctx.provide('flowchartStorage', service)
      bindTypertRemote(service, 'flowchartStorage')
      const disposeTypert = typert.register(TYPERT_HOST)

      return async () => {
        disposeTypert()
        await service.close().catch(() => {})
      }
    }, 'flowchart-storage')
  },
}
