// dsh-flowchart css/base.js —— 弹窗壳 / 三栏布局 / 通用按钮 / 右键菜单 / toast
// 配色对齐 dsh-fm/dsh-wf（DSH web 原生弹窗体系：--dsw-alias-* token + fallback）
export const BASE_CSS = `
/* 输入框工具行按钮（对齐 wf-input-btn） */
.mm-input-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; padding: 0;
  background: transparent; border: none; border-radius: 6px;
  color: var(--dsw-alias-label-secondary, #8b95a7);
  cursor: pointer;
  transition: background-color .1s ease, color .1s ease;
}
.mm-input-btn:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(148,163,184,.12)); color: var(--dsw-alias-label-primary, #e2e8f0); }
.mm-input-btn-on { background: var(--dsw-alias-interactive-bg-hover, rgba(148,163,184,.16)); color: var(--dsw-alias-brand-primary, #6ea8ff); }
.mm-input-btn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #6ea8ff); outline-offset: -2px; }

.mm-mask {
  --mm-bg: var(--dsw-alias-bg-layer-2, #232833);
  --mm-bg-raised: var(--dsw-alias-bg-layer-1, #2a2f3a);
  --mm-bg-nested: var(--dsw-alias-bg-layer-3, #2f3542);
  --mm-bg-sunken: var(--dsw-alias-bg-layer-1, #1c2028);
  --mm-border: var(--dsw-alias-border-l1, rgba(148,163,184,.22));
  --mm-border-strong: var(--dsw-alias-border-l2, rgba(148,163,184,.4));
  --mm-text: var(--dsw-alias-label-primary, #e2e8f0);
  --mm-text-2: var(--dsw-alias-label-secondary, #8b95a7);
  --mm-accent: var(--dsw-alias-brand-primary, #6ea8ff);
  --mm-danger: var(--dsw-alias-state-error-primary, #f87171);
  --mm-warn: var(--dsw-alias-state-warn-primary, #fbbf24);
  --mm-hover: var(--dsw-alias-interactive-bg-hover, rgba(148,163,184,.12));
  --mm-shadow: 0 8px 24px rgba(0,0,0,.18);
  position: fixed; inset: 0; z-index: 2147483000;
  background: var(--dsw-alias-bg-mask-1, rgba(0,0,0,.45));
  backdrop-filter: var(--dsw-mask-blur, blur(3px));
  display: flex; align-items: center; justify-content: center;
  animation: mm-in .14s ease;
}
@keyframes mm-in { from { opacity: 0; transform: translateY(4px) scale(.995); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .mm-mask { animation: none; } }
.mm-modal {
  position: relative; z-index: 1;
  display: flex; flex-direction: column;
  width: min(1120px, calc(100vw - 48px));
  height: min(740px, calc(100vh - 48px));
  background: var(--mm-bg);
  border-radius: 24px;
  box-shadow: var(--dsw-shadow-lv3, 0 16px 48px rgba(0,0,0,.35));
  color: var(--mm-text);
  font-size: 13px; line-height: 1.5;
  overflow: hidden;
  font-family: var(--dsw-font-family, system-ui, -apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif);
}
.mm-modal-fs { width: 100vw; height: 100vh; border-radius: 0; box-shadow: none; }
.mm-head {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px; border-bottom: 1px solid var(--mm-border);
  flex: 0 0 auto;
}
.mm-title { font-size: 14px; font-weight: 600; }
.mm-spacer { flex: 1 1 auto; }
.mm-head-menu { display: flex; align-items: center; gap: 6px; }
.mm-icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; padding: 0; border: none; border-radius: 8px;
  background: transparent; color: var(--mm-text-2); cursor: pointer;
}
.mm-icon-btn:hover { background: var(--mm-hover); color: var(--mm-text); }
.mm-mini-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; border: none; border-radius: 8px;
  background: transparent; color: var(--mm-text-2); cursor: pointer; font-size: 12px;
}
.mm-mini-btn:hover { background: var(--mm-hover); color: var(--mm-text); }
.mm-body { display: flex; flex: 1 1 auto; min-height: 0; }
.mm-canvas-wrap { flex: 1 1 auto; min-width: 0; position: relative; background: var(--mm-bg-sunken); }
.mm-footer {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; border-top: 1px solid var(--mm-border); flex: 0 0 auto;
}
/* 按钮：无白框（主题 accent/border 变量可能被 DSH 主题解析为浅色/白色）——
   边框透明，背景/文字与「取消」按钮同源，主次用字重区分 */
.mm-btn {
  padding: 6px 16px; border: 1px solid transparent; border-radius: 10px;
  background: var(--mm-bg-raised); color: var(--mm-text); font-size: 13px; cursor: pointer;
}
.mm-btn:hover { filter: brightness(1.08); }
.mm-btn:disabled { opacity: .45; cursor: not-allowed; }
.mm-btn:focus-visible { outline: 2px solid #6ea8ff; outline-offset: -2px; }
.mm-btn-primary { font-weight: 600; }
.mm-split { display: inline-flex; align-items: stretch; border-radius: 10px; overflow: hidden; }
.mm-split .mm-btn { border-radius: 0; }
.mm-split .mm-btn + .mm-btn { border-left: 1px solid var(--mm-border); }
/* 右键菜单 */
.mm-menu-backdrop {
  position: fixed; inset: 0; z-index: 2147483002;
}
.mm-menu {
  position: fixed; z-index: 2147483003;
  min-width: 148px; padding: 5px;
  background: var(--mm-bg-raised); border: 1px solid var(--mm-border); border-radius: 12px;
  box-shadow: var(--mm-shadow);
}
.mm-menu-item {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 10px; border-radius: 8px; cursor: pointer; font-size: 12.5px;
  white-space: nowrap; color: var(--mm-text);
}
.mm-menu-item:hover { background: var(--mm-hover); }
.mm-menu-item-on { color: var(--mm-accent); }
.mm-menu-item-danger { color: var(--mm-danger); }
.mm-menu-caret { margin-left: auto; color: var(--mm-text-2); }
.mm-menu-sep { height: 1px; margin: 4px 6px; background: var(--mm-border); }
.mm-menu-sub { position: absolute; left: 100%; top: -5px; }
.mm-menu-cascade { position: relative; }
/* 确认弹窗 */
.mm-mask-confirm { z-index: 2147483004; }
.mm-confirm {
  padding: 20px; border-radius: 16px; background: var(--mm-bg-raised);
  box-shadow: var(--mm-shadow); min-width: 320px; max-width: 420px;
}
.mm-confirm-title { font-weight: 600; margin-bottom: 8px; }
.mm-confirm-body { color: var(--mm-text-2); margin-bottom: 14px; }
.mm-confirm-actions { display: flex; justify-content: flex-end; gap: 8px; }
/* Toast */
.mm-toast {
  position: absolute; left: 50%; bottom: 56px; transform: translateX(-50%);
  z-index: 2147483005; padding: 8px 14px; border-radius: 10px;
  background: var(--mm-bg-raised); border: 1px solid var(--mm-border);
  color: var(--mm-text); box-shadow: var(--mm-shadow); font-size: 12.5px;
  animation: mm-in .14s ease; max-width: 70%; pointer-events: none;
}
.mm-toast-error { border-color: var(--mm-danger); }
.mm-toast-warn { border-color: var(--mm-warn); }
`
