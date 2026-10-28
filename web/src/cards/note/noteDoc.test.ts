import { describe, expect, it } from 'vitest'
import { docToMarkdown, docToText, emptyDoc, isEmptyDoc, textToDoc, type DocNode } from './noteDoc'

const p = (...content: DocNode[]): DocNode => ({ type: 'paragraph', content })
const t = (text: string, marks?: DocNode['marks']): DocNode => ({ type: 'text', text, marks })

const doc: DocNode = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [t('Morning')] },
    p(t('Set up by '), t('8:30', [{ type: 'bold' }]), t('. See '), t('notes', [{ type: 'link', attrs: { href: 'https://x.test' } }])),
    { type: 'bulletList', content: [{ type: 'listItem', content: [p(t('Batteries'))] }, { type: 'listItem', content: [p(t('Tape'))] }] },
    { type: 'orderedList', content: [{ type: 'listItem', content: [p(t('One'))] }, { type: 'listItem', content: [p(t('Two'))] }] },
    { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [p(t('Signed'))] }, { type: 'taskItem', attrs: { checked: false }, content: [p(t('Lunch'))] }] },
    { type: 'blockquote', content: [p(t('Keep it early'))] },
  ],
}

describe('noteDoc', () => {
  it('extracts one line per block', () => {
    expect(docToText(doc)).toBe('Morning\nSet up by 8:30. See notes\nBatteries\nTape\nOne\nTwo\nSigned\nLunch\nKeep it early')
  })
  it('writes markdown', () => {
    expect(docToMarkdown(doc)).toBe(
      [
        '## Morning',
        'Set up by **8:30**. See [notes](https://x.test)',
        '- Batteries\n- Tape',
        '1. One\n2. Two',
        '- [x] Signed\n- [ ] Lunch',
        '> Keep it early',
      ].join('\n\n'),
    )
  })
  it('keeps spaces outside marks', () => {
    expect(docToMarkdown({ type: 'doc', content: [p(t(' hi ', [{ type: 'italic' }]))] })).toBe('_hi_')
  })
  it('turns pasted text into paragraphs', () => {
    const d = textToDoc('a\r\n\nb\n')
    expect(d.content).toHaveLength(3)
    expect(docToText(d)).toBe('a\n\nb')
  })
  it('knows when a note is empty', () => {
    expect(isEmptyDoc(emptyDoc())).toBe(true)
    expect(isEmptyDoc(textToDoc('x'))).toBe(false)
  })
})
