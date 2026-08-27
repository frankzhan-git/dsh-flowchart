// dsh-flowchart core/shapes.js
// 职责：14 种 flowchart 形状注册表（id/label/syntax/minSize/render 描述子）
// 语法以 mermaid 官方文档为准；verify-shapes 用 mermaid.parse 逐项 smoke 兜底（语法漂移守卫）
// 导出：SHAPE_REGISTRY / SHAPE_IDS / shapeOf / shapeOptions / shapeParts / shapeThumb

// shapeParts(shapeId, w, h) → [{ tag, attrs, children? }]（纯数据描述子；NodeRenderer / ShapePicker 共用）
function partsOf(shapeId, w, h) {
  const S = { x: 0, y: 0, w, h }
  switch (shapeId) {
    case 'rounded': return [{ tag: 'rect', attrs: { x: 0, y: 0, width: w, height: h, rx: Math.min(w, h) * 0.25 } }]
    case 'stadium': return [{ tag: 'rect', attrs: { x: 0, y: 0, width: w, height: h, rx: h / 2 } }]
    case 'subroutine': return [
      { tag: 'rect', attrs: { x: 0, y: 0, width: w, height: h, rx: 4 } },
      { tag: 'rect', attrs: { x: 6, y: 6, width: w - 12, height: h - 12, rx: 2 } },
    ]
    case 'cylinder': return [
      { tag: 'path', attrs: { d: 'M0,' + ry(h) + ' A' + w / 2 + ',' + ry(h) + ' 0 0 0 ' + w + ',' + ry(h) + ' L' + w + ',' + (h - ry(h)) + ' A' + w / 2 + ',' + ry(h) + ' 0 0 1 0,' + (h - ry(h)) + ' Z' } },
      { tag: 'ellipse', attrs: { cx: w / 2, cy: ry(h), rx: w / 2, ry: ry(h) } },
    ]
    case 'circle': return [{ tag: 'ellipse', attrs: { cx: w / 2, cy: h / 2, rx: w / 2, ry: h / 2 } }]
    case 'doubleCircle': return [
      { tag: 'ellipse', attrs: { cx: w / 2, cy: h / 2, rx: w / 2, ry: h / 2 } },
      { tag: 'ellipse', attrs: { cx: w / 2, cy: h / 2, rx: w * 0.36, ry: h * 0.36 } },
    ]
    case 'asymmetric': return [{ tag: 'polygon', attrs: { points: '0,' + h / 2 + ' ' + w * 0.2 + ',0 ' + w + ',0 ' + w + ',' + h + ' ' + w * 0.2 + ',' + h } }]
    case 'diamond': return [{ tag: 'polygon', attrs: { points: w / 2 + ',0 ' + w + ',' + h / 2 + ' ' + w / 2 + ',' + h + ' 0,' + h / 2 } }]
    case 'hexagon': return [{ tag: 'polygon', attrs: { points: w * 0.25 + ',0 ' + w * 0.75 + ',0 ' + w + ',' + h / 2 + ' ' + w * 0.75 + ',' + h + ' ' + w * 0.25 + ',' + h + ' 0,' + h / 2 } }]
    case 'parallelogram': return [{ tag: 'polygon', attrs: { points: w * 0.2 + ',0 ' + w + ',0 ' + w * 0.8 + ',' + h + ' 0,' + h } }]
    case 'parallelogramAlt': return [{ tag: 'polygon', attrs: { points: '0,0 ' + w * 0.8 + ',0 ' + w + ',' + h + ' ' + w * 0.2 + ',' + h } }]
    case 'trapezoid': return [{ tag: 'polygon', attrs: { points: w * 0.2 + ',0 ' + w * 0.8 + ',0 ' + w + ',' + h + ' 0,' + h } }]
    case 'trapezoidAlt': return [{ tag: 'polygon', attrs: { points: '0,0 ' + w + ',0 ' + w * 0.8 + ',' + h + ' ' + w * 0.2 + ',' + h } }]
    default: return [{ tag: 'rect', attrs: { x: 0, y: 0, width: w, height: h, rx: 4 } }]
  }
}

