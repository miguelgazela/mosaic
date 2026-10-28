import { describe, expect, it } from 'vitest'
import { compareZ, keysAfter, keysBefore } from './order'

describe('fractional index helpers', () => {
  it('first keys on empty set ascend', () => {
    const k = keysAfter([], 3)
    expect([...k].sort(compareZ)).toEqual(k)
    expect(new Set(k).size).toBe(3)
  })
  it('keysAfter sorts after all existing', () => {
    const base = keysAfter([], 3)
    const [k] = keysAfter(base, 1)
    for (const b of base) expect(compareZ(k, b)).toBe(1)
  })
  it('keysBefore sorts before all existing, ascending', () => {
    const base = keysAfter([], 3)
    const ks = keysBefore(base, 2)
    for (const b of base) for (const k of ks) expect(compareZ(k, b)).toBe(-1)
    expect(compareZ(ks[0], ks[1])).toBe(-1)
  })
  it('n=0 gives empty', () => {
    expect(keysAfter(['a0'], 0)).toEqual([])
  })
})
