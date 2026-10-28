import { describe, expect, it } from 'vitest'
import { cardSizeFor, fitWithin, isHeic, planImage } from './imagePlan'
import { extOf, formatBytes, originalPath, thumbPath } from './paths'

describe('image plan', () => {
  it('fits the long edge without scaling up', () => {
    expect(fitWithin(5120, 2560, 2560)).toEqual({ w: 2560, h: 1280 })
    expect(fitWithin(1000, 3000, 2560)).toEqual({ w: 853, h: 2560 })
    expect(fitWithin(800, 600, 2560)).toEqual({ w: 800, h: 600 })
  })
  it('leaves small images and gifs alone, re-encodes big ones', () => {
    expect(planImage({ w: 800, h: 600, bytes: 100_000, mime: 'image/png' }).reencode).toBe(false)
    expect(planImage({ w: 8000, h: 6000, bytes: 100_000, mime: 'image/gif' }).reencode).toBe(false)
    const big = planImage({ w: 4000, h: 3000, bytes: 5_000_000, mime: 'image/png' })
    expect(big).toMatchObject({ reencode: true, mime: 'image/webp', out: { w: 2560, h: 1920 }, thumb: { w: 512, h: 384 } })
    expect(planImage({ w: 4000, h: 3000, bytes: 5_000_000, mime: 'image/jpeg' }).mime).toBe('image/jpeg')
  })
  it('detects heic by type or name', () => {
    expect(isHeic({ name: 'a.HEIC', type: '' })).toBe(true)
    expect(isHeic({ name: 'a.jpg', type: 'image/heif' })).toBe(true)
    expect(isHeic({ name: 'a.jpg', type: 'image/jpeg' })).toBe(false)
  })
  it('sizes the card to fit 280 × 360', () => {
    expect(cardSizeFor(2560, 1707)).toEqual({ width: 280, height: 187 })
    expect(cardSizeFor(1000, 3000).height).toBeLessThanOrEqual(360)
    expect(cardSizeFor(40, 40).width).toBe(96)
  })
})

describe('paths', () => {
  it('builds {uid}/{id}/… paths', () => {
    expect(originalPath('u1', 'e1', 'jpg')).toBe('u1/e1/original.jpg')
    expect(thumbPath('u1', 'e1', 'webp')).toBe('u1/e1/thumb.webp')
    expect(extOf('Call Sheet.PDF')).toBe('pdf')
    expect(extOf('README')).toBe('bin')
    expect(formatBytes(48 * 1024)).toBe('48 KB')
    expect(formatBytes(4.2 * 1024 * 1024)).toBe('4.2 MB')
  })
})
