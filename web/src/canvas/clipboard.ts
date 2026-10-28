import type { CanvasElement } from './types'
import { compareZ } from './order'

const KIND = 'milanote-clone/elements'

export const serializeClipboard = (els: CanvasElement[]): string =>
  JSON.stringify({ kind: KIND, v: 1, items: els })

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Parse system-clipboard text; null if it is not our payload. */
export function parseClipboard(text: string | null | undefined): CanvasElement[] | null {
  if (!text || !text.startsWith('{')) return null
  try {
    const data = JSON.parse(text)
    if (data?.kind !== KIND || !Array.isArray(data.items)) return null
    const items: CanvasElement[] = []
    for (const i of data.items) {
      if (!i || typeof i.type !== 'string' || !isNum(i.x) || !isNum(i.y) || !isNum(i.width)) return null
      items.push({
        id: String(i.id ?? ''),
        type: i.type,
        x: i.x,
        y: i.y,
        width: i.width,
        height: isNum(i.height) ? i.height : null,
        z: typeof i.z === 'string' ? i.z : 'a0',
        color: typeof i.color === 'string' ? i.color : null,
        parentId: typeof i.parentId === 'string' ? i.parentId : null,
        sortKey: typeof i.sortKey === 'string' ? i.sortKey : null,
        content: i.content && typeof i.content === 'object' ? i.content : {},
      })
    }
    return items.length ? items : null
  } catch {
    return null
  }
}

/**
 * Copies of `items` with new ids, shifted by (dx, dy), stacked in z order using `zKeys` (ascending).
 * A copied card keeps its column only when that column is copied with it; otherwise it becomes top-level.
 * Cards inside a copied column keep their own position (the offset only moves top-level cards).
 */
export function cloneElements(
  items: CanvasElement[],
  offset: { dx: number; dy: number },
  makeId: () => string,
  zKeys: string[],
): CanvasElement[] {
  const sorted = [...items].sort((a, b) => compareZ(a.z, b.z))
  const ids = new Map<string, string>()
  for (const e of sorted) ids.set(e.id, makeId())
  return sorted.map((e, i) => {
    const parent = e.parentId ? ids.get(e.parentId) ?? null : null
    const inside = parent !== null
    return {
      ...e,
      id: ids.get(e.id)!,
      x: inside ? e.x : e.x + offset.dx,
      y: inside ? e.y : e.y + offset.dy,
      z: zKeys[i],
      parentId: parent,
      sortKey: inside ? e.sortKey : null,
      content: structuredClone(e.content),
    }
  })
}
