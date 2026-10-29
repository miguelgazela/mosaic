import type { BoardNode } from './boardRepo'

export interface TreeRow {
  node: BoardNode
  depth: number
  hasChildren: boolean
  expanded: boolean
}

const byTitle = (a: BoardNode, b: BoardNode) => a.title.localeCompare(b.title) || (a.id < b.id ? -1 : 1)

function childrenIndex(nodes: BoardNode[]): Map<string | null, BoardNode[]> {
  const ids = new Set(nodes.map((n) => n.id))
  const by = new Map<string | null, BoardNode[]>()
  for (const n of nodes) {
    // A board whose parent is missing (trashed, not loaded) is shown at the top rather than lost.
    const key = n.parentId && ids.has(n.parentId) ? n.parentId : null
    by.set(key, [...(by.get(key) ?? []), n])
  }
  for (const list of by.values()) list.sort(byTitle)
  return by
}

/** `roots` and every board below them. */
export function subtreeIds(nodes: BoardNode[], roots: string[]): Set<string> {
  const by = childrenIndex(nodes)
  const out = new Set<string>()
  const walk = (id: string) => {
    if (out.has(id)) return
    out.add(id)
    for (const c of by.get(id) ?? []) walk(c.id)
  }
  roots.forEach(walk)
  return out
}

/** Ids of the boards above `id`, nearest first. */
export function ancestorIds(nodes: BoardNode[], id: string): string[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const out: string[] = []
  for (let p = byId.get(id)?.parentId; p && byId.has(p) && !out.includes(p); p = byId.get(p)!.parentId) out.push(p)
  return out
}

/**
 * Rows to draw, depth first. A search shows every board whose title matches plus the boards above them, all open;
 * without one only the open boards' children show.
 */
export function visibleRows(nodes: BoardNode[], expanded: ReadonlySet<string>, query = ''): TreeRow[] {
  const by = childrenIndex(nodes)
  const needle = query.trim().toLowerCase()
  let keep: Set<string> | null = null
  if (needle) {
    keep = new Set()
    for (const n of nodes) {
      if (!n.title.toLowerCase().includes(needle)) continue
      keep.add(n.id)
      for (const a of ancestorIds(nodes, n.id)) keep.add(a)
    }
  }
  const rows: TreeRow[] = []
  const walk = (n: BoardNode, depth: number) => {
    const kids = (by.get(n.id) ?? []).filter((c) => !keep || keep.has(c.id))
    const open = keep ? kids.length > 0 : expanded.has(n.id)
    rows.push({ node: n, depth, hasChildren: (by.get(n.id) ?? []).length > 0, expanded: open })
    if (open) for (const c of kids) walk(c, depth + 1)
  }
  for (const r of (by.get(null) ?? []).filter((n) => !keep || keep.has(n.id))) walk(r, 0)
  return rows
}