const ry = (h) => Math.min(14, h * 0.16)

// 语法（label 为已转义文本，codegen 调用）；desc：业务语义 + 使用场景（设置面板 hover 浮窗）
export const SHAPE_REGISTRY = {
  rectangle: { label: '矩形', syntax: (t) => '[' + t + ']', min: { w: 80, h: 40 },
    desc: '普通步骤 / 处理动作。流程中的常规操作节点。' },
  rounded: { label: '圆角矩形', syntax: (t) => '(' + t + ')', min: { w: 80, h: 40 },
    desc: '边角柔和的普通步骤。与矩形同级，用于弱化边框感的流程步骤。' },
  stadium: { label: '跑道', syntax: (t) => '([' + t + '])', min: { w: 90, h: 40 },
    desc: '开始 / 结束端点。流程的首尾节点。' },
  subroutine: { label: '子程序', syntax: (t) => '[[' + t + ']]', min: { w: 90, h: 40 },
    desc: '调用的子流程 / 环节。可展开的嵌套流程点。' },
  cylinder: { label: '数据库', syntax: (t) => '[(' + t + ')]', min: { w: 80, h: 48 },
    desc: '数据存储 / 读写。数据库、存储、缓存等数据节点。' },
  circle: { label: '圆形', syntax: (t) => '((' + t + '))', min: { w: 48, h: 48 },
    desc: '连接点 / 小型步骤 / 校验点。简短动作或点位。' },
  doubleCircle: { label: '双圆', syntax: (t) => '(((' + t + ')))', min: { w: 56, h: 56 },
    desc: '终止 / 端点。结束节点或外部边界。' },
  asymmetric: { label: '旗形', syntax: (t) => '>' + t + ']', min: { w: 80, h: 40 },
    desc: '输出 / 外部动作标记。文件输出、结果产出等。' },
  diamond: { label: '菱形', syntax: (t) => '{' + t + '}', min: { w: 110, h: 60 },
    desc: '条件判定 / 分支。流程的决策点（是/否）。' },
  hexagon: { label: '六边形', syntax: (t) => '{{' + t + '}}', min: { w: 100, h: 56 },
    desc: '合并 / 准备动作。多路汇合或流程准备。' },
  parallelogram: { label: '平行四边形', syntax: (t) => '[/' + t + '/]', min: { w: 110, h: 40 },
    desc: '数据输入。外部数据进入流程的节点。' },
  parallelogramAlt: { label: '平行四边形(反)', syntax: (t) => '[\\' + t + '\\]', min: { w: 110, h: 40 },
    desc: '数据输出。流程产出的数据节点。' },
  trapezoid: { label: '梯形', syntax: (t) => '[/' + t + '\\]', min: { w: 100, h: 40 },
    desc: '手动输入 / 人工介入。需要人工操作的节点。' },
  trapezoidAlt: { label: '梯形(反)', syntax: (t) => '[\\' + t + '/]', min: { w: 100, h: 40 },
    desc: '手动输出。人工产出的结果节点。' },
}

export const SHAPE_IDS = Object.keys(SHAPE_REGISTRY)

export function shapeOf(id) {
  return SHAPE_REGISTRY[id] || SHAPE_REGISTRY.rectangle
}

export function shapeOptions() { return SHAPE_IDS }

export function shapeParts(shapeId, w, h) {
  return partsOf(shapeOf(shapeId) === SHAPE_REGISTRY.rectangle ? 'rectangle' : shapeId, w, h)
}

// 缩略图描述子（viewBox 0 0 72 36，CSS 缩放至 56×28；ShapePicker 网格 + 右键菜单共用）
export function shapeThumb(shapeId) {
  return {
    viewBox: '0 0 72 36',
    parts: partsOf(shapeId, 72, 36),
  }
}
