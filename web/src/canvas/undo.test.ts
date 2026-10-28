import { describe, expect, it } from 'vitest'
import { batch, UndoStack, type Command } from './undo'

function counter() {
  const s = { n: 0 }
  const add = (d: number): Command => ({ label: `+${d}`, do: () => { s.n += d }, undo: () => { s.n -= d } })
  return { s, add }
}

describe('UndoStack', () => {
  it('exec / undo / redo', () => {
    const { s, add } = counter()
    const st = new UndoStack()
    st.exec(add(1))
    st.exec(add(2))
    expect(s.n).toBe(3)
    st.undo()
    expect(s.n).toBe(1)
    st.redo()
    expect(s.n).toBe(3)
    expect(st.canRedo).toBe(false)
  })
  it('new command clears redo', () => {
    const { s, add } = counter()
    const st = new UndoStack()
    st.exec(add(1))
    st.undo()
    st.exec(add(5))
    expect(st.canRedo).toBe(false)
    expect(s.n).toBe(5)
  })
  it('push records without running', () => {
    const { s, add } = counter()
    const st = new UndoStack()
    s.n = 4
    st.push(add(4))
    st.undo()
    expect(s.n).toBe(0)
  })
  it('keeps at least 100 steps (limit trims oldest)', () => {
    const { s, add } = counter()
    const st = new UndoStack(200)
    for (let i = 0; i < 250; i++) st.exec(add(1))
    let steps = 0
    while (st.undo()) steps++
    expect(steps).toBe(200)
    expect(s.n).toBe(50)
  })
  it('undo on empty is a no-op', () => {
    expect(new UndoStack().undo()).toBeNull()
    expect(new UndoStack().redo()).toBeNull()
  })
  it('batch undoes in reverse', () => {
    const log: string[] = []
    const mk = (n: string): Command => ({ label: n, do: () => log.push(`do ${n}`), undo: () => log.push(`undo ${n}`) })
    const st = new UndoStack()
    st.exec(batch('b', [mk('a'), mk('b')]))
    st.undo()
    expect(log).toEqual(['do a', 'do b', 'undo b', 'undo a'])
  })
})
