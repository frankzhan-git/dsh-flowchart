// dsh-mermaid css 聚合（顺序 = 优先级基线；由 client.js 注入 <style>）
import { BASE_CSS } from './base.js'
import { CANVAS_CSS } from './canvas.js'
import { RIGHTPANEL_CSS } from './rightpanel.js'
import { PREVIEW_CSS } from './preview.js'

export const MM_CSS = BASE_CSS + CANVAS_CSS + RIGHTPANEL_CSS + PREVIEW_CSS
