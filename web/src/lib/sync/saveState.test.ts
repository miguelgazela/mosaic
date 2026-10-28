import { describe, expect, it } from 'vitest'
import { toSaveState } from './saveState'

describe('toSaveState', () => {
  it('maps queue status to the top bar state', () => {
    expect(toSaveState(true, 'saved')).toBe('saved')
    expect(toSaveState(true, 'saving')).toBe('saving')
    expect(toSaveState(true, 'error')).toBe('error')
    expect(toSaveState(false, 'error')).toBe('offline')
    expect(toSaveState(true, 'offline')).toBe('offline')
  })
})
