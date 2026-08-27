// dsh-flowchart css/rightpanel.js —— 右栏（设置 + 画布历史）、设置分区、属性字段、文档列表
export const RIGHTPANEL_CSS = `
/* ⓘ 设置解释图标（无底色，次级文字色，hover 品牌色；保持一致的设计语言） */
.mm-info {
  display: inline-flex; align-items: center; justify-content: center;
  margin-left: 4px; flex: none; padding: 0;
  background: transparent; border: none;
  color: var(--mm-text-2); font-size: 12px; line-height: 1;
  cursor: help; user-select: none; vertical-align: middle;
}
.mm-info:hover { color: var(--mm-accent); }
.mm-info:focus-visible { outline: 2px solid var(--mm-accent); outline-offset: 1px; border-radius: 4px; }
/* 解释浮层：portal 到 body —— 脱离 .mm-mask 作用域，必须自带主题 token 定义（否则背景/文字透明） */
.mm-info-tip {
  --mm-bg-raised: var(--dsw-alias-bg-layer-1, #2a2f3a);
  --mm-border: var(--dsw-alias-border-l1, rgba(148,163,184,.22));
  --mm-text: var(--dsw-alias-label-primary, #e2e8f0);
  --mm-shadow: 0 8px 24px rgba(0,0,0,.18);
  --mm-accent: var(--dsw-alias-brand-primary, #6ea8ff);
  position: fixed; z-index: 2147483006;
  max-width: 260px; width: max-content; padding: 7px 10px;
  border-radius: 9px;
  background: var(--mm-bg-raised);
  border: 1px solid var(--mm-border);
  box-shadow: var(--mm-shadow);
  color: var(--mm-text); font-size: 11.5px; line-height: 1.55;
  white-space: normal; text-align: left; pointer-events: none;
}
.mm-right {
  flex: 0 0 276px; min-width: 220px; max-width: 360px;
  display: flex; flex-direction: column; min-height: 0;
  border-left: 1px solid var(--mm-border); background: var(--mm-bg);
}
.mm-resizer {
  height: 8px; cursor: ns-resize; flex: 0 0 auto; position: relative;
}
.mm-resizer:hover::after {
  content: ''; position: absolute; left: 8px; right: 8px; top: 3px; height: 2px;
  border-radius: 1px; background: var(--mm-accent); opacity: .6;
}
.mm-right-section { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
/* 设置区空态（无选中内容） */
.mm-settings-empty {
  padding: 28px 16px; text-align: center;
  color: var(--mm-text-2); font-size: 12.5px; line-height: 1.7;
}
.mm-settings-empty-icon { font-size: 20px; margin-bottom: 6px; opacity: .6; }
.mm-settings-empty-hint { font-size: 11px; opacity: .75; }
/* 平铺单选组（图例 + 标签；disabled 标灰不可选） */
/* HoverTip 包裹层必须有盒模型（display:block 作 grid item 拉伸）——display:contents 会使
   getBoundingClientRect 为零、浮窗定位失效（历史坑，勿改回） */
.mm-hover-tip { display: block; min-width: 0; }
.mm-tile-grid { display: grid; gap: 5px; margin: 4px 0 10px; }
.mm-tile {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  width: 100%; box-sizing: border-box;
  padding: 7px 4px 5px; border-radius: 8px; cursor: pointer;
  border: 1px solid var(--mm-border); background: var(--mm-bg-nested);
  color: var(--mm-text-2);
}
.mm-tile:hover { border-color: var(--mm-border-strong); color: var(--mm-text); }
.mm-tile-on { border-color: var(--mm-accent); color: var(--mm-accent); background: var(--mm-hover); }
.mm-tile-disabled {
  opacity: .38; cursor: not-allowed; filter: grayscale(.6);
}
.mm-tile-disabled:hover { border-color: var(--mm-border); color: var(--mm-text-2); }
/* 图例槽位统一：16px 高、无底色块、配色随 tile（选中/悬停 accent） */
.mm-tile-legend { display: flex; align-items: center; justify-content: center; min-height: 16px; }
.mm-tile-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 24px; height: 16px; padding: 0 3px;
  font-size: 10px; font-weight: 700; letter-spacing: .5px;
  color: var(--mm-text-2); background: none; border: none;
}
.mm-tile:hover .mm-tile-badge { color: var(--mm-text); }
.mm-tile-on .mm-tile-badge { color: var(--mm-accent); }
.mm-tile-label { font-size: 10.5px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mm-edge-legend { display: block; color: var(--mm-text-2); }
.mm-tile:hover .mm-edge-legend { color: var(--mm-text); }
.mm-tile-on .mm-edge-legend { color: var(--mm-accent); }
.mm-field-label {
  margin: 2px 0 6px; font-size: 11px; font-weight: 600; color: var(--mm-text-2);
}
.mm-right-title {
  padding: 10px 12px 6px; font-size: 12px; font-weight: 600; color: var(--mm-text-2);
  flex: 0 0 auto;
}
.mm-right-scroll { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 0 12px 10px; }
.mm-form-row { display: flex; align-items: center; gap: 8px; margin: 6px 0; }
.mm-form-label { flex: 0 0 76px; color: var(--mm-text-2); font-size: 12px; }
.mm-form-control { flex: 1 1 auto; min-width: 0; }
.mm-input, .mm-select, .mm-textarea {
  width: 100%; padding: 4px 8px; border-radius: 8px; font-size: 12px; font-family: inherit;
  border: 1px solid var(--mm-border); background: var(--mm-bg-nested); color: var(--mm-text);
  box-sizing: border-box;
}
.mm-input:focus, .mm-select:focus, .mm-textarea:focus {
  outline: none; border-color: var(--mm-accent);
}
.mm-textarea { min-height: 56px; resize: vertical; }
.mm-check { display: inline-flex; align-items: center; gap: 6px; color: var(--mm-text); font-size: 12px; }
.mm-hint { color: var(--mm-text-2); font-size: 11px; margin: 4px 0 0; }
.mm-sel-page {
  display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px;
  border-radius: 8px; border: 1px solid var(--mm-border); background: var(--mm-bg-nested);
  color: var(--mm-text); font-size: 12px; cursor: pointer;
}
.mm-sel-page span { color: var(--mm-text-2); }
/* 形状选择缩略图网格（紧凑：4 列、无文字、32×16 缩略图） */
.mm-shape-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px; padding: 5px;
  background: var(--mm-bg-raised); border: 1px solid var(--mm-border); border-radius: 10px;
}
.mm-shape-cell {
  display: flex; align-items: center; justify-content: center;
  padding: 3px 2px; border-radius: 6px; cursor: pointer; border: 1px solid transparent;
}
.mm-shape-cell:hover { background: var(--mm-hover); }
.mm-shape-cell-on { border-color: var(--mm-accent); }
.mm-shape-thumb { display: block; }
.mm-shape-thumb .mm-shape-part { fill: var(--mm-bg-nested); stroke: var(--mm-text-2); stroke-width: 2.5; }
.mm-shape-cell-on .mm-shape-part { stroke: var(--mm-accent); }
/* 画布历史（对齐 wf history.css：hover 日期↔操作按钮切换，固定行高防抖动） */
.mm-history {
  flex: none;
  display: flex; flex-direction: column; min-height: 0;
  overflow: hidden;
  border-top: 1px solid var(--mm-border);
}
.mm-history-head {
  flex: none; display: flex; align-items: center; gap: 8px;
  padding: 8px 12px;
}
.mm-history-title { font-size: 12px; font-weight: 500; color: var(--mm-text); }
.mm-history-count { font-size: 11px; color: var(--mm-text-2); }
.mm-history-list { flex: 1 1 0%; min-height: 0; overflow-y: auto; padding: 0 6px 8px; }
.mm-history-item {
  display: flex; align-items: center; gap: 8px;
  height: 30px; box-sizing: border-box;
  margin: 2px 0; padding: 0 8px; border-radius: 6px; cursor: pointer;
  transition: background-color .1s ease;
}
.mm-history-item:hover { background: var(--mm-hover); }
.mm-history-item-on { background: color-mix(in srgb, var(--mm-accent) 12%, transparent); }
.mm-history-item-on:hover { background: color-mix(in srgb, var(--mm-accent) 16%, transparent); }
.mm-history-name {
  flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 12px; color: var(--mm-text);
}
.mm-history-meta { flex: none; font-size: 11px; color: var(--mm-text-2); font-variant-numeric: tabular-nums; }
.mm-history-actions { display: none; align-items: center; gap: 2px; flex: none; }
.mm-history-item:hover .mm-history-meta { display: none; }
.mm-history-item:hover .mm-history-actions { display: inline-flex; }
.mm-history-act {
  display: inline-flex; align-items: center; justify-content: center;
  height: 20px; padding: 0 5px;
  background: transparent; border: none; border-radius: 5px;
  color: var(--mm-text-2); font-size: 11px; cursor: pointer; white-space: nowrap;
}
.mm-history-act:hover { background: var(--mm-hover); color: var(--mm-text); }
.mm-history-del {
  display: inline-flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; padding: 0;
  background: transparent; border: none; border-radius: 5px;
  color: var(--mm-text-2); cursor: pointer;
}
.mm-history-del:hover { background: color-mix(in srgb, var(--mm-danger) 14%, transparent); color: var(--mm-danger); }
.mm-history-confirm { display: inline-flex; align-items: center; gap: 2px; flex: none; }
.mm-history-confirm-btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 2px 6px;
  background: transparent; border: 1px solid var(--mm-border);
  border-radius: 5px;
  color: var(--mm-text-2); font-size: 11px; cursor: pointer; white-space: nowrap;
}
.mm-history-confirm-btn:hover { background: var(--mm-hover); color: var(--mm-text); }
.mm-history-confirm-ok { color: var(--mm-danger); border-color: color-mix(in srgb, var(--mm-danger) 45%, transparent); }
.mm-history-confirm-ok:hover { background: color-mix(in srgb, var(--mm-danger) 12%, transparent); color: var(--mm-danger); }
.mm-history-rename { flex: 1; min-width: 0; padding: 2px 6px; font-size: 12px; }
.mm-history-empty { padding: 10px 14px 14px; font-size: 11px; color: var(--mm-text-2); }
`
