import { describe, expect, it } from 'vitest'
import { normalizeHex } from './hex'

describe('normalizeHex', () => {
  it('accepts 3 and 6 digit forms with or without #', () => {
    expect(normalizeHex('#d98f72')).toBe('#D98F72')
    expect(normalizeHex('abc')).toBe('#AABBCC')
    expect(normalizeHex(' #FFF ')).toBe('#FFFFFF')
  })
  it('rejects anything else', () => {
    for (const bad of ['', '#12', '#12345', 'zzzzzz', '#1234567', 'red']) expect(normalizeHex(bad)).toBeNull()
  })
})
