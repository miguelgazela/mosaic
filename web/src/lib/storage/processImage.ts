import { fitWithin, isHeic, planImage } from './imagePlan'
import { THUMB_EDGE } from './paths'

export interface PreparedImage {
  original: Blob
  thumb: Blob
  w: number
  h: number
  name: string
}

async function toBitmap(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob, { imageOrientation: 'from-image' })
}

async function encode(bmp: ImageBitmap, w: number, h: number, mime: string, quality: number): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.drawImage(bmp, 0, 0, w, h)
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, mime, quality))
  if (!blob) throw new Error('Couldn’t encode image')
  return blob
}

/** Convert HEIC to JPEG, resize to 2560 px, make a 512 px thumbnail. Throws if the file isn't a readable image. */
export async function prepareImage(file: File): Promise<PreparedImage> {
  let source: Blob = file
  let name = file.name
  if (isHeic(file)) {
    const { default: heic2any } = await import('heic2any')
    const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 })
    source = Array.isArray(out) ? out[0] : out
    name = name.replace(/\.(heic|heif)$/i, '') + '.jpg'
  }
  const bmp = await toBitmap(source)
  try {
    const mime = source.type || file.type
    const plan = planImage({ w: bmp.width, h: bmp.height, bytes: source.size, mime })
    const original = plan.reencode ? await encode(bmp, plan.out.w, plan.out.h, plan.mime, 0.92) : source.type ? source : new Blob([source], { type: mime })
    const t = fitWithin(bmp.width, bmp.height, THUMB_EDGE)
    const thumb = await encode(bmp, t.w, t.h, 'image/webp', 0.85)
    return { original, thumb, w: plan.out.w, h: plan.out.h, name }
  } finally {
    bmp.close()
  }
}
