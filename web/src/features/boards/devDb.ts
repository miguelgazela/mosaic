import { newId as newId_ } from '../../lib/ids'
import type { CanvasElement } from '../../canvas/types'
import type { Connection } from '../../canvas/connections'
import type { BoardNode, TrashItem } from './boardRepo'

/**
 * In-memory stand-in for the `milanote` schema, used by the auth-free dev pages (/dev/board, /dev/trash) and by
 * Playwright. The methods mirror the RPCs in supabase/migrations/0006_board_management.sql; keep them in step.
 */
interface DevBoard { id: string; parentId: string | null; title: string; icon: string | null; color: string | null; isHome: boolean; deletedAt: number | null }
type DevElement = CanvasElement & { boardId: string; deletedAt: number | null }
type DevLine = Connection & { boardId: string; deletedAt: number | null }

const childBoardId = (e: CanvasElement): string | undefined => (typeof e.content.boardId === 'string' ? e.content.boardId : undefined)

export class DevDb {
  boards = new Map<string, DevBoard>([['home', { id: 'home', parentId: null, title: 'Home', icon: null, color: null, isHome: true, deletedAt: null }]])
  els = new Map<string, DevElement>()
  lines = new Map<string, DevLine>()

  ensure(id: string, parentId: string | null = 'home', title = 'Untitled board'): DevBoard {
    let b = this.boards.get(id)
    if (!b) { b = { id, parentId, title, icon: null, color: null, isHome: false, deletedAt: null }; this.boards.set(id, b) }
    return b
  }

  live(boardId: string): { elements: CanvasElement[]; lines: Connection[] } {
    const strip = <T extends { boardId: string; deletedAt: number | null }>({ boardId: _b, deletedAt: _d, ...rest }: T) => rest
    return {
      elements: [...this.els.values()].filter((e) => e.boardId === boardId && e.deletedAt === null).map(strip) as CanvasElement[],
      lines: [...this.lines.values()].filter((l) => l.boardId === boardId && l.deletedAt === null).map(strip) as Connection[],
    }
  }

  saveElements(boardId: string, els: CanvasElement[]): void {
    for (const e of els) this.els.set(e.id, { ...e, boardId, deletedAt: null })
  }
  saveLines(boardId: string, lines: Connection[]): void {
    for (const l of lines) this.lines.set(l.id, { ...l, boardId, deletedAt: null })
  }
  /** Soft-delete (the trash trigger: deleting a board card trashes its board). */
  deleteElements(ids: string[]): void {
    const ts = Date.now()
    for (const id of ids) {
      const e = this.els.get(id)
      if (!e || e.deletedAt !== null) continue
      e.deletedAt = ts
      const child = e.type === 'board' ? childBoardId(e) : undefined
      if (child) this.trash(child)
    }
  }
  deleteLines(ids: string[]): void {
    for (const id of ids) { const l = this.lines.get(id); if (l && l.deletedAt === null) l.deletedAt = Date.now() }
  }
  /** Undo of a delete arrives as a plain upsert; a board card coming back restores its board. */
  reviveElements(els: CanvasElement[], boardId: string): void {
    for (const e of els) {
      const was = this.els.get(e.id)
      this.els.set(e.id, { ...e, boardId, deletedAt: null })
      const child = e.type === 'board' ? childBoardId(e) : undefined
      if (was?.deletedAt && child) this.restore(child)
    }
  }

  subtree(root: string): string[] {
    const out = [root]
    for (let i = 0; i < out.length; i++) for (const b of this.boards.values()) if (b.parentId === out[i]) out.push(b.id)
    return out
  }
  path(id: string | null): { id: string; title: string; icon: string | null }[] {
    const out: { id: string; title: string; icon: string | null }[] = []
    for (let b = id ? this.boards.get(id) : undefined; b; b = b.parentId ? this.boards.get(b.parentId) : undefined) out.unshift({ id: b.id, title: b.title, icon: b.icon })
    return out
  }
  tree(): BoardNode[] {
    return [...this.boards.values()].filter((b) => b.deletedAt === null).map((b) => ({ id: b.id, parentId: b.parentId, title: b.title, icon: b.icon, color: b.color, isHome: b.isHome }))
  }
  private count(boardId: string): number {
    return [...this.els.values()].filter((e) => e.boardId === boardId && e.deletedAt === null).length
  }
  itemCount(boardId: string): number { return this.count(boardId) }

