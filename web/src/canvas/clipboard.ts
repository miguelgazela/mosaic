import type { CanvasElement } from './types'
import { defaultStyle, type Connection, type ConnEnd } from './connections'
import { compareZ } from './order'

const KIND = 'mosaic/elements'

export const serializeClipboard = (els: CanvasElement[], connections: Connection[] = []): string =>
  JSON.stringify({ kind: KIND, v: 1, items: els, connections })

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

const isPt = (v: unknown): v is { x: number; y: number } =>
  !!v && typeof v === 'object' && isNum((v as { x?: unknown }).x) && isNum((v as { y?: unknown }).y)

function parseEnd(e: unknown): ConnEnd | null {
  const o = e as { elementId?: unknown; anchor?: { side?: unknown; t?: unknown }; point?: unknown } | null
  if (!o || typeof o !== 'object') return null
  if (typeof o.elementId === 'string' && o.elementId) {
    const side = o.anchor?.side
    if (side !== 'top' && side !== 'right' && side !== 'bottom' && side !== 'left') return null
    return { elementId: o.elementId, anchor: { side, t: isNum(o.anchor?.t) ? o.anchor!.t as number : 0.5 } }
  }
  return isPt(o.point) ? { elementId: null, point: { x: o.point.x, y: o.point.y } } : null
}

/** Lines stored beside the cards in a clipboard payload (empty when there are none or the payload is not ours). */
export function parseClipboardConnections(text: string | null | undefined): Connection[] {
  if (!text || !text.startsWith('{')) return []
  try {
    const data = JSON.parse(text)
    if (data?.kind !== KIND || !Array.isArray(data.connections)) return []
    const d = defaultStyle()
    const out: Connection[] = []
    for (const c of data.connections) {
      const from = parseEnd(c?.from)
      const to = parseEnd(c?.to)
      if (!from || !to) continue
      const st = c.style ?? {}
      out.push({
        id: String(c.id ?? ''),
        from,
        to,
        style: {
          curve: st.curve === 'curved' ? 'curved' : 'straight',
          dash: st.dash === true,
          head: ['none', 'start', 'end', 'both'].includes(st.head) ? st.head : d.head,
          color: typeof st.color === 'string' ? st.color : d.color,
          ...(isPt(st.bend) ? { bend: { x: st.bend.x, y: st.bend.y } } : {}),
        },
        label: typeof c.label === 'string' ? c.label : null,
      })
    }
    return out
  } catch {
    return []
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
  /** Filled with old id → new id, so lines between the copies can be re-pointed. */
  ids: Map<string, string> = new Map(),
): CanvasElement[] {
  const sorted = [...items].sort((a, b) => compareZ(a.z, b.z))
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
