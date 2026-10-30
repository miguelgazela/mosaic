import { assertEquals } from 'jsr:@std/assert@1'
import { detectVideo, jsonLdImage, merge, parseHtml, parseOembed } from './parse.ts'

const base = new URL('https://example.com/post/1')

Deno.test('OpenGraph wins, relative image resolved, entities decoded', () => {
  const html = `<html><head><title>Fallback</title>
    <meta property="og:title" content="Tom &amp; Jerry &#39;24">
    <meta property="og:description" content="A   long
    description">
    <meta property="og:image" content="/img/a.jpg">
    <link rel="icon" href="/fav.png"></head><body></body></html>`
  assertEquals(parseHtml(html, base), {
    title: "Tom & Jerry '24",
    description: 'A long description',
    image: 'https://example.com/img/a.jpg',
    favicon: 'https://example.com/fav.png',
  })
})

Deno.test('falls back to twitter meta, then <title>, then /favicon.ico', () => {
  const tw = parseHtml('<head><meta name="twitter:title" content="T"><meta name="twitter:image" content="https://cdn.x/i.png"></head>', base)
  assertEquals([tw.title, tw.image, tw.favicon], ['T', 'https://cdn.x/i.png', 'https://example.com/favicon.ico'])
  assertEquals(parseHtml('<head><title> Plain </title></head>', base).title, 'Plain')
})

Deno.test('non-http image URLs are dropped', () => {
  assertEquals(parseHtml('<head><meta property="og:image" content="javascript:alert(1)"></head>', base).image, undefined)
})

Deno.test('video detection', () => {
  const d = (s: string) => detectVideo(new URL(s))
  assertEquals(d('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), { provider: 'youtube', id: 'dQw4w9WgXcQ' })
  assertEquals(d('https://youtu.be/dQw4w9WgXcQ?t=3'), { provider: 'youtube', id: 'dQw4w9WgXcQ' })
  assertEquals(d('https://youtube.com/shorts/abcdefghijk'), { provider: 'youtube', id: 'abcdefghijk' })
  assertEquals(d('https://vimeo.com/76979871'), { provider: 'vimeo', id: '76979871' })
  assertEquals(d('https://github.com/a/b'), null)
  assertEquals(d('https://youtube.com/'), null)
})

Deno.test('oembed mapping + merge keeps oembed values', () => {
  const v = { provider: 'youtube' as const, id: 'abcdefghijk' }
  const o = parseOembed({ title: 'Vid', thumbnail_url: 'https://i.ytimg.com/x.jpg' }, v, base)
  assertEquals(o.embed, v)
  const m = merge(o, { title: 'Page title', description: 'D' })
  assertEquals([m.title, m.description], ['Vid', 'D'])
})

Deno.test('image falls back to JSON-LD when there is no og:image (e.g. shop product pages)', () => {
  const html = `<html><head><title>Shorts</title></head><body>
    <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"ProductGroup","name":"x"},{"@type":"Product","image":"https://cdn.example.com/p/1.jpg"}]}</script>
  </body></html>`
  const r = parseHtml(html, new URL('https://shop.example.com/p/1'))
  assertEquals(r.title, 'Shorts')
  assertEquals(r.image, 'https://cdn.example.com/p/1.jpg')
})

Deno.test('JSON-LD image: arrays, ImageObject, bad JSON skipped; og:image still wins', () => {
  assertEquals(jsonLdImage('<script type="application/ld+json">{bad</script><script type="application/ld+json">{"image":[{"@type":"ImageObject","url":"/a.jpg"}]}</script>'), '/a.jpg')
  assertEquals(jsonLdImage('<p>none</p>'), undefined)
  const html = '<head><meta property="og:image" content="https://x.com/og.jpg"></head><script type="application/ld+json">{"image":"https://x.com/ld.jpg"}</script>'
  assertEquals(parseHtml(html, new URL('https://x.com/')).image, 'https://x.com/og.jpg')
})
