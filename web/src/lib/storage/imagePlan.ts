import { MAX_EDGE, THUMB_EDGE } from './paths'

export const isHeic = (f: { name: string; type: string }): boolean =>
  /^image\/hei[cf]$/i.test(f.type) || /\.(heic|heif)$/i.test(f.name)

export const isImageFile = (f: { name: string; type: string }): boolean =>
  f.type.startsWith('image/') || isHeic(f)

/** Scale (w, h) down so the long edge is at most `max`. Never scales up. */
export function fitWithin(w: number, h: number, max: number): { w: number; h: number } {
  const long = Math.max(w, h)
  if (long <= max) return { w, h }
  const k = max / long
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) }
}

export interface ImagePlan {
  /** false: upload the source bytes untouched. */
  reencode: boolean
  out: { w: number; h: number }
  mime: string
  thumb: { w: number; h: number }
}

const SMALL_BYTES = 1.5 * 1024 * 1024

/**
 * Decide how to store an image. GIFs are never re-encoded (animation). Other formats are re-encoded
 * when too large in pixels or bytes: JPEG stays JPEG, everything else becomes WebP (keeps alpha).
 * HEIC is converted to JPEG before this runs, so it arrives as image/jpeg.
 */
export function planImage(src: { w: number; h: number; bytes: number; mime: string }): ImagePlan {
  const out = fitWithin(src.w, src.h, MAX_EDGE)
  const resized = out.w !== src.w || out.h !== src.h
  const thumb = fitWithin(src.w, src.h, THUMB_EDGE)
  if (src.mime === 'image/gif') return { reencode: false, out: { w: src.w, h: src.h }, mime: src.mime, thumb }
  const reencode = resized || src.bytes > SMALL_BYTES
  const mime = src.mime === 'image/jpeg' ? 'image/jpeg' : reencode ? 'image/webp' : src.mime
  return { reencode, out, mime, thumb }
}

/** Initial card size: long edge at most 280 wide / 360 tall, keeping the aspect ratio. */
export function cardSizeFor(w: number, h: number): { width: number; height: number } {
  if (w <= 0 || h <= 0) return { width: 280, height: 186 }
  const k = Math.min(280 / w, 360 / h, 1)
  const width = Math.max(96, Math.round((w * k) / 8) * 8)
  return { width, height: Math.round(width * (h / w)) }
}

/**
 * The 512 px thumbnail is enough only when the card's on-screen width in device pixels fits inside it;
 * anything larger (a 280 px card on a 2x screen is 560) needs the full image or it looks soft.
 */
export const thumbIsSharp = (cardWidth: number, zoom: number, dpr: number): boolean => cardWidth * zoom * dpr <= THUMB_EDGE
