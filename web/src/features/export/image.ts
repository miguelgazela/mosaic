import { toPng } from 'html-to-image'
import { boundsOf, type Rect } from '../../canvas/geometry'
import { elementRect, useBoard } from '../../canvas/store'
import { setExportMode } from '../../lib/storage/exportMode'

export type ImageScope = 'board' | 'view'

/** Largest canvas edge browsers handle reliably; ratio drops below 2 for huge boards. */
const MAX_EDGE = 8192

export function pixelRatioFor(w: number, h: number, wanted = 2): number {
  return Math.max(0.25, Math.min(wanted, MAX_EDGE / Math.max(w, h, 1)))
}

/** Content bounds in world space: every top-level card plus free line ends, padded. */
export function contentBounds(pad = 48): Rect | null {
  const s = useBoard.getState()
  const rects = Object.values(s.elements).filter((e) => !e.parentId).map((e) => elementRect(s, e.id))
  for (const c of Object.values(s.connections)) {
    for (const end of [c.from, c.to]) if (!end.elementId && end.point) rects.push({ x: end.point.x, y: end.point.y, w: 1, h: 1 })
  }
  const b = boundsOf(rects)
  return b ? { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 } : null
}

/** Wait until every image card in the world has an `<img>` that finished loading (or give up). */
async function imagesReady(world: HTMLElement, timeoutMs = 12000): Promise<void> {
  const wanted = Object.values(useBoard.getState().elements).filter((e) => e.type === 'image' && typeof e.content.path === 'string').map((e) => e.id)
  const t0 = Date.now()
  const pending = () =>
    wanted.some((id) => {
      const img = world.querySelector<HTMLImageElement>(`[data-card-id="${id}"] img`)
      return !img || !img.complete
    })
  while (pending() && Date.now() - t0 < timeoutMs) await new Promise((r) => setTimeout(r, 100))
}

let fontCss: Promise<string> | undefined

/** The page's web font as inline CSS (data URLs). html-to-image can't read the cross-origin Google Fonts sheet itself. */
function webFontCss(): Promise<string> {
  fontCss ??= (async () => {
    try {
      const href = [...document.styleSheets].map((s) => s.href).find((h) => h?.includes('fonts.googleapis.com'))
      if (!href) return ''
      let css = await (await fetch(href)).text()
      const urls = [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]))]
      await Promise.all(urls.map(async (u) => {
        const blob = await (await fetch(u)).blob()
        const data = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(blob) })
        css = css.split(u).join(data)
      }))
      return css
    } catch {
      return ''
    }
  })()
  return fontCss
}

export interface RenderResult { dataUrl: string; width: number; height: number }

/**
 * Renders the open board with html-to-image from the live DOM (so cards look exactly as on screen, lines included).
 * `board` = whole content bounds at 100 %; `view` = what the canvas shows now.
 */
export async function renderBoardImage(scope: ImageScope, onProgress?: (label: string) => void): Promise<RenderResult> {
  const world = document.querySelector<HTMLElement>('[data-testid="world"]')
  const canvas = document.querySelector<HTMLElement>('[data-testid="canvas"]')
  if (!world || !canvas) throw new Error('No board is open')
  const s = useBoard.getState()
  let rect: Rect | null
  if (scope === 'board') rect = contentBounds()
  else rect = { x: -s.viewport.x / s.viewport.zoom, y: -s.viewport.y / s.viewport.zoom, w: canvas.clientWidth / s.viewport.zoom, h: canvas.clientHeight / s.viewport.zoom }
  if (!rect) throw new Error('empty')
  const zoom = scope === 'board' ? 1 : s.viewport.zoom
  const width = Math.ceil(rect.w * zoom)
  const height = Math.ceil(rect.h * zoom)

  setExportMode(true)
  try {
    onProgress?.('Loading images')
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    await imagesReady(world)
    onProgress?.('Rendering')
    const bg = getComputedStyle(canvas).backgroundColor || '#f7f5f0'
    const dataUrl = await toPng(world, {
      width,
      height,
      pixelRatio: pixelRatioFor(width, height),
      backgroundColor: bg,
      cacheBust: false,
      fontEmbedCSS: await webFontCss(),
      style: { transform: `translate(${-rect.x * zoom}px, ${-rect.y * zoom}px) scale(${zoom})` },
      filter: (node) => !(node instanceof HTMLElement && (node.dataset.exportSkip !== undefined || node.dataset.testid === 'snap-guide')),
    })
    return { dataUrl, width, height }
  } finally {
    setExportMode(false)
  }
}

export async function dataUrlToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob()
}

/** One page, sized to the picture (px units), so nothing is cut or scaled. */
export async function imageToPdf({ dataUrl, width, height }: RenderResult): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: width >= height ? 'l' : 'p', unit: 'px', format: [width, height], compress: true, hotfixes: ['px_scaling'] })
  pdf.addImage(dataUrl, 'PNG', 0, 0, width, height, undefined, 'FAST')
  return pdf.output('blob')
}
