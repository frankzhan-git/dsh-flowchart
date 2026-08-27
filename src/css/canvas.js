// dsh-flowchart css/canvas.js —— 画布 / 角落按钮 / 浮窗 / 节点 / 箭头 / 选中 / 吸附 / 创建预览
export const CANVAS_CSS = `
.mm-canvas-view { position: relative; width: 100%; height: 100%; overflow: hidden; }
.mm-canvas { display: block; width: 100%; height: 100%; user-select: none; }
.mm-canvas-bg { fill: var(--mm-bg-sunken); }
.mm-canvas-draw { cursor: crosshair; }
.mm-canvas-space { cursor: grab; }
.mm-canvas-pan { cursor: grabbing; }
/* 页面 */
.mm-page { fill: var(--mm-bg-raised); stroke: var(--mm-border-strong); stroke-dasharray: 6 4; }
.mm-page-name {
  fill: var(--mm-text-2); font-size: 11px; font-weight: 600; pointer-events: none;
}
.mm-page-dir {
  fill: var(--mm-text-2); font-size: 10px; font-weight: 600; pointer-events: none;
}
.mm-page-chip { fill: transparent; cursor: move; }
.mm-page-selected .mm-page { stroke: var(--mm-accent); stroke-width: 2; }
.mm-page-selected .mm-page-name { fill: var(--mm-accent); }
/* 节点 */
.mm-node-body {
  fill: var(--mm-bg-raised); stroke: var(--mm-border-strong); stroke-width: 1.5;
}
.mm-node-selected .mm-node-body { stroke: var(--mm-accent); stroke-width: 2; }
.mm-node-label {
  fill: var(--mm-text); font-size: 12px; text-anchor: middle; dominant-baseline: central;
  pointer-events: none; white-space: pre;
}
.mm-node-handle {
  fill: var(--mm-accent); stroke: var(--mm-bg); stroke-width: 1;
}
/* 箭头：未选中低调（细线+低饱和），选中高对比（accent 粗线 + 锚点手柄圆点） */
.mm-edge { fill: none; stroke: var(--mm-text-2); stroke-width: 1.5; opacity: .85; }
.mm-edge-dotted { stroke-dasharray: 4 3; }
.mm-edge-thick { stroke-width: 2.5; }
.mm-edge-selected { stroke: var(--mm-accent); stroke-width: 3; opacity: 1; }
.mm-anchor-handle { fill: var(--mm-accent); stroke: #fff; stroke-width: 1.5; pointer-events: none; }
.mm-edge-label {
  fill: var(--mm-text); font-size: 11px; text-anchor: middle; dominant-baseline: central;
  pointer-events: none;
}
.mm-edge-label-bg { fill: var(--mm-bg); opacity: .85; }
.mm-edge-ghost { fill: none; stroke: var(--mm-accent); stroke-width: 2; stroke-dasharray: 6 4; pointer-events: none; }
.mm-edge-ghost-cross { stroke: var(--mm-danger); }
.mm-arrow-snap-dot { fill: var(--mm-accent); stroke: var(--mm-bg-raised); stroke-width: 1.5; pointer-events: none; }
/* 连线起点 hover 预览圆点（选择模式贴近节点边带；未按下即提示「可连线」） */
.mm-hover-anchor {
  fill: var(--mm-accent); fill-opacity: .35;
  stroke: var(--mm-accent); stroke-width: 1.5;
  pointer-events: none;
}
.mm-cross-mark { fill: var(--mm-danger); pointer-events: none; }
/* 吸附 / 框选 / 多选 */
.mm-snap { stroke: var(--mm-accent); stroke-width: 1; stroke-dasharray: 4 3; pointer-events: none; }
.mm-marquee {
  fill: var(--mm-accent); fill-opacity: .1; stroke: var(--mm-accent); stroke-width: 1;
  stroke-dasharray: 4 3; pointer-events: none;
}
.mm-group-box { fill: none; stroke: var(--mm-accent); stroke-width: 1.5; stroke-dasharray: 4 3; pointer-events: none; }
.mm-group-handle { fill: var(--mm-accent); stroke: var(--mm-bg); stroke-width: 1; pointer-events: none; }
/* 角落按钮（对齐 wf CanvasOverlay） */
.mm-mode-badge {
  position: absolute; left: 10px; top: 10px; z-index: 3;
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 8px; cursor: pointer; user-select: none;
  background: var(--mm-bg-raised); border: 1px solid var(--mm-border);
  color: var(--mm-text); font-size: 12px;
}
.mm-mode-badge:hover { border-color: var(--mm-border-strong); }
.mm-mode-badge-draw { border-color: var(--mm-accent); color: var(--mm-accent); }
.mm-mode-key {
  padding: 0 5px; border: 1px solid var(--mm-border); border-radius: 4px;
  font-family: inherit; font-size: 10px; color: var(--mm-text-2);
}
.mm-canvas-tools {
  position: absolute; right: 8px; top: 8px; z-index: 3;
  display: flex; align-items: center; gap: 4px;
}
.mm-ctool {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px;
  border: 1px solid var(--mm-border);
  border-radius: 6px;
  background: var(--mm-bg-raised); color: var(--mm-text-2); cursor: pointer; font-size: 12px;
  box-shadow: var(--mm-shadow);
  transition: background-color .1s ease, color .1s ease, border-color .1s ease;
}
.mm-ctool:hover { color: var(--mm-text); }
.mm-ctool-on {
  color: var(--mm-accent);
  border-color: color-mix(in srgb, var(--mm-accent) 45%, transparent);
  background: color-mix(in srgb, var(--mm-accent) 12%, transparent);
}
.mm-canvas-actions {
  position: absolute; right: 10px; bottom: 10px; z-index: 3;
  display: flex; flex-direction: row; align-items: center; gap: 5px;
}
.mm-action-group { display: flex; gap: 4px; }
.mm-iaction {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: 8px; border: 1px solid var(--mm-border);
  background: var(--mm-bg-raised); color: var(--mm-text-2); cursor: pointer; font-size: 11px;
}
.mm-iaction:hover { color: var(--mm-text); }
.mm-iaction-danger { color: var(--mm-danger); }
.mm-iaction-wide { width: auto; padding: 0 8px; }
.mm-zoom-bar {
  display: flex; align-items: center; gap: 4px;
  padding: 3px 4px; border-radius: 8px; background: var(--mm-bg-raised);
  border: 1px solid var(--mm-border);
}
.mm-zoom-pct {
  min-width: 42px; padding: 2px 6px; border: none; border-radius: 6px; background: transparent;
  color: var(--mm-text-2); font-size: 11.5px; font-family: inherit; cursor: default;
}
.mm-zoom-pct-click { color: var(--mm-accent); cursor: pointer; }
.mm-zoom-pct-click:hover { background: var(--mm-hover); }
/* 浮窗（wf-float-panel 同款） */
.mm-float-panel {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  z-index: 5; width: min(560px, calc(100% - 80px)); height: 420px;
  display: flex; flex-direction: column;
  background: var(--mm-bg-raised); border: 1px solid var(--mm-border); border-radius: 14px;
  box-shadow: var(--mm-shadow);
}
.mm-float-head {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px;
  border-bottom: 1px solid var(--mm-border);
}
.mm-float-copy {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 10px; border-radius: 8px; border: 1px solid var(--mm-border);
  background: transparent; color: var(--mm-text-2); cursor: pointer; font-size: 12px;
}
.mm-float-copy:hover { color: var(--mm-text); }
.mm-float-copy-ok { color: var(--mm-accent); border-color: var(--mm-accent); }
.mm-float-close {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border: none; border-radius: 8px; background: transparent;
  color: var(--mm-text-2); cursor: pointer;
}
.mm-float-close:hover { background: var(--mm-hover); }
.mm-float-body { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 10px 12px; }
.mm-float-resize {
  position: absolute; right: 0; bottom: 0; width: 18px; height: 18px;
  cursor: nwse-resize;
}
.mm-float-pages {
  display: flex; align-items: center; gap: 6px; padding: 6px 12px;
  border-bottom: 1px solid var(--mm-border);
}
.mm-float-select {
  flex: 0 0 auto; max-width: 220px; padding: 3px 8px; border-radius: 8px;
  border: 1px solid var(--mm-border); background: var(--mm-bg-nested);
  color: var(--mm-text); font-size: 12px; font-family: inherit;
}
.mm-empty { padding: 24px; text-align: center; color: var(--mm-text-2); font-size: 12.5px; }
`
