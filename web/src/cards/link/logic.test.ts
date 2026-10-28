import { describe, expect, it } from 'vitest'
import { displayUrl, domainOf, embedSrc, formatDuration, linkContent, normalizeUrl } from './logic'
import { toPasteData } from '../../canvas/paste'
import { linkCard } from './linkCard'

describe('normalizeUrl', () => {
  it('adds https and keeps full URLs', () => {
    expect(normalizeUrl('example.com/a')).toBe('https://example.com/a')
    expect(normalizeUrl(' http://example.com ')).toBe('http://example.com/')
  })
  it('rejects junk and other schemes', () => {
    for (const bad of ['', 'hello', 'two words.com', 'javascript:alert(1)', 'ftp://x.com', 'mailto:a@b.co']) expect(normalizeUrl(bad)).toBeNull()
  })
})

describe('helpers', () => {
  it('domain and display', () => {
    expect(domainOf('https://www.example.com/x')).toBe('example.com')
    expect(displayUrl('https://www.example.net/brief/v2/')).toBe('example.net/brief/v2')
  })
  it('duration', () => {
    expect(formatDuration(252)).toBe('4:12')
    expect(formatDuration(3725)).toBe('1:02:05')
  })
  it('embed src', () => {
    expect(embedSrc({ provider: 'youtube', id: 'abc' })).toContain('youtube-nocookie.com/embed/abc')
    expect(embedSrc({ provider: 'vimeo', id: '1' })).toContain('player.vimeo.com/video/1')
  })
  it('linkContent drops bad embed', () => {
    expect(linkContent({ url: 'u', embed: { provider: 'evil', id: 'x' } }).embed).toBeUndefined()
  })
})

describe('link onPaste', () => {
  it('claims a URL paste, ignores plain text', () => {
    expect(linkCard.onPaste?.(toPasteData('just some words'), { x: 0, y: 0 })).toBe(false)
    expect(linkCard.onPaste?.({ files: [new File([''], 'a.png')] }, { x: 0, y: 0 })).toBe(false)
  })
})
