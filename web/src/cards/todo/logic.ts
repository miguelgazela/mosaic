/** Pure to-do logic: content shape, due dates, edits. No React, no store. */
export interface TodoItem { id: string; text: string; done: boolean; due?: string }
export interface TodoContent { title?: string; hideCompleted: boolean; items: TodoItem[] }

export function readTodo(content: Record<string, unknown>): TodoContent {
  const items = Array.isArray(content.items) ? (content.items as TodoItem[]).filter((i) => i && typeof i.id === 'string') : []
  return {
    title: typeof content.title === 'string' ? content.title : undefined,
    hideCompleted: content.hideCompleted === true,
    items: items.map((i) => ({ id: i.id, text: String(i.text ?? ''), done: i.done === true, due: i.due || undefined })),
  }
}

/** Content patch value: keeps unknown keys, writes the known ones. */
export const writeTodo = (prev: Record<string, unknown>, next: TodoContent): Record<string, unknown> => ({
  ...prev,
  title: next.title,
  hideCompleted: next.hideCompleted,
  items: next.items.map(({ id, text, done, due }) => (due ? { id, text, done, due } : { id, text, done })),
})

export const progress = (items: TodoItem[]): { done: number; total: number; ratio: number } => {
  const done = items.filter((i) => i.done).length
  return { done, total: items.length, ratio: items.length ? done / items.length : 0 }
}

export type DueKind = 'overdue' | 'today' | 'upcoming'

const pad = (n: number) => String(n).padStart(2, '0')
/** Local calendar day as `YYYY-MM-DD`. */
export const isoDay = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** ISO date strings compare correctly as text. */
export const dueKind = (due: string, today: string): DueKind => (due < today ? 'overdue' : due === today ? 'today' : 'upcoming')

export const parseDay = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const MONTH = new Intl.DateTimeFormat('en', { month: 'short' })
const WEEKDAY = new Intl.DateTimeFormat('en', { weekday: 'short' })
export const shortDate = (iso: string): string => `${MONTH.format(parseDay(iso))} ${parseDay(iso).getDate()}`
export const longDate = (iso: string): string => `${WEEKDAY.format(parseDay(iso))}, ${shortDate(iso)}`

/** Chip text: always words, never colour alone. */
export const dueLabel = (due: string, today: string): string => {
  const k = dueKind(due, today)
  return k === 'today' ? 'Today' : k === 'overdue' ? `Overdue, ${shortDate(due)}` : shortDate(due)
}

export const addDays = (iso: string, n: number): string => {
  const d = parseDay(iso)
  d.setDate(d.getDate() + n)
  return isoDay(d)
}
/** Monday on or after tomorrow's week: "Next week" = the coming Monday. */
export const nextMonday = (iso: string): string => {
  const d = parseDay(iso)
  return addDays(iso, ((8 - d.getDay()) % 7) || 7)
}

export const setItem = (items: TodoItem[], id: string, patch: Partial<TodoItem>): TodoItem[] =>
  items.map((i) => (i.id === id ? { ...i, ...patch } : i))
export const removeItem = (items: TodoItem[], id: string): TodoItem[] => items.filter((i) => i.id !== id)
export function insertItem(items: TodoItem[], item: TodoItem, afterId?: string): TodoItem[] {
  const at = afterId ? items.findIndex((i) => i.id === afterId) + 1 : items.length
  return [...items.slice(0, at), item, ...items.slice(at)]
}
export function moveItem(items: TodoItem[], id: string, to: number): TodoItem[] {
  const from = items.findIndex((i) => i.id === id)
  if (from < 0) return items
  const t = Math.max(0, Math.min(items.length - 1, to))
  if (t === from) return items
  const out = items.slice()
  const [it] = out.splice(from, 1)
  out.splice(t, 0, it)
  return out
}

export const hiddenCount = (c: TodoContent): number => (c.hideCompleted ? c.items.filter((i) => i.done).length : 0)

export const todoPlainText = (c: TodoContent): string => [c.title, ...c.items.map((i) => i.text)].filter(Boolean).join('\n')
export const todoMarkdown = (c: TodoContent): string =>
  [c.title ? `**${c.title}**` : '', ...c.items.map((i) => `- [${i.done ? 'x' : ' '}] ${i.text}${i.due ? ` (due ${i.due})` : ''}`)]
    .filter(Boolean)
    .join('\n')

/** Month grid for the picker: weeks starting Monday, null = padding. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(year, month, 1)
  const lead = (first.getDay() + 6) % 7
  const days = new Date(year, month + 1, 0).getDate()
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => isoDay(new Date(year, month, i + 1)))]
  while (cells.length % 7) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7))
}
