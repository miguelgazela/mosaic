import type { Viewport } from '../../canvas/geometry'

export interface SkeletonSnapshot {
  title: string
  viewport: Viewport
  rects: { x: number; y: number; w: number; h: number }[]
}

const key = (id: string) => `milanote:skeleton:${id}`

export function saveSkeleton(id: string, snap: SkeletonSnapshot): void {
  try { localStorage.setItem(key(id), JSON.stringify({ ...snap, rects: snap.rects.slice(0, 60) })) } catch { /* private mode / quota */ }
}

export function loadSkeleton(id: string): SkeletonSnapshot | null {
  try {
    const raw = localStorage.getItem(key(id))
    return raw ? (JSON.parse(raw) as SkeletonSnapshot) : null
  } catch { return null }
}
