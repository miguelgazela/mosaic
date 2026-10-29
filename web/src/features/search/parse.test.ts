import { describe, expect, it } from 'vitest'
import { flatHits, groupHits, HIT_END, HIT_START, markSnippet, moveSelection, parseSnippet, pathText, queryWords, type SearchRow } from './parse'

const row = (kind: SearchRow['kind'], id: string): SearchRow => ({ kind, id, boardId: 'b', type: 'note', title: '', snippet: '', path: [], icon: null, color: null })

describe('parseSnippet', () => {
  it('splits plain and highlighted text', () => {
    expect(parseSnippet(`Warm. ${HIT_START}Linen${HIT_END} and clay`)).toEqual([
      { text: 'Warm. ', hit: false }, { text: 'Linen', hit: true }, { text: ' and clay', hit: false },
    ])
  })
  it('collapses newlines and tolerates no marks or a stray marker', () => {
    expect(parseSnippet('a\n\nb')).toEqual([{ text: 'a b', hit: false }])
    expect(parseSnippet(`x ${HIT_START}open`)).toEqual([{ text: 'x open', hit: false }])
    expect(parseSnippet('')).toEqual([])
  })
})

describe('markSnippet / queryWords', () => {
  it('splits a query into words', () => {
    expect(queryWords('  Shot, li ')).toEqual(['shot', 'li'])
    expect(queryWords('???')).toEqual([])
  })
  it('marks prefix matches only at word starts', () => {
    expect(markSnippet('Linen backdrop, pressed', ['lin'])).toBe(`${HIT_START}Linen${HIT_END} backdrop, pressed`)
    expect(markSnippet('bush', ['us'])).toBe('bush')
  })
  it('windows long text around the first match', () => {
    const t = `${'word '.repeat(40)}needle ${'tail '.repeat(40)}`
    const s = markSnippet(t, ['needle'], 60)
    expect(s.startsWith('… ')).toBe(true)
    expect(s.endsWith(' …')).toBe(true)
    expect(s).toContain(`${HIT_START}needle${HIT_END}`)
    expect(s.length).toBeLessThan(80)
  })
  it('escapes regex characters', () => {
    expect(() => markSnippet('a (b)', ['(b'])).not.toThrow()
  })
})

describe('grouping', () => {
  it('puts boards before cards and keeps order within a group', () => {
    const g = groupHits([row('element', 'c1'), row('board', 'b1'), row('element', 'c2'), row('board', 'b2')])
    expect(g.boards.map((r) => r.id)).toEqual(['b1', 'b2'])
    expect(flatHits(g).map((r) => r.id)).toEqual(['b1', 'b2', 'c1', 'c2'])
  })
  it('formats the breadcrumb', () => {
    expect(pathText([{ id: '1', title: 'Home', icon: null }, { id: '2', title: 'Brand refresh', icon: null }])).toBe('Home › Brand refresh')
    expect(pathText([])).toBe('')
  })
  it('wraps the keyboard selection', () => {
    expect(moveSelection(0, -1, 3)).toBe(2)
    expect(moveSelection(2, 1, 3)).toBe(0)
    expect(moveSelection(0, 1, 0)).toBe(0)
  })
})
