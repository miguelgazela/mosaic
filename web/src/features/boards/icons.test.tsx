import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { BOARD_ICONS, BoardIcon, BoardTile } from './icons'

const svgs = (html: string) => (html.match(/<svg/g) ?? []).length

describe('board icons', () => {
  it('offers the 12 icons of the design', () => {
    expect(BOARD_ICONS.map((i) => i.key)).toEqual([
      'star', 'camera', 'image', 'folder', 'lightbulb', 'heart', 'calendar', 'flag', 'rocket', 'palette', 'book', 'music',
    ])
  })

  it.each(BOARD_ICONS.map((i) => i.key))('renders picker key %s', (key) => {
    expect(svgs(renderToStaticMarkup(<BoardIcon icon={key} />))).toBe(1)
  })

  // Boards saved before D2 keep their icon even though the picker no longer lists these.
  it.each(['layout', 'pencil', 'bookmark', 'globe', 'home', 'leaf', 'archive', 'film'])('still renders legacy key %s', (key) => {
    expect(svgs(renderToStaticMarkup(<BoardIcon icon={key} />))).toBe(1)
    expect(svgs(renderToStaticMarkup(<BoardTile icon={key} size={64} glyph={28} />))).toBe(1)
  })

  it('null icon falls back to the board glyph, anything else is an emoji', () => {
    expect(svgs(renderToStaticMarkup(<BoardIcon icon={null} />))).toBe(1)
    const html = renderToStaticMarkup(<BoardIcon icon="🎬" />)
    expect(svgs(html)).toBe(0)
    expect(html).toContain('🎬')
  })

  it('tile uses the board tokens, a custom colour replaces the grey tile', () => {
    expect(renderToStaticMarkup(<BoardTile icon="star" size={20} glyph={12} />)).toContain('var(--board-tile)')
    const tinted = renderToStaticMarkup(<BoardTile icon="star" color="2" size={20} glyph={12} />)
    expect(tinted).toContain('var(--card-color-2)')
    expect(tinted).not.toContain('var(--board-tile)')
  })
})