  move(ids: string[], target: string, at?: { x: number; y: number }): void {
    const tb = this.boards.get(target)
    if (!tb || tb.deletedAt !== null) throw new Error('target board not found')
    const moved = [...this.els.values()].filter((e) => e.deletedAt === null && (ids.includes(e.id) || (e.parentId !== null && ids.includes(e.parentId))))
    if (!moved.length) return
    const src = moved[0].boardId
    if (src === target) return
    const movedIds = new Set(moved.map((e) => e.id))
    for (const e of moved) {
      const child = e.type === 'board' ? childBoardId(e) : undefined
      if (child && this.subtree(child).includes(target)) throw new Error('cannot move a board into itself')
    }
    const top = moved.filter((e) => !e.parentId || !movedIds.has(e.parentId))
    const minx = Math.min(...top.map((e) => e.x))
    const miny = Math.min(...top.map((e) => e.y))
    let ax = at?.x
    let ay = at?.y
    if (ax === undefined || ay === undefined) {
      const there = [...this.els.values()].filter((e) => e.boardId === target && e.deletedAt === null && !e.parentId)
      ax = there.length ? Math.min(...there.map((e) => e.x)) : 80
      ay = there.length ? Math.max(...there.map((e) => e.y + (e.height ?? 160))) + 32 : 80
    }
    const dx = ax - minx
    const dy = ay - miny
    const shift = (p: { x: number; y: number } | undefined) => (p ? { x: p.x + dx, y: p.y + dy } : p)
    for (const l of this.lines.values()) {
      if (l.boardId !== src || l.deletedAt !== null) continue
      const ends = [l.from, l.to]
      const attached = ends.filter((e) => e.elementId)
      if (!attached.some((e) => movedIds.has(e.elementId!))) continue
      if (attached.every((e) => movedIds.has(e.elementId!))) {
        l.boardId = target
        for (const e of ends) if (!e.elementId) e.point = shift(e.point)
      } else l.deletedAt = Date.now()
    }
    for (const e of moved) {
      const inside = e.parentId !== null && movedIds.has(e.parentId)
      e.boardId = target
      if (!inside) { e.parentId = null; e.sortKey = null; e.x += dx; e.y += dy }
      const child = e.type === 'board' ? childBoardId(e) : undefined
      if (child) { const cb = this.boards.get(child); if (cb) cb.parentId = target }
    }
  }

  duplicate(boardId: string, parentId: string, newId?: string, withCard = false): string {
    const root = this.boards.get(boardId)
    if (!root) throw new Error('board not found')
    if (root.isHome) throw new Error('Home cannot be duplicated')
    if (this.subtree(boardId).includes(parentId)) throw new Error('cannot duplicate a board into itself')
    const keep = (b: DevBoard) => b.deletedAt === null || b.deletedAt === root.deletedAt
    const old = [boardId]
    for (let i = 0; i < old.length; i++) for (const b of this.boards.values()) if (b.parentId === old[i] && keep(b)) old.push(b.id)
    const bmap = new Map(old.map((id) => [id, id === boardId ? (newId ?? newId_()) : newId_()]))
    const emap = new Map<string, string>()
    const srcEls = [...this.els.values()].filter((e) => bmap.has(e.boardId) && e.deletedAt === null && (e.type !== 'board' || bmap.has(childBoardId(e) ?? '')))
    for (const e of srcEls) emap.set(e.id, newId_())
    for (const id of old) {
      const b = this.boards.get(id)!
      this.boards.set(bmap.get(id)!, {
        ...b, id: bmap.get(id)!, deletedAt: null,
        parentId: id === boardId ? parentId : bmap.get(b.parentId ?? '') ?? null,
        title: id === boardId ? `${b.title} copy` : b.title,
      })
    }
    for (const e of srcEls) {
      const child = e.type === 'board' ? childBoardId(e) : undefined
      this.els.set(emap.get(e.id)!, {
        ...structuredClone(e), id: emap.get(e.id)!, boardId: bmap.get(e.boardId)!, parentId: e.parentId ? emap.get(e.parentId) ?? null : null,
        content: child ? { ...e.content, boardId: bmap.get(child)! } : structuredClone(e.content),
      })
    }
    for (const l of this.lines.values()) {
      if (l.deletedAt !== null || !bmap.has(l.boardId)) continue
      const f = l.from.elementId ? emap.get(l.from.elementId) : undefined
      const t = l.to.elementId ? emap.get(l.to.elementId) : undefined
      if ((l.from.elementId && !f) || (l.to.elementId && !t)) continue
      const copy = structuredClone(l)
      const c = { ...copy, id: newId_(), boardId: bmap.get(l.boardId)! }
      if (f) c.from = { ...c.from, elementId: f }
      if (t) c.to = { ...c.to, elementId: t }
      this.lines.set(c.id, c)
    }
    const created = bmap.get(boardId)!
    if (withCard) {
      const card = [...this.els.values()].find((e) => e.boardId === parentId && e.type === 'board' && e.deletedAt === null && childBoardId(e) === boardId)
      const there = [...this.els.values()].filter((e) => e.boardId === parentId && e.deletedAt === null && !e.parentId)
      const el: DevElement = {
        id: newId_(), type: 'board', boardId: parentId, deletedAt: null, parentId: null, sortKey: null, color: null, height: null,
        width: card?.width ?? 136, x: card ? card.x + card.width + 24 : there.length ? Math.min(...there.map((e) => e.x)) : 80,
        y: card ? card.y : there.length ? Math.max(...there.map((e) => e.y + (e.height ?? 160))) + 32 : 80,
        z: card ? `${card.z}V` : 'a0', content: { boardId: created },
      }
      this.els.set(el.id, el)
    }
    return created
  }

