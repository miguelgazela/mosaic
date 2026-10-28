import { describe, expect, it } from 'vitest'
import { toPasteData } from './paste'

describe('toPasteData', () => {
  it('flags a lone URL', () => {
    expect(toPasteData(' https://example.org/a?b=1 ')).toMatchObject({ url: 'https://example.org/a?b=1' })
  })
  it('does not flag text that merely contains a URL', () => {
    expect(toPasteData('see https://example.org now').url).toBeUndefined()
    expect(toPasteData('javascript:alert(1)').url).toBeUndefined()
  })
  it('passes files and omits empty fields', () => {
    const f = new File(['x'], 'a.png')
    expect(toPasteData('', [f])).toEqual({ files: [f] })
    expect(toPasteData(null)).toEqual({})
  })
})
