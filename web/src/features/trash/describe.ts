import type { PathItem } from '../../lib/sync/boardApi'
import type { TrashItem } from '../boards/boardRepo'

/** Days an item waits in the trash before `milanote-purge` removes it for good. */
export const TRASH_DAYS = 30
const DAY = 86_400_000

/** Plain text of a TipTap document (notes keep `plain_text` on the server; the dev database does not). */
export function docText(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const n = node as { text?: unknown; content?: unknown[] }
  if (typeof n.text === 'string') return n.text
  return Array.isArray(n.content) ? n.content.map(docText).join(' ') : ''
}

const clip = (s: string, max: number) => {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

function host(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

/** Name and one-line kind for a trash row: "Old logo options" / "Board, 18 items". */
export function describeItem(i: TrashItem): { title: string; kind: string } {
  const c = i.content ?? {}
  switch (i.type) {
    case 'board':
      return { title: i.title || 'Untitled board', kind: i.itemCount === 0 ? 'Board, empty' : `Board, ${plural(i.itemCount, 'item')}` }
    case 'note': {
      const t = clip(i.plainText || docText(c.doc), 60)
      return { title: t ? `“${t}”` : 'Empty note', kind: 'Note' }
    }
    case 'image': return { title: str(c.name) || 'Image', kind: 'Image' }
    case 'file': return { title: str(c.name) || 'File', kind: 'File' }
    case 'link': {
      const h = host(str(c.url))
      return { title: str(c.title) || str(c.url) || 'Link', kind: h ? `Link, ${h}` : 'Link' }
    }
    case 'todo': return { title: str(c.title) || 'To-do list', kind: 'To-do' }
    case 'column': return { title: str(c.title) || 'Untitled column', kind: 'Column' }
    case 'swatch': return { title: str(c.name) || str(c.hex) || 'Swatch', kind: 'Swatch' }
    default: return { title: i.type, kind: i.type }
  }
}

/** Whole days left before the purge (0 on the last day). */
export function daysLeft(deletedAt: string, now: number): number {
  return Math.max(0, Math.ceil((new Date(deletedAt).getTime() + TRASH_DAYS * DAY - now) / DAY))
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Today", "Yesterday" or "Mar 2" (local time). */
export function deletedLabel(deletedAt: string, now: number): string {
  const d = new Date(deletedAt)
  const n = new Date(now)
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((startOf(n) - startOf(d)) / DAY)
  if (diff <= 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`
}

/** "Spring campaign › Shot list" (Home is shown as such when it is the whole path). */
export function wasInText(path: PathItem[]): string {
  const names = path.map((p) => p.title || 'Untitled board')
  return names.length > 1 ? names.slice(1).join(' › ') : names[0] ?? 'Home'
}

export const confirmText = (i: TrashItem): string =>
  i.kind === 'board'
    ? `The board${i.itemCount ? ` and its ${plural(i.itemCount, 'item')}` : ''} will be gone for good. This can’t be undone.`
    : 'This card will be gone for good. This can’t be undone.'

/** Empty notes are auto-discarded by the canvas; they are soft-deleted but not worth restoring, so Trash hides them. */
export const isEmptyNote = (i: TrashItem): boolean =>
  i.kind === 'element' && i.type === 'note' && !(i.plainText ?? '').trim() && !docText(i.content?.doc).trim()

export const visibleTrash = (items: TrashItem[]): TrashItem[] => items.filter((i) => !isEmptyNote(i))
