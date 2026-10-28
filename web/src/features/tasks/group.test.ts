import { describe, expect, it } from 'vitest'
import { groupTasks, taskPath, type TaskRow } from './group'

const row = (o: Partial<TaskRow>): TaskRow => ({
  element_id: 'e', board_id: 'b', board_path: [{ id: 'b', title: 'Home', icon: null }], card_title: 'This week',
  item_id: 'i', item_text: 't', done: false, due: null, item_pos: 1, ...o,
})

describe('groupTasks', () => {
  const rows = [
    row({ item_id: '1', due: '2027-03-18' }),
    row({ item_id: '2', due: '2027-03-10' }),
    row({ item_id: '3', due: '2027-03-12' }),
    row({ item_id: '4' }),
    row({ item_id: '5', due: '2027-03-11', done: true }),
    row({ item_id: '6', due: '2027-03-11' }),
  ]
  it('splits into ordered groups and hides completed', () => {
    const g = groupTasks(rows, '2027-03-12', false)
    expect(g.map((x) => x.key)).toEqual(['overdue', 'today', 'upcoming', 'none'])
    expect(g[0].tasks.map((t) => t.item_id)).toEqual(['2', '6'])
  })
  it('shows completed on request', () => {
    expect(groupTasks(rows, '2027-03-12', true)[0].tasks.map((t) => t.item_id)).toEqual(['2', '5', '6'])
  })
  it('drops empty groups', () => {
    expect(groupTasks([], '2027-03-12', true)).toEqual([])
  })
  it('builds path', () => {
    expect(taskPath(row({}))).toBe('Home › This week')
    expect(taskPath(row({ card_title: '' }))).toBe('Home')
  })
})
