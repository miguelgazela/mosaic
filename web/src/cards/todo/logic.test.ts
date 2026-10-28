import { describe, expect, it } from 'vitest'
import { addDays, dueKind, dueLabel, insertItem, monthGrid, moveItem, nextMonday, progress, readTodo, removeItem, setItem, todoMarkdown, writeTodo } from './logic'

const items = [
  { id: 'a', text: 'A', done: true },
  { id: 'b', text: 'B', done: false, due: '2027-03-18' },
  { id: 'c', text: 'C', done: false },
]

describe('todo logic', () => {
  it('reads defensively', () => {
    expect(readTodo({})).toEqual({ title: undefined, hideCompleted: false, items: [] })
    expect(readTodo({ items: [{ id: 'x', text: 1, done: 'yes' }, null, { text: 'no id' }] }).items).toEqual([{ id: 'x', text: '1', done: false, due: undefined }])
  })
  it('write keeps unknown keys and drops empty due', () => {
    const out = writeTodo({ extra: 1 }, { hideCompleted: true, items: [{ id: 'a', text: 'A', done: false, due: undefined }] })
    expect(out).toEqual({ extra: 1, title: undefined, hideCompleted: true, items: [{ id: 'a', text: 'A', done: false }] })
  })
  it('progress', () => {
    expect(progress(items)).toEqual({ done: 1, total: 3, ratio: 1 / 3 })
    expect(progress([]).ratio).toBe(0)
  })
  it('classifies due dates', () => {
    expect(dueKind('2027-03-09', '2027-03-10')).toBe('overdue')
    expect(dueKind('2027-03-10', '2027-03-10')).toBe('today')
    expect(dueKind('2027-03-11', '2027-03-10')).toBe('upcoming')
    expect(dueLabel('2027-03-10', '2027-03-12')).toBe('Overdue, Mar 10')
    expect(dueLabel('2027-03-12', '2027-03-12')).toBe('Today')
    expect(dueLabel('2027-03-18', '2027-03-12')).toBe('Mar 18')
  })
  it('date helpers', () => {
    expect(addDays('2027-03-31', 1)).toBe('2027-04-01')
    expect(nextMonday('2027-03-12')).toBe('2027-03-15') // Friday -> Monday
    expect(nextMonday('2027-03-15')).toBe('2027-03-22') // Monday -> following Monday
  })
  it('edits', () => {
    expect(setItem(items, 'c', { done: true })[2].done).toBe(true)
    expect(removeItem(items, 'b').map((i) => i.id)).toEqual(['a', 'c'])
    expect(insertItem(items, { id: 'n', text: '', done: false }, 'a').map((i) => i.id)).toEqual(['a', 'n', 'b', 'c'])
    expect(insertItem(items, { id: 'n', text: '', done: false }).map((i) => i.id)).toEqual(['a', 'b', 'c', 'n'])
  })
  it('moves items, clamped', () => {
    expect(moveItem(items, 'a', 2).map((i) => i.id)).toEqual(['b', 'c', 'a'])
    expect(moveItem(items, 'c', -5).map((i) => i.id)).toEqual(['c', 'a', 'b'])
    expect(moveItem(items, 'x', 1)).toBe(items)
  })
  it('markdown', () => {
    expect(todoMarkdown({ title: 'T', hideCompleted: false, items })).toBe('**T**\n- [x] A\n- [ ] B (due 2027-03-18)\n- [ ] C')
  })
  it('month grid starts Monday', () => {
    const g = monthGrid(2027, 2) // March 2027, 1st is a Monday
    expect(g[0][0]).toBe('2027-03-01')
    expect(g.at(-1)!.at(-1)).toBeNull()
    expect(g.flat().filter(Boolean)).toHaveLength(31)
  })
})
