export const BUCKET = 'milanote-files'
export const MAX_FILE_BYTES = 10 * 1024 * 1024
export const MAX_EDGE = 2560
export const THUMB_EDGE = 512

/** Storage layout: `{uid}/{element_id}/{original|thumb}.{ext}` (RLS checks the first segment). */
export const originalPath = (uid: string, elementId: string, ext: string): string => `${uid}/${elementId}/original.${ext}`
export const thumbPath = (uid: string, elementId: string, ext: string): string => `${uid}/${elementId}/thumb.${ext}`

export function extOf(name: string, fallback = 'bin'): string {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(name)
  return m ? m[1].toLowerCase() : fallback
}

const MIME_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }
export const extForMime = (mime: string): string => MIME_EXT[mime] ?? 'bin'

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  const mb = n / (1024 * 1024)
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`
}