  trash(id: string): void {
    const b = this.boards.get(id)
    if (!b || b.deletedAt !== null) return
    if (b.isHome) throw new Error('Home cannot be moved to the trash')
    const ts = Date.now()
    for (const sid of this.subtree(id)) { const s = this.boards.get(sid)!; if (s.deletedAt === null) s.deletedAt = ts }
    for (const e of this.els.values()) if (e.type === 'board' && e.deletedAt === null && childBoardId(e) === id) e.deletedAt = ts
  }
  restore(id: string): void {
    const b = this.boards.get(id)
    if (!b || b.deletedAt === null) return
    const parent = b.parentId ? this.boards.get(b.parentId) : undefined
    if (parent && parent.deletedAt !== null) throw new Error('the board it was in is in the trash')
    const ts = b.deletedAt
    for (const sid of this.subtree(id)) { const s = this.boards.get(sid)!; if (s.deletedAt === ts) s.deletedAt = null }
    for (const e of this.els.values()) if (e.type === 'board' && e.deletedAt !== null && childBoardId(e) === id) e.deletedAt = null
  }

  trashItems(): TrashItem[] {
    const out: TrashItem[] = []
    for (const b of this.boards.values()) {
      const p = b.parentId ? this.boards.get(b.parentId) : undefined
      if (b.deletedAt === null || !p || p.deletedAt !== null) continue
      out.push({ kind: 'board', id: b.id, type: 'board', title: b.title, itemCount: this.count(b.id), icon: b.icon, color: b.color, content: null, plainText: null, wasIn: this.path(b.parentId), deletedAt: new Date(b.deletedAt).toISOString() })
    }
    for (const e of this.els.values()) {
      const b = this.boards.get(e.boardId)
      const par = e.parentId ? this.els.get(e.parentId) : undefined
      if (e.deletedAt === null || e.type === 'board' || !b || b.deletedAt !== null || (par && par.deletedAt !== null)) continue
      out.push({ kind: 'element', id: e.id, type: e.type, title: '', itemCount: 0, icon: null, color: e.color, content: e.content, plainText: null, wasIn: this.path(e.boardId), deletedAt: new Date(e.deletedAt).toISOString() })
    }
    return out.sort((a, b) => (a.deletedAt < b.deletedAt ? 1 : -1))
  }
  restoreElement(id: string): void {
    const e = this.els.get(id)
    if (!e || e.deletedAt === null) return
    const ts = e.deletedAt
    const b = this.boards.get(e.boardId)
    if (!b || b.deletedAt !== null) throw new Error('the board it was in is in the trash')
    for (const x of this.els.values()) if (x.id === id || (x.parentId === id && x.deletedAt !== null && Math.abs(x.deletedAt - ts) < 5000)) x.deletedAt = null
    for (const l of this.lines.values()) {
      if (l.deletedAt === null || Math.abs(l.deletedAt - ts) >= 5000) continue
      const ends = [l.from.elementId, l.to.elementId]
      if (!ends.includes(id)) continue
      if (ends.every((x) => !x || this.els.get(x)?.deletedAt === null)) l.deletedAt = null
    }
  }
  deleteForever(kind: 'board' | 'element', id: string): void {
    if (kind === 'element') { const e = this.els.get(id); if (e && e.deletedAt !== null) this.els.delete(id); return }
    const b = this.boards.get(id)
    if (!b || b.deletedAt === null || b.isHome) return
    for (const sid of this.subtree(id)) {
      this.boards.delete(sid)
      for (const [eid, e] of this.els) if (e.boardId === sid) this.els.delete(eid)
      for (const [lid, l] of this.lines) if (l.boardId === sid) this.lines.delete(lid)
    }
    for (const [eid, e] of this.els) if (e.type === 'board' && e.deletedAt !== null && childBoardId(e) === id) this.els.delete(eid)
  }
}

