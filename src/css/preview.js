// dsh-flowchart css/preview.js —— 代码视图 / 渲染预览
export const PREVIEW_CSS = `
.mm-codeview {
  margin: 0; padding: 10px 12px; border-radius: 10px;
  background: var(--mm-bg-sunken); border: 1px solid var(--mm-border);
  color: var(--mm-text); font-family: Consolas, 'Cascadia Code', Menlo, monospace;
  font-size: 12px; line-height: 1.55; white-space: pre; overflow: auto;
  tab-size: 2;
}
.mm-codeview .mm-code-h1 { color: var(--mm-accent); font-weight: 600; }
.mm-codeview .mm-code-cm { color: var(--mm-text-2); font-style: italic; }
.mm-codeview .mm-code-kw { color: var(--mm-accent); }
.mm-codeview .mm-code-st { color: #9ece6a; }
.mm-render-note {
  margin: 0 0 8px; padding: 6px 10px; border-radius: 8px;
  background: var(--mm-bg-nested); color: var(--mm-text-2); font-size: 11.5px;
}
.mm-render-body { display: flex; justify-content: center; }
.mm-render-body svg { max-width: 100%; height: auto; }
.mm-render-err {
  padding: 12px; border-radius: 10px; border: 1px solid var(--mm-danger);
  color: var(--mm-danger); font-size: 12px; white-space: pre-wrap; word-break: break-all;
}
`
