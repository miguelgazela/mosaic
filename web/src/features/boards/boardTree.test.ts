import { describe, expect, it } from 'vitest'
import { ancestorIds, subtreeIds, visibleRows } from './boardTree'
import type { BoardNode } from './boardRepo'

const b = (id: string, parentId: string | null, title = id): BoardNode => ({ id, parentId, title, icon: null, color: null, isHome: parentId === null })
const nodes = [b('home', null, 'Home'), b('spring', 'home', 'Spring campaign'), b('shots', 'spring', 'Shot list'), b('mood', 'spring', 'Moodboard'), b('brand', 'home', 'Brand refresh'), b('logo', 'brand', 'Logo options')]

describe('boardTree', () => {
  it('lists open boards depth first, children sorted by title', () => {
    const rows = visibleRows(nodes, new Set(['home', 'spring']))
    expect(rows.map((r) => `${r.depth}:${r.node.id}`)).toEqual(['0:home', '1:brand', '1:spring', '2:mood', '2:shots'])
    expect(rows.find((r) => r.node.id === 'brand')).toMatchObject({ hasChildren: true, expanded: false })
  })

  it('shows only Home when nothing is open', () => {
    expect(visibleRows(nodes, new Set()).map((r) => r.node.id)).toEqual(['home'])
  })

  it('a search opens the path to every match and hides the rest', () => {
    expect(visibleRows(nodes, new Set(), 'logo').map((r) => r.node.id)).toEqual(['home', 'brand', 'logo'])
    expect(visibleRows(nodes, new Set(), 'zzz')).toEqual([])
  })

  it('finds ancestors and subtrees', () => {
    expect(ancestorIds(nodes, 'shots')).toEqual(['spring', 'home'])
    expect([...subtreeIds(nodes, ['spring'])].sort()).toEqual(['mood', 'shots', 'spring'])
  })

  it('keeps boards whose parent is missing at the top level', () => {
    expect(visibleRows([b('orphan', 'gone')], new Set()).map((r) => r.node.id)).toEqual(['orphan'])
  })
})
