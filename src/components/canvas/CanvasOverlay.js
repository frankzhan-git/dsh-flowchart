// dsh-flowchart components/canvas/CanvasOverlay.js —— 画布内角落按钮 + 浮窗（对齐 wf CanvasOverlay）
// 左上角模式徽标｜右上角工具行（代码/预览/设置）｜右下角（撤销/重做/清空 + 缩放%）
// 浮窗：Mermaid 代码（可复制当前页/全部）/ 渲染预览（内置渲染器，多页下拉切换）
import React from 'react'
import { t } from '../../i18n/index.js'
import { CodeView } from '../preview/CodeView.js'
import { RenderPreview } from '../preview/RenderPreview.js'
import {
  IconCodeOutline16, IconChecklistOutline14, IconCloseOutline16,
  IconRefreshOutline16, IconTrashOutline16, IconCopyOutline16, IconSettingsOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'

const el = React.createElement

export function CanvasOverlay(props) {
  const {
    mode, onToggleMode, floatTab, onFloatTab, zoom, pan, onZoomReset, result,
    onCloseFloat, canUndo, canRedo, canClear, onUndo, onRedo, onClear,
    panelOpen, onTogglePanel, showToast,
  } = props
  const [pvIdx, setPvIdx] = React.useState(0)
  const [copied, setCopied] = React.useState(false)
  const copyTimer = React.useRef(null)
  const [clearArm, setClearArm] = React.useState(false)
  const clearTimer = React.useRef(null)
  React.useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current)
    if (clearTimer.current) clearTimeout(clearTimer.current)
  }, [])

  const pages = result.pages || []
  const safeIdx = Math.min(pvIdx, Math.max(0, pages.length - 1))
  const cur = pages.length ? pages[safeIdx] : null
  const zoomPct = Math.round(zoom * 100)
  const atDefault = zoom === 1 && pan.x === 0 && pan.y === 0
  const armClear = () => {
    setClearArm(true)
    if (clearTimer.current) clearTimeout(clearTimer.current)
    clearTimer.current = setTimeout(() => setClearArm(false), 2500)
  }
  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 1600)
      return true
    } catch (e) {
      if (showToast) showToast('复制失败', 'error')
      return false
    }
  }
  const copyAll = () => {
    const text = pages.map((p) => '```mermaid\n' + p.code + '\n```').join('\n\n')
    return copyText(text)
  }

  return el('div', { className: 'mm-canvas-overlay' },
    // 左上角：模式徽标
    el('div', {
      className: 'mm-mode-badge' + (mode === 'draw' ? ' mm-mode-badge-draw' : ''),
      title: t('modeTitle'),
      onClick: onToggleMode,
    },
      mode === 'select' ? t('modeSelect') : t('modeDraw'),
      el('kbd', { className: 'mm-mode-key' }, t('altKey')),
    ),
    // 右上角：工具行
    el('div', { className: 'mm-canvas-tools' },
      el('button', {
        type: 'button',
        className: 'mm-ctool' + (floatTab === 'code' ? ' mm-ctool-on' : ''),
        title: '查看生成的 Mermaid 代码',
        onClick: () => onFloatTab(floatTab === 'code' ? null : 'code'),
      }, el(IconCodeOutline16, { size: 14 }), t('codeTab')),
      el('button', {
        type: 'button',
        className: 'mm-ctool' + (floatTab === 'preview' ? ' mm-ctool-on' : ''),
        title: '渲染预览（内置渲染器）',
        onClick: () => onFloatTab(floatTab === 'preview' ? null : 'preview'),
      }, el(IconChecklistOutline14, { size: 14 }), t('previewTab')),
      el('button', {
        type: 'button',
        className: 'mm-ctool' + (panelOpen ? ' mm-ctool-on' : ''),
        title: panelOpen ? '隐藏右侧面板' : '显示右侧面板',
        onClick: onTogglePanel,
      }, el(IconSettingsOutline16, { size: 14 }), t('settingsTab')),
    ),
    // 右下角：撤销 / 重做 / 清空 + 缩放（单行）
    el('div', { className: 'mm-canvas-actions' },
      canUndo ? el('button', {
        type: 'button', className: 'mm-iaction', title: t('undo'), onClick: onUndo,
      }, el(IconRefreshOutline16, { size: 13 })) : null,
      canRedo ? el('button', {
        type: 'button', className: 'mm-iaction', title: t('redo'), onClick: onRedo,
      }, el(IconRefreshOutline16, { size: 13 })) : null,
      canClear ? (clearArm
        ? el('button', {
          type: 'button', className: 'mm-iaction mm-iaction-danger mm-iaction-wide',
          title: '再次点击确认清空',
          onClick: () => { setClearArm(false); onClear() },
        }, t('confirmClear'))
        : el('button', {
          type: 'button', className: 'mm-iaction', title: t('clear'),
          onClick: armClear,
        }, el(IconTrashOutline16, { size: 13 })))
        : null,
      el('div', { className: 'mm-zoom-bar' },
        el('button', {
          type: 'button',
          className: 'mm-zoom-pct' + (atDefault ? '' : ' mm-zoom-pct-click'),
          title: atDefault ? zoomPct + '%' : t('zoomResetTitle'),
          disabled: atDefault,
          onClick: onZoomReset,
        }, zoomPct + '%'),
      ),
    ),
    // 浮窗
    floatTab ? el('div', { className: 'mm-float-panel' },
      el('div', { className: 'mm-float-head' },
        el('span', null, floatTab === 'code' ? t('floatCodeTitle') : t('floatPreviewTitle')),
        el('span', { className: 'mm-spacer' }),
        floatTab === 'code' ? el('button', {
          type: 'button',
          className: 'mm-float-copy' + (copied ? ' mm-float-copy-ok' : ''),
          title: t('copyAll'),
          onClick: copyAll,
        }, el(IconCopyOutline16, { size: 13 }), copied ? t('copied') : t('copyAll')) : null,
        el('button', { type: 'button', className: 'mm-float-close', title: t('floatClose'), onClick: onCloseFloat },
          el(IconCloseOutline16, { size: 14 })),
      ),
      pages.length > 1 ? el('div', { className: 'mm-float-pages' },
        el('span', { style: { color: 'var(--mm-text-2)', fontSize: 11 } }, '页面'),
        el('select', {
          className: 'mm-float-select',
          value: String(safeIdx),
          onChange: (ev) => setPvIdx(Number(ev.target.value)),
        },
          pages.map((p, i) => el('option', { key: i, value: String(i) }, p.name || '页面' + (i + 1))),
        ),
      ) : null,
      el('div', { className: 'mm-float-body' },
        pages.length === 0
          ? el('div', { className: 'mm-empty' }, t('emptyCanvas'))
          : floatTab === 'code'
            ? el(CodeView, { code: cur.code, issues: cur.issues })
            : el(RenderPreview, { code: cur.code, salt: cur.pageId, showToast }),
      ),
    ) : null,
  )
}
