import type { CanvasElement } from '../../canvas/types'
import type { MarkdownContext } from '../../cards/types'
import { getCard } from '../../cards/registry'
import { assetPathFor, relativeLink } from './paths'

/** Reading order on a canvas: top to bottom, then left to right; ties on y within 24 px read left to right. */
export function readingOrder(els: CanvasElement[]): CanvasElement[] {
  return [...els].sort((a, b) => {
    const dy = a.y - b.y
    if (Math.abs(dy) > 24) return dy
    return a.x - b.x || a.y - b.y || (a.id < b.id ? -1 : 1)
  })
}

const bySortKey = (a: CanvasElement, b: CanvasElement) => ((a.sortKey ?? '') < (b.sortKey ?? '') ? -1 : (a.sortKey ?? '') > (b.sortKey ?? '') ? 1 : 0)

export interface BoardMarkdownInput {
  title: string
  elements: CanvasElement[]
  /** Zip path of this board's `.md` file. */
  path: string
  /** Title and zip path of each exported sub-board, by board id. */
  boardPaths: Record<string, { title: string; path: string }>
}

/** One board → markdown. Pure; images and files point at `assets/…` (the zip builder puts the bytes there). */
export function boardToMarkdown({ title, elements, path, boardPaths }: BoardMarkdownInput): string {
  const children = new Map<string, CanvasElement[]>()
  const top: CanvasElement[] = []
  const ids = new Set(elements.map((e) => e.id))
  for (const e of elements) {
    if (e.parentId && ids.has(e.parentId)) children.set(e.parentId, [...(children.get(e.parentId) ?? []), e])
    else top.push(e)
  }
  const ctx: MarkdownContext = {
    boardLink: (id) => (boardPaths[id] ? { title: boardPaths[id].title, href: relativeLink(path, boardPaths[id].path) } : undefined),
    assetLink: (el) => (typeof el.content.path === 'string' ? relativeLink(path, assetPathFor(el)) : undefined),
    childrenMarkdown: (id) => (children.get(id) ?? []).sort(bySortKey).map(render).filter(Boolean),
  }
  function render(el: CanvasElement): string {
    try { return (getCard(el.type)?.toMarkdown(el, ctx) ?? '').trim() } catch { return '' }
  }
  const blocks = readingOrder(top).map(render).filter(Boolean)
  return [`# ${title || 'Untitled board'}`, ...blocks].join('\n\n') + '\n'
}
