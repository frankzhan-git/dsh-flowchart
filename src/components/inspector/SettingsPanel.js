// dsh-mermaid components/inspector/SettingsPanel.js —— 右栏「设置」区
// 业务管线（选中对象 → 面板映射，三通道互斥选中）：
//   选中页面 → 页面配置（图类型平铺单选 + 图例，不支持类型标灰）
//   选中节点 → 节点配置（形状平铺单选 + 缩略图图例）
//   选中箭头 → 箭头配置（连线类型平铺单选 + 线型图例）
//   无选中   → 空态
// 文本/名称/标签等由画布双击编辑（面板不重复提供）；
// 每个选项带语义 desc：鼠标划入浮窗显示（业务语义 + 使用场景）
import React from 'react'
import { PAGE_TYPES } from '../../core/page-types.js'
import { SHAPE_IDS, shapeOf } from '../../core/shapes.js'
import { EDGE_KINDS, edgeOptions } from '../../core/edge-kinds.js'
import { ShapeThumb } from '../common/ShapeSvg.js'
import { HoverTip } from '../common/HoverTip.js'
import { t } from '../../i18n/index.js'

const el = React.createElement

// 页面类型图例（二字符徽标：稳定、无外部图标依赖）
const TYPE_BADGE = {
  flowchart: 'FL', sequence: 'SD', class: 'CD', state: 'ST', er: 'ER', gantt: 'GT',
  pie: 'π', journey: 'JY', mindmap: 'MM', timeline: 'TL', sankey: 'SY',
  quadrantChart: 'QC', gitGraph: 'GG', kanban: 'KB', packet: 'PK', requirement: 'RQ',
}

// 连线类型图例（小 SVG 线型示意；尺寸与形状缩略图/徽标图例槽位一致）
function edgeLegend(kindId) {
  const k = EDGE_KINDS[kindId]
  const strokeProps = {
    stroke: 'currentColor', strokeWidth: k.width + 0.5, fill: 'none',
  }
  if (k.dash) strokeProps.strokeDasharray = k.dash
  const arrow = k.marker === 'arrow'
    ? el('path', { d: 'M 23 8 L 30 8 L 26 3.5 M 30 8 L 26 12.5', stroke: 'currentColor', strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round' })
    : null
  return el('svg', { viewBox: '0 0 34 16', width: 32, height: 15, className: 'mm-edge-legend', 'aria-hidden': true },
    el('line', Object.assign({ x1: 1, y1: 8, x2: 27, y2: 8 }, strokeProps)),
    arrow,
  )
}

// 平铺单选组（图例 + 名称；disabled 标灰不可选；hover 浮窗 = 语义解释 + 使用场景）
function TileGroup(props) {
  const { choices, value, onPick, columns } = props
  return el('div', { className: 'mm-tile-grid', style: { gridTemplateColumns: 'repeat(' + (columns || 2) + ', 1fr)' } },
    choices.map((c) => {
      // 浮窗文案：disabled 附「暂不支持」说明；无 title（避免与浮窗双重提示）
      const tipText = c.disabled
        ? c.label + '（' + t('typeUnsupported') + '）\n\n' + c.desc
        : (c.label + '：' + c.desc)
      return el(HoverTip, { key: c.id, text: tipText },
        el('div', {
          className: 'mm-tile' + (value === c.id ? ' mm-tile-on' : '') + (c.disabled ? ' mm-tile-disabled' : ''),
          onClick: c.disabled ? null : () => onPick(c.id),
        },
          el('div', { className: 'mm-tile-legend' }, c.legend),
          el('div', { className: 'mm-tile-label' }, c.label),
        ),
      )
    }),
  )
}

export function SettingsPanel(props) {
  const { page, node, edge, onPagePatch, onNodePatch, onEdgePatch } = props
  // 无选中 → 空态
  if (!page && !node && !edge) {
    return el('div', { className: 'mm-settings-empty' },
      el('div', { className: 'mm-settings-empty-icon' }, '⬚'),
      el('div', null, '尚未选中内容'),
      el('div', { className: 'mm-settings-empty-hint' }, '选中页面 / 控件 / 箭头以编辑对应类型（文本与名称可在画布上双击编辑）'),
    )
  }
  const parts = []
  if (page) {
    parts.push(el('div', { className: 'mm-right-section' },
      el('div', { className: 'mm-right-title' }, '页面'),
      el('div', { className: 'mm-right-scroll' },
        el('div', { className: 'mm-field-label' }, '图类型'),
        el(TileGroup, {
          columns: 2,
          value: page.type,
          onPick: (v) => onPagePatch({ type: v }),
          choices: PAGE_TYPES.map((pt) => ({
            id: pt.id,
            label: pt.label,
            desc: pt.desc,
            disabled: !pt.interactive,
            legend: el('span', { className: 'mm-tile-badge' }, TYPE_BADGE[pt.id] || '·'),
          })),
        }),
      ),
    ))
  }
  if (node) {
    parts.push(el('div', { className: 'mm-right-section' },
      el('div', { className: 'mm-right-title' }, '控件'),
      el('div', { className: 'mm-right-scroll' },
        el('div', { className: 'mm-field-label' }, '形状'),
        el(TileGroup, {
          columns: 2,
          value: node.shape,
          onPick: (v) => onNodePatch({ shape: v }),
          choices: SHAPE_IDS.map((id) => ({
            id,
            label: shapeOf(id).label,
            desc: shapeOf(id).desc,
            legend: el(ShapeThumb, { shapeId: id, width: 32, height: 16 }),
          })),
        }),
      ),
    ))
  }
  if (edge) {
    parts.push(el('div', { className: 'mm-right-section' },
      el('div', { className: 'mm-right-title' }, '箭头'),
      el('div', { className: 'mm-right-scroll' },
        el('div', { className: 'mm-field-label' }, '连线类型'),
        el(TileGroup, {
          columns: 2,
          value: edge.kind,
          onPick: (v) => onEdgePatch({ kind: v }),
          choices: edgeOptions().map((k) => ({
            id: k,
            label: EDGE_KINDS[k].label,
            desc: EDGE_KINDS[k].desc,
            legend: edgeLegend(k),
          })),
        }),
      ),
    ))
  }
  return el('div', null, ...parts)
}
