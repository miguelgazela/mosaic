import { describe, expect, it } from 'vitest'
import { isUuid, newId } from './ids'

describe('ids', () => {
  it('generates valid uuids', () => {
    expect(isUuid(newId())).toBe(true)
  })
  it('rejects junk', () => {
    expect(isUuid('nope')).toBe(false)
  })
})
