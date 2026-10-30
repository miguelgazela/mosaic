import { THUMB_EDGE } from './paths'

export const isPdfFile = (f: { name: string; type: string }): boolean => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)

export interface PdfPreview {
  blob: Blob
  /** Preview pixel size (page aspect ratio). */
  w: number
  h: number
  pages: number
}

/** Width of the preview image for a page of `pw × ph` points: THUMB_EDGE wide, but never taller than THUMB_EDGE × 1.5. */
export function previewSize(pw: number, ph: number): { w: number; h: number } {
  const w = Math.max(1, Math.min(THUMB_EDGE, Math.round((THUMB_EDGE * 1.5 * pw) / ph)))
  return { w, h: Math.max(1, Math.round((w * ph) / pw)) }
}

/** Renders page 1 of a PDF to a JPEG. pdf.js is loaded on demand; throws when the file can't be read. */
export async function renderPdfPreview(file: Blob): Promise<PdfPreview> {
  const pdfjs = await import('pdfjs-dist')
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  }
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  try {
    const page = await doc.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const { w, h } = previewSize(base.width, base.height)
    const viewport = page.getViewport({ scale: w / base.width })
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
    await page.render({ canvasContext: ctx, viewport }).promise
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.82))
    if (!blob) throw new Error('Couldn’t encode preview')
    return { blob, w, h, pages: doc.numPages }
  } finally {
    void doc.destroy()
  }
}
