// dsh-flowchart core/store.js
// 职责：画板开关（纯模块状态 + 订阅；适配层喂入，应用层消费——与 wf 同构）
let open = false
const subs = new Set()

export function setOpen(v) {
  if (open === v) return
  open = !!v
  for (const f of subs) f(open)
}

export function getOpen() { return open }

export function subscribe(fn) {
  subs.add(fn)
  return () => subs.delete(fn)
}
