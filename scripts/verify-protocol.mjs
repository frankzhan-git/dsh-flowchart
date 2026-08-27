// dsh-flowchart scripts/verify-protocol.mjs —— Typert 线协议回归护栏（v0.2.3）
// 背景：插件宿主半曾用 ctx.get('typert') 可选读取——typert 未就绪时静默 return，宿主半永不生效、
//       客户端静默降级 localStorage（数据全部留在浏览器本地，跨端口不可见）。
// 本护栏断言：
//   1) 宿主插件的 typert 依赖是硬依赖（inject: ['typert']）——loader 会等待而非静默跳过
//   2) 宿主贡献符合 rc.2 TypertContribution 形状（package/face/schemas/model/invocations）
//   3) 每个 invocation 描述符满足运行时 validateInvocation 规则（id/service/namespace/method/parameters/codec）
//   4) 客户端贡献 { package, descriptors } 与宿主 invocations 同源一致
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

let fails = 0
const ok = (cond, msg) => {
  if (cond) console.log('  ✅ ' + msg)
  else { fails += 1; console.error('  ❌ ' + msg) }
}

// ---------- 1) 宿主插件入口：inject 硬依赖 ----------
console.log('✅ verify-protocol: 宿主入口激活契约')
const hostPlugin = (await import('../lib/index.js')).default
const inject = hostPlugin.inject || []
ok(Array.isArray(inject) && inject.includes('typert'),
  '宿主插件声明 inject: ["typert"]（不可静默跳过——typert 就绪前 loader 等待而非返回）')

// ---------- 2) 宿主贡献形状（rc.2 TypertContribution） ----------
console.log('✅ verify-protocol: 宿主贡献形状')
const { TYPERT_HOST } = await import('../lib/typert.host.js')
ok(typeof TYPERT_HOST.package === 'string' && TYPERT_HOST.package.length > 0,
  'package 非空: ' + TYPERT_HOST.package)
ok(TYPERT_HOST.face === 'host' || TYPERT_HOST.face === 'client', 'face ∈ {host, client}')
ok(Array.isArray(TYPERT_HOST.schemas), 'schemas 数组')
ok(TYPERT_HOST.model && typeof TYPERT_HOST.model === 'object', 'model 对象')
ok(Array.isArray(TYPERT_HOST.invocations) && TYPERT_HOST.invocations.length > 0,
  'invocations 数组非空')

// ---------- 3) 每个 invocation 满足运行时 validateInvocation ----------
console.log('✅ verify-protocol: invocation 描述符（与运行时 validateInvocation 同规则）')
const WIRE_RE = /^[A-Za-z0-9_$.-]+$/
// 客户端 api-gateway RemoteNamespaceService 保留名（字段 + 原型方法）：远程方法不得与之同名
const NAMESPACE_RESERVED = new Set([
  'ctx', 'empty', 'invokeRemote', 'methods', 'name', 'namespace',
  'assertMethodAvailable', 'has', 'install', 'installDirect', 'installScoped', 'remove',
])
const validateCodec = (codec, subject) => {
  if (!codec || typeof codec !== 'object') return subject + ': codec 缺失'
  if (codec.mode === 'src-json') return null
  if (!codec.typeSymbol || codec.typeSymbol.length === 0) return subject + ': typeSymbol 缺失'
  if (typeof codec.schema?.parse !== 'function') return subject + ': schema 无 parse()'
  return null
}
for (const inv of TYPERT_HOST.invocations) {
  const tag = inv.id || '(no id)'
  const errors = []
  if (!inv.id || inv.id.length === 0) errors.push('id 非空')
  if (!inv.service || inv.service.includes('#') || inv.service.length === 0) errors.push('service 段非法')
  if (!WIRE_RE.test(inv.namespace || '')) errors.push('namespace 非法')
  if (!WIRE_RE.test(inv.method || '')) errors.push('method 非法')
  if (inv.implementation !== undefined && !WIRE_RE.test(inv.implementation)) errors.push('implementation 非法')
  const codecErr = validateCodec(inv.result, tag + ' result')
  if (codecErr) errors.push(codecErr)
  const wires = new Set()
  for (const p of inv.parameters || []) {
    if (!WIRE_RE.test(p.name || '')) errors.push('parameter name 非法')
    if (!WIRE_RE.test(p.wire || '')) errors.push('parameter wire 非法')
    if (wires.has(p.wire)) errors.push('wire 重复: ' + p.wire)
    wires.add(p.wire)
    if (p.source === 'lookup' && (p.lookup === undefined || p.acceptsUndefined !== undefined)) {
      errors.push('lookup 参数缺 lookup 键')
    }
    const perr = validateCodec(p.codec, tag + ' parameter ' + p.name)
    if (perr) errors.push(perr)
  }
  if (inv.scope !== undefined && inv.invocation?.kind !== 'direct') errors.push('scope 仅允许 direct')
  if (inv.cancellation !== undefined && inv.cancellation.parameter !== 'signal') errors.push('cancellation 仅 signal')
  // 客户端 api-gateway 断言：远程方法名不得与命名空间服务自身字段/原型冲突（remove 即撞车案例）
  if (NAMESPACE_RESERVED.has(inv.method)) {
    errors.push('方法名与命名空间服务冲突（api-gateway 会拒绝）: ' + inv.method)
  }
  ok(errors.length === 0, errors.length ? tag + ' ✗ ' + errors.join('; ') : tag + ' ✓')
}

// ---------- 4) 客户端贡献与宿主同源 ----------
console.log('✅ verify-protocol: 客户端贡献')
const { flowchartRemoteContribution } = await import('../src/core/storage/remote.js')
ok(flowchartRemoteContribution.package === TYPERT_HOST.package,
  '客户端 package 与宿主一致: ' + flowchartRemoteContribution.package)
ok(Array.isArray(flowchartRemoteContribution.descriptors)
  && flowchartRemoteContribution.descriptors.length === TYPERT_HOST.invocations.length,
  '客户端 descriptors == 宿主 invocations（同源 wire.js，数目 ' + TYPERT_HOST.invocations.length + '）')

if (fails > 0) {
  console.error('verify-protocol: ' + fails + ' 项失败')
  process.exit(1)
} else {
  console.log('✅ verify-protocol: 全部断言通过')
}
