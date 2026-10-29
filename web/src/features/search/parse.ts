import type { PathItem } from '../../lib/sync/boardApi'

/** `milanote.search` wraps matches in these (private-use) characters. */
export const HIT_START = ''
export const HIT_END = ''

export interface SearchRow {
  kind: 'board' | 'element'
  /** Board id for a board hit, card id for a card hit. */
  id: string
  boardId: string
  /** `board` or the card type. */
  type: string
  title: string
  snippet: string
  /** Boards above the hit (for a board hit: above that board). */
  path: PathItem[]
  icon: string | null
  color: string | null
}

export interface Segment { text: string; hit: boolean }

/** Splits a marked snippet into plain and highlighted pieces; whitespace runs collapse (to-dos span lines). */
export function parseSnippet(s: string): Segment[] {
  const out: Segment[] = []
  const re = new RegExp(`${HIT_START}([^${HIT_END}]*)${HIT_END}`, 'g')
  const push = (text: string, hit: boolean) => { if (text) out.push({ text, hit }) }
  let last = 0
  const clean = s.replace(/\s+/g, ' ')
  for (let m = re.exec(clean); m; m = re.exec(clean)) {
    push(clean.slice(last, m.index), false)
    push(m[1], true)
    last = m.index + m[0].length
  }
  push(clean.slice(last), false)
  return out.map((seg) => ({ ...seg, text: seg.text.replace(new RegExp(`[${HIT_START}${HIT_END}]`, 'g'), '') }))
}

/** The words a query is made of (the server treats each as a prefix). */
export const queryWords = (q: string): string[] => q.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)

/** Same job as ts_headline for the in-memory dev database: window around the first match, matches marked. */
export function markSnippet(text: string, words: string[], max = 90): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (!words.length) return flat.slice(0, max)
  const esc = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${esc.join('|')})[\\p{L}\\p{N}]*`, 'giu')
  const first = re.exec(flat)
  let start = 0
  if (first && first.index > max / 3) {
    start = flat.lastIndexOf(' ', first.index - Math.floor(max / 4))
    start = start < 0 ? 0 : start + 1
  }
  const end = Math.min(flat.length, start + max)
  const win = flat.slice(start, end)
  const marked = win.replace(re, (m) => `${HIT_START}${m}${HIT_END}`)
  return `${start > 0 ? '… ' : ''}${marked}${end < flat.length ? ' …' : ''}`
}

export interface SearchGroups { boards: SearchRow[]; cards: SearchRow[] }

/** Boards first, then cards; the flat order is the keyboard order. */
export function groupHits(rows: SearchRow[]): SearchGroups {
  return { boards: rows.filter((r) => r.kind === 'board'), cards: rows.filter((r) => r.kind === 'element') }
}
export const flatHits = (g: SearchGroups): SearchRow[] => [...g.boards, ...g.cards]

/** "Home › Brand refresh" (Home stays: the mock shows it). */
export const pathText = (p: PathItem[]): string => p.map((x) => x.title || 'Untitled board').join(' › ')

/** Selection after an arrow key, wrapping around. */
export const moveSelection = (cur: number, delta: 1 | -1, n: number): number => (n === 0 ? 0 : (cur + delta + n) % n)
