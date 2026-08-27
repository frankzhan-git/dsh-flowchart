// dsh-flowchart host half —— 正式 Cordis 插件入口（命名空间目录存储 + Typert Remote 网关）
// 存储介质：宿主半 node:fs 自管目录文件（每画布一个 JSON，原子写：临时文件 + fsync + rename）
//   → 数据落 <DSH 数据根>/storages/dsh-flowchart/{MANIFEST.json, canvases/{canvasId}.json}
//     （唯一命名空间目录 + 清单 + 分层子目录；旧 storages/mermaid-canvases/ 启动自动迁移）
// 传输：ctx.typert.register(TYPERT_HOST) 严格描述符（zod 线协议校验）+ ctx.provide('flowchartStorage')
//   + bindTypertRemote → 浏览器经 api-gateway 以 remote.flowchartStorage.* 调用（官方 @Remote 范式）
// 生命周期：ctx.effect 注册 typert 卸载 + service.close
// 激活契约（v0.2.3 修复）：inject: ['typert'] 声明硬依赖——插件行会等待 typert 服务出现后才 apply，
//   不再用 ctx.get('typert') 可选读取（该写法若在 typert 就绪前 apply 会静默 return，宿主半永不生效、
//   客户端随之静默降级 localStorage，数据全部留在浏览器本地——「跨端口看不到数据」的直接根因）。
//   效果体内部失败一律 ctx.logger.warn 明示（不做静默吞错）。
import { homedir } from 'node:os'
import { join } from 'node:path'
import { appendFileSync } from 'node:fs'
import { createFlowchartService, NAMESPACE } from './flowchart-service.js'
import { TYPERT_HOST } from './typert.host.js'

// 激活痕迹（诊断）：写入命名空间目录 .activate.log——重启后无需看控制台即可确定激活路径
// （apply 开始 / 注册成功 / 失败原因），失败不再无声无息
function trace(storagesRoot, line) {
  try {
    appendFileSync(join(storagesRoot, NAMESPACE, '.activate.log'),
      new Date().toISOString() + ' ' + line + '\n')
  } catch (e) { /* 痕迹写入失败不阻断激活 */ }
}

export default {
  name: 'dsh-flowchart',
  inject: ['typert'],
  apply(ctx) {
    const { typert } = ctx
    const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh')
    const storagesRoot = join(dshHome, 'storages')
    trace(storagesRoot, 'apply: inject=typert 已就绪，开始激活')

    ctx.effect(async () => {
      try {
        const service = await createFlowchartService({ storagesRoot })

        // 服务注册（fiber 生命周期内）+ 严格描述符（gateway 发现 flowchartStorage/* 端点）
        // v0.2.5 装配收敛：typertRemote 绑定已内聚到服务自身（createFlowchartService 构造时完成）
        ctx.provide('flowchartStorage', service)
        const disposeTypert = typert.register(TYPERT_HOST)
        trace(storagesRoot, 'registered: flowchartStorage 已注册（' + storagesRoot + '）')
        ctx.logger.info('[dsh-flowchart] 宿主存储已注册: ' + storagesRoot)

        return async () => {
          disposeTypert()
          await service.close().catch((e) => {
            ctx.logger.warn('[dsh-flowchart] storage close failed: ' + (e && e.message ? e.message : e))
          })
        }
      } catch (e) {
        // 激活失败明示（如 createFlowchartService init 异常、typert.register 校验拒绝）——
        // 不再静默，控制台 + 磁盘痕迹双可见；客户端由此降级 localStorage
        const msg = e && e.message ? e.message : String(e)
        trace(storagesRoot, 'failed: ' + msg)
        ctx.logger.warn('[dsh-flowchart] 宿主存储激活失败（客户端将降级 localStorage）: ' + msg)
        throw e
      }
    }, 'flowchart-storage')
  },
}
