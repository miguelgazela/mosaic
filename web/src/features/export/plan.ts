import type { BoardNode } from '../boards/boardRepo'
import { safeName, uniqueName } from './paths'

export interface PlannedBoard { id: string; title: string; path: string }

/**
 * Zip layout for `rootId` and every board below it, mirroring the tree:
 * `Home.md`, `Home/Ideas.md`, `Home/Ideas/Deep.md`. Sibling names that clash get " 2", " 3"… .
 */
export function planBoards(nodes: BoardNode[], rootId: string, rootTitle: string): PlannedBoard[] {
  const kids = new Map<string, BoardNode[]>()
  for (const n of nodes) if (n.parentId) kids.set(n.parentId, [...(kids.get(n.parentId) ?? []), n])
  const out: PlannedBoard[] = []
  const seen = new Set<string>()
  const walk = (id: string, title: string, dir: string, taken: Set<string>) => {
    if (seen.has(id)) return
    seen.add(id)
    const name = uniqueName(taken, safeName(title, 'Untitled board'))
    out.push({ id, title, path: `${dir}${name}.md` })
    const sub = new Set<string>()
    for (const c of (kids.get(id) ?? []).sort((a, b) => a.title.localeCompare(b.title))) walk(c.id, c.title, `${dir}${name}/`, sub)
  }
  walk(rootId, rootTitle, '', new Set())
  return out
}
