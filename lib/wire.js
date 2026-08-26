// dsh-mermaid 线协议描述（单一来源）
// 职责：画布记录 schema + 远程调用描述（invocations/descriptors），宿主 typert.host.js 与客户端
//       remote contribution 双端共用，保证线协议永远一致。
// 边界：只依赖 zod（宿主半与 client bundle 均可 import）。
// 导出：META_SCHEMA / BODY_SCHEMA / PATCH_SCHEMA / MM_INVOCATIONS
import { z } from 'zod'

// ---------- 画布记录 schema（线协议校验；持久介质为 mermaid-canvases/{id}.json，语义清洗走 sanitizeDoc） ----------

export const META_SCHEMA = z.object({
  id: z.string().min(1),
  name: z.string(),
  schemaVersion: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
  elementCount: z.number().int().nonnegative(),
  hasMedia: z.boolean(),
})

const record = z.record(z.string(), z.unknown())

// body 宽松（记录与前端注册表重复，线协议只保形状；语义清洗走 sanitizeDoc）
export const BODY_SCHEMA = z.object({
  schemaVersion: z.number().int().nonnegative(),
  pages: z.array(record).default([]),
  nodes: z.array(record).default([]),
  edges: z.array(record).default([]),
  config: z.record(z.string(), z.unknown()).default({}),
}).passthrough()

// 三集合增量 patch
const coll = z.object({
  set: z.record(z.string(), record).default({}),
  remove: z.array(z.string()).default([]),
})
export const PATCH_SCHEMA = z.object({
  pages: coll.default({ set: {}, remove: [] }),
  nodes: coll.default({ set: {}, remove: [] }),
  edges: coll.default({ set: {}, remove: [] }),
  config: z.record(z.string(), z.unknown()).optional(),
})

// ---------- 远程调用描述（gateway 严格路径；参数/结果 zod 校验） ----------

const okTrue = z.object({ ok: z.literal(true) })
const pingResult = z.object({ ok: z.literal(true), storage: z.string() })
const listMetaArg = z.object({
  page: z.number().int().nonnegative().optional(),
  pageSize: z.number().int().positive().optional(),
  keyword: z.string().optional(),
})
const listMetaResult = z.object({
  ok: z.literal(true),
  items: z.array(META_SCHEMA),
  total: z.number().int().nonnegative(),
})
const getMetaResult = z.object({ ok: z.literal(true), meta: META_SCHEMA.nullable() })
const loadBodyResult = z.object({
  ok: z.literal(true),
  body: BODY_SCHEMA.extend({ dropped: z.number().int().nonnegative() }).nullable(),
})
const saveBodyArg = z.object({
  id: z.string().min(1),
  patch: PATCH_SCHEMA,
})

const SRC = { file: 'dsh-mermaid/lib/wire.js', line: 1, column: 1 }
const strict = (schema, typeSymbol) => ({ mode: 'strict', typeSymbol, schema })

export const MM_INVOCATIONS = [
  {
    id: 'dsh-mermaid#mermaidStorage/ping',
    service: 'mermaidStorage', namespace: 'mermaidStorage', method: 'ping',
    invocation: { kind: 'direct' }, parameters: [],
    result: strict(pingResult, 'dsh-mermaid#MmPingResult'), sourceLocation: SRC,
  },
  {
    id: 'dsh-mermaid#mermaidStorage/listMeta',
    service: 'mermaidStorage', namespace: 'mermaidStorage', method: 'listMeta',
    invocation: { kind: 'direct' },
    parameters: [{ name: 'q', wire: 'q', source: 'json', codec: strict(listMetaArg, 'dsh-mermaid#MmListMetaRequest') }],
    result: strict(listMetaResult, 'dsh-mermaid#MmListMetaResult'), sourceLocation: SRC,
  },
  {
    id: 'dsh-mermaid#mermaidStorage/getMeta',
    service: 'mermaidStorage', namespace: 'mermaidStorage', method: 'getMeta',
    invocation: { kind: 'direct' },
    parameters: [{ name: 'id', wire: 'id', source: 'json', codec: strict(z.string().min(1), 'dsh-mermaid#MmCanvasId') }],
    result: strict(getMetaResult, 'dsh-mermaid#MmGetMetaResult'), sourceLocation: SRC,
  },
  {
    id: 'dsh-mermaid#mermaidStorage/loadBody',
    service: 'mermaidStorage', namespace: 'mermaidStorage', method: 'loadBody',
    invocation: { kind: 'direct' },
    parameters: [{ name: 'id', wire: 'id', source: 'json', codec: strict(z.string().min(1), 'dsh-mermaid#MmCanvasId') }],
    result: strict(loadBodyResult, 'dsh-mermaid#MmLoadBodyResult'), sourceLocation: SRC,
  },
  {
    id: 'dsh-mermaid#mermaidStorage/saveMeta',
    service: 'mermaidStorage', namespace: 'mermaidStorage', method: 'saveMeta',
    invocation: { kind: 'direct' },
    parameters: [{ name: 'meta', wire: 'meta', source: 'json', codec: strict(META_SCHEMA, 'dsh-mermaid#MmCanvasMeta') }],
    result: strict(okTrue, 'dsh-mermaid#MmOk'), sourceLocation: SRC,
  },
  {
    id: 'dsh-mermaid#mermaidStorage/saveBody',
    service: 'mermaidStorage', namespace: 'mermaidStorage', method: 'saveBody',
    invocation: { kind: 'direct' },
    parameters: [
      { name: 'id', wire: 'id', source: 'json', codec: strict(z.string().min(1), 'dsh-mermaid#MmCanvasId') },
      { name: 'patch', wire: 'patch', source: 'json', codec: strict(PATCH_SCHEMA, 'dsh-mermaid#MmDocPatch') },
    ],
    result: strict(okTrue, 'dsh-mermaid#MmOk'), sourceLocation: SRC,
  },
  {
    id: 'dsh-mermaid#mermaidStorage/remove',
    service: 'mermaidStorage', namespace: 'mermaidStorage', method: 'remove',
    invocation: { kind: 'direct' },
    parameters: [{ name: 'id', wire: 'id', source: 'json', codec: strict(z.string().min(1), 'dsh-mermaid#MmCanvasId') }],
    result: strict(okTrue, 'dsh-mermaid#MmOk'), sourceLocation: SRC,
  },
  {
    id: 'dsh-mermaid#mermaidStorage/clear',
    service: 'mermaidStorage', namespace: 'mermaidStorage', method: 'clear',
    invocation: { kind: 'direct' }, parameters: [],
    result: strict(okTrue, 'dsh-mermaid#MmOk'), sourceLocation: SRC,
  },
]
