import { dueKind } from '../../cards/todo/logic'

export interface TaskRow {
  element_id: string
  board_id: string
  board_path: { id: string; title: string; icon: string | null }[]
  card_title: string
  item_id: string
  item_text: string
  done: boolean
  due: string | null
  item_pos: number
}

export type GroupKey = 'overdue' | 'today' | 'upcoming' | 'none'
export interface TaskGroup { key: GroupKey; label: string; tasks: TaskRow[] }

const LABELS: Record<GroupKey, string> = { overdue: 'Overdue', today: 'Today', upcoming: 'Upcoming', none: 'No date' }

/** "Spring campaign › Before the shoot": board path, then the to-do's title when it has one. */
export const taskPath = (t: TaskRow): string =>
  [...t.board_path.map((p) => p.title), t.card_title].filter(Boolean).join(' › ')

/** Groups in fixed order, empty ones dropped. Dated groups sort by due date, then card position. */
export function groupTasks(rows: TaskRow[], today: string, showCompleted: boolean): TaskGroup[] {
  const buckets: Record<GroupKey, TaskRow[]> = { overdue: [], today: [], upcoming: [], none: [] }
  for (const t of rows) {
    if (t.done && !showCompleted) continue
    buckets[t.due ? dueKind(t.due, today) : 'none'].push(t)
  }
  for (const k of ['overdue', 'today', 'upcoming'] as const) {
    buckets[k].sort((a, b) => (a.due! < b.due! ? -1 : a.due! > b.due! ? 1 : 0))
  }
  return (['overdue', 'today', 'upcoming', 'none'] as const)
    .filter((k) => buckets[k].length)
    .map((k) => ({ key: k, label: LABELS[k], tasks: buckets[k] }))
}
