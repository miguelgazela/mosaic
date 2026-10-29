import { describe, expect, it } from 'vitest'
import type { CanvasElement } from '../../canvas/types'
import { boardToMarkdown } from './markdown'
import { assetPathFor, relativeLink, safeName, uniqueName } from './paths'
import { planBoards } from './plan'
import { pixelRatioFor } from './image'

const el = (id: string, type: string, content: Record<string, unknown>, o: Partial<CanvasElement> = {}): CanvasElement => ({
  id, type, x: 0, y: 0, width: 240, height: null, z: 'a0', color: null, parentId: null, sortKey: null, content, ...o,
})
const p = (text: string, marks?: object[]) => ({ type: 'paragraph', content: [{ type: 'text', text, marks }] })

describe('boardToMarkdown', () => {
  it('writes every card type in reading order', () => {
    const elements: CanvasElement[] = [
      el('n1', 'note', { doc: { type: 'doc', content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Plan' }] }, p('Bold', [{ type: 'bold' }]), p('see'), ] } }, { x: 0, y: 0 }),
      el('t1', 'todo', { title: 'Tasks', items: [{ id: 'a', text: 'One', done: true }, { id: 'b', text: 'Two', done: false, due: '2026-11-02' }] }, { x: 300, y: 0 }),
      el('l1', 'link', { url: 'https://example.com', title: 'Example' }, { x: 0, y: 200 }),
      el('s1', 'swatch', { name: 'Sky', hex: '#aabbcc' }, { x: 300, y: 200 }),
      el('i1', 'image', { path: 'u/i1/original.png', name: 'cat.png', caption: 'A cat', w: 3, h: 2, bytes: 1 }, { x: 0, y: 400 }),
      el('f1', 'file', { path: 'u/f1/original.pdf', name: 'spec.pdf', mime: 'application/pdf', bytes: 1 }, { x: 300, y: 400 }),
      el('b1', 'board', { boardId: 'child' }, { x: 0, y: 600 }),
      el('c1', 'column', { title: 'Ideas' }, { x: 300, y: 600 }),
      el('cn2', 'note', { doc: { type: 'doc', content: [p('second')] } }, { parentId: 'c1', sortKey: 'b' }),
      el('cn1', 'note', { doc: { type: 'doc', content: [p('first')] } }, { parentId: 'c1', sortKey: 'a' }),
    ]
    const md = boardToMarkdown({ title: 'Home', elements, path: 'Home.md', boardPaths: { child: { title: 'Child board', path: 'Home/Child board.md' } } })
    expect(md).toMatchSnapshot()
  })

  it('links assets and sub-boards relative to the file', () => {
    const elements = [el('abcdefgh1', 'image', { path: 'x', name: 'a b.png', caption: '' }), el('b', 'board', { boardId: 'g' }, { y: 100 })]
    const md = boardToMarkdown({ title: 'Deep', elements, path: 'Home/Sub/Deep.md', boardPaths: { g: { title: 'G', path: 'Home/Sub/Deep/G.md' } } })
    expect(md).toContain('![a b.png](../../assets/abcdefgh-a%20b.png)')
    expect(md).toContain('[G](Deep/G.md)')
  })

  it('skips board cards whose board is not exported and images without a file', () => {
    const md = boardToMarkdown({ title: 'X', elements: [el('b', 'board', { boardId: 'zz' }), el('i', 'image', { name: 'p.png' }, { y: 99 })], path: 'X.md', boardPaths: {} })
    expect(md).toBe('# X\n\n_Image: p.png_\n')
  })
})

describe('paths', () => {
  it('safeName strips separators', () => expect(safeName('a/b:c?')).toBe('a-b-c-'))
  it('safeName falls back', () => expect(safeName('  ', 'Untitled')).toBe('Untitled'))
  it('assetPathFor is stable', () => expect(assetPathFor({ id: '12345678-aaaa', content: { name: 'x/y.png' } })).toBe('assets/12345678-x-y.png'))
  it('relativeLink', () => {
    expect(relativeLink('A.md', 'A/B.md')).toBe('A/B.md')
    expect(relativeLink('A/B.md', 'A.md')).toBe('../A.md')
    expect(relativeLink('A/B/C.md', 'assets/x y.png')).toBe('../../assets/x%20y.png')
  })
  it('uniqueName', () => {
    const t = new Set<string>()
    expect([uniqueName(t, 'Ideas'), uniqueName(t, 'ideas'), uniqueName(t, 'Ideas')]).toEqual(['Ideas', 'ideas 2', 'Ideas 3'])
  })
})

describe('planBoards', () => {
  const n = (id: string, parentId: string | null, title: string) => ({ id, parentId, title, icon: null, color: null, isHome: false })
  it('mirrors the tree and de-duplicates sibling names', () => {
    const nodes = [n('h', null, 'Home'), n('a', 'h', 'Ideas'), n('b', 'h', 'Ideas'), n('c', 'a', 'Deep'), n('z', null, 'Other')]
    expect(planBoards(nodes, 'h', 'Home').map((b) => [b.id, b.path])).toEqual([
      ['h', 'Home.md'], ['a', 'Home/Ideas.md'], ['c', 'Home/Ideas/Deep.md'], ['b', 'Home/Ideas 2.md'],
    ])
  })
})

describe('pixelRatioFor', () => {
  it('caps huge boards', () => {
    expect(pixelRatioFor(1000, 800)).toBe(2)
    expect(pixelRatioFor(16000, 800)).toBeCloseTo(0.512)
  })
})
