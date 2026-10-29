import { beforeEach, describe, expect, it } from 'vitest'
import { readRecent, recordRecent, withRecent } from './recent'

describe('recent boards', () => {
  beforeEach(() => localStorage.clear())

  it('puts the newest first and drops repeats', () => {
    expect(withRecent(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c'])
    expect(withRecent([], 'a')).toEqual(['a'])
  })

  it('keeps at most six', () => {
    expect(withRecent(['1', '2', '3', '4', '5', '6'], '7')).toEqual(['7', '1', '2', '3', '4', '5'])
  })

  it('round-trips through localStorage and survives junk', () => {
    recordRecent('a')
    recordRecent('b')
    expect(readRecent()).toEqual(['b', 'a'])
    localStorage.setItem('milanote.recentBoards', '{"no":1}')
    expect(readRecent()).toEqual([])
    localStorage.setItem('milanote.recentBoards', 'not json')
    expect(readRecent()).toEqual([])
  })
})
