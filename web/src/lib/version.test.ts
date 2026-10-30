import { describe, expect, it } from 'vitest'
import { versionLabel } from './version'

describe('versionLabel', () => {
  it('shows commit and build time', () => {
    const label = versionLabel('a390186', '2026-10-30T14:05:00Z', 'en-GB')
    expect(label.startsWith('a390186 · ')).toBe(true)
    expect(label).toMatch(/Oct/)
  })
  it('falls back to the commit when the time is bad', () => {
    expect(versionLabel('dev', 'nope')).toBe('dev')
  })
})
