import { describe, expect, it } from 'vitest'
import { confirmText, daysLeft, deletedLabel, describeItem, docText, wasInText } from './describe'
import type { TrashItem } from '../boards/boardRepo'

const item = (p: Partial<TrashItem>): TrashItem => ({
  kind: 'element', id: 'x', type: 'note', title: '', itemCount: 0, icon: null, color: null, content: null, plainText: null, wasIn: [], deletedAt: '2026-03-02T10:00:00Z', ...p,
})

describe('describeItem', () => {
  it('boards show their title and size', () => {
    expect(describeItem(item({ kind: 'board', type: 'board', title: 'Old logo options', itemCount: 18 }))).toEqual({ title: 'Old logo options', kind: 'Board, 18 items' })
    expect(describeItem(item({ kind: 'board', type: 'board', title: '', itemCount: 1 }))).toEqual({ title: 'Untitled board', kind: 'Board, 1 item' })
    expect(describeItem(item({ kind: 'board', type: 'board', title: 'B', itemCount: 0 })).kind).toBe('Board, empty')
  })

  it('notes are quoted and clipped, from plain text or the document', () => {
    const long = 'Drone shots over the bay at sunrise, then the harbour at golden hour, then the old lighthouse'
    expect(describeItem(item({ plainText: long })).title).toMatch(/^“Drone shots .*…”$/)
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'world' }] }] }
    expect(describeItem(item({ content: { doc } })).title).toBe('“Hello world”')
    expect(describeItem(item({ content: { doc: { type: 'doc' } } })).title).toBe('Empty note')
    expect(docText(null)).toBe('')
  })

  it('images, files, links and the rest', () => {
    expect(describeItem(item({ type: 'image', content: { name: 'IMG_1988.jpg' } }))).toEqual({ title: 'IMG_1988.jpg', kind: 'Image' })
    expect(describeItem(item({ type: 'file', content: {} }))).toEqual({ title: 'File', kind: 'File' })
    expect(describeItem(item({ type: 'link', content: { url: 'https://www.example.com/a', title: 'Studio hire rates' } }))).toEqual({ title: 'Studio hire rates', kind: 'Link, example.com' })
    expect(describeItem(item({ type: 'link', content: { url: 'nope' } }))).toEqual({ title: 'nope', kind: 'Link' })
    expect(describeItem(item({ type: 'todo', content: { title: 'This week' } })).title).toBe('This week')
    expect(describeItem(item({ type: 'column', content: {} })).title).toBe('Untitled column')
    expect(describeItem(item({ type: 'swatch', content: { hex: '#fff' } })).title).toBe('#fff')
  })
})

describe('retention', () => {
  const now = new Date('2026-03-12T12:00:00Z').getTime()
  it('counts whole days to the purge, never below zero', () => {
    expect(daysLeft('2026-03-12T10:00:00Z', now)).toBe(30)
    expect(daysLeft('2026-03-02T12:00:00Z', now)).toBe(20)
    expect(daysLeft('2026-01-01T00:00:00Z', now)).toBe(0)
  })

  it('labels the deletion day', () => {
    const local = (y: number, m: number, d: number) => new Date(y, m, d, 9).toISOString()
    const n = new Date(2026, 2, 12, 15).getTime()
    expect(deletedLabel(local(2026, 2, 12), n)).toBe('Today')
    expect(deletedLabel(local(2026, 2, 11), n)).toBe('Yesterday')
    expect(deletedLabel(local(2026, 2, 2), n)).toBe('Mar 2')
  })
})

describe('wasInText / confirmText', () => {
  it('drops Home from a deeper path', () => {
    expect(wasInText([{ id: 'h', title: 'Home', icon: null }, { id: 'a', title: 'Spring campaign', icon: null }, { id: 'b', title: 'Shot list', icon: null }])).toBe('Spring campaign › Shot list')
    expect(wasInText([{ id: 'h', title: 'Home', icon: null }])).toBe('Home')
    expect(wasInText([])).toBe('Home')
  })

  it('warns about what goes with a board', () => {
    expect(confirmText(item({ kind: 'board', type: 'board', itemCount: 18 }))).toBe('The board and its 18 items will be gone for good. This can’t be undone.')
    expect(confirmText(item({ kind: 'board', type: 'board', itemCount: 0 }))).toBe('The board will be gone for good. This can’t be undone.')
    expect(confirmText(item({}))).toContain('This card')
  })
})
