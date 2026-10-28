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
        content: i.content && typeof i.content === 'object' ? i.content : {},
      })
    }
    return items.length ? items : null
  } catch {
    return null
  }
}

/** Copies of `items` with new ids, shifted by (dx, dy), stacked in z order using `zKeys` (ascending). */
export function cloneElements(
  items: CanvasElement[],
  offset: { dx: number; dy: number },
  makeId: () => string,
  zKeys: string[],
): CanvasElement[] {
  return [...items]
    .sort((a, b) => compareZ(a.z, b.z))
    .map((e, i) => ({
      ...e,
      id: makeId(),
      x: e.x + offset.dx,
      y: e.y + offset.dy,
      z: zKeys[i],
      content: structuredClone(e.content),
    }))
}
