const KEY = 'milanote.recentBoards'
export const RECENT_MAX = 6

/** `id` first, the rest as they were, no repeats, at most `max`. */
export const withRecent = (ids: string[], id: string, max = RECENT_MAX): string[] => [id, ...ids.filter((i) => i !== id)].slice(0, max)

export function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, RECENT_MAX) : []
  } catch {
    return []
  }
}

/** Remember that a board was opened (Home's Recent strip, later the search palette). Per browser. */
export function recordRecent(id: string): void {
  try { localStorage.setItem(KEY, JSON.stringify(withRecent(readRecent(), id))) } catch { /* private mode: no recents */ }
}
