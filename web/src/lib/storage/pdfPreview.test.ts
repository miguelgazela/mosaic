import { describe, expect, it } from 'vitest'
import { isPdfFile, previewSize } from './pdfPreview'

describe('pdf preview', () => {
  it('detects pdfs by mime or extension', () => {
    expect(isPdfFile({ name: 'a.PDF', type: '' })).toBe(true)
    expect(isPdfFile({ name: 'a', type: 'application/pdf' })).toBe(true)
    expect(isPdfFile({ name: 'a.zip', type: 'application/zip' })).toBe(false)
  })
  it('keeps the page aspect and caps tall pages', () => {
    expect(previewSize(595, 842)).toEqual({ w: 512, h: 725 }) // A4
    const tall = previewSize(100, 1000)
    expect(tall.h).toBeLessThanOrEqual(770)
    expect(tall.w).toBeLessThan(512)
  })
})
