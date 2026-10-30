/** Pure helpers over TipTap JSON, so search text and Markdown export need no editor. */
export interface DocNode {
  type: string
  attrs?: Record<string, unknown>
  content?: DocNode[]
  text?: string
  marks?: { type: string; attrs?: Record<string, unknown> }[]
}

export const emptyDoc = (): DocNode => ({ type: 'doc', content: [{ type: 'paragraph' }] })

export function docOf(content: Record<string, unknown>): DocNode {
  const d = content.doc as DocNode | undefined
  return d && d.type === 'doc' ? d : emptyDoc()
}

/** One paragraph per line of pasted text. */
export function textToDoc(text: string): DocNode {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\s+$/, '').split('\n')
  return { type: 'doc', content: lines.map((l) => (l ? { type: 'paragraph', content: [{ type: 'text', text: l }] } : { type: 'paragraph' })) }
}

const inline = (n: DocNode): string =>
  n.type === 'text' ? (n.text ?? '') : n.type === 'hardBreak' ? '\n' : (n.content ?? []).map(inline).join('')

/** Plain text, one block per line (lists: one item per line). */
export function docToText(doc: DocNode): string {
  const lines: string[] = []
  const walk = (n: DocNode) => {
    if (n.type === 'paragraph' || n.type === 'heading' || n.type === 'codeBlock') lines.push(inline(n))
    else for (const c of n.content ?? []) walk(c)
  }
  walk(doc)
  return lines.join('\n').trim()
}

export const isEmptyDoc = (doc: DocNode): boolean => docToText(doc) === ''

function mark(text: string, marks: DocNode['marks'] = []): string {
  if (!text.trim()) return text
  const lead = /^\s*/.exec(text)![0]
  const trail = /\s*$/.exec(text)![0]
  let out = text.trim()
  for (const m of marks) {
    if (m.type === 'code') out = `\`${out}\``
    else if (m.type === 'bold') out = `**${out}**`
    else if (m.type === 'italic') out = `_${out}_`
    else if (m.type === 'strike') out = `~~${out}~~`
    else if (m.type === 'underline') out = `<u>${out}</u>`
    else if (m.type === 'highlight') out = `==${out}==`
    else if (m.type === 'link') out = `[${out}](${String(m.attrs?.href ?? '')})`
  }
  return lead + out + trail
}

const mdInline = (n: DocNode): string =>
  n.type === 'text' ? mark(n.text ?? '', n.marks) : n.type === 'hardBreak' ? '  \n' : (n.content ?? []).map(mdInline).join('')

function mdBlock(n: DocNode, indent = ''): string[] {
  switch (n.type) {
    case 'heading':
      return [`${'#'.repeat(Number(n.attrs?.level ?? 1))} ${mdInline(n)}`]
    case 'paragraph':
      return [indent + mdInline(n)]
    case 'blockquote':
      return (n.content ?? []).flatMap((c) => mdBlock(c)).map((l) => `> ${l}`)
    case 'codeBlock':
      return ['```', inline(n), '```']
    case 'bulletList':
    case 'orderedList':
    case 'taskList':
      return (n.content ?? []).flatMap((item, i) => {
        const [first, ...rest] = (item.content ?? []).flatMap((c) =>
          c.type === 'bulletList' || c.type === 'orderedList' || c.type === 'taskList' ? mdBlock(c, indent + '  ') : mdBlock(c),
        )
        const bullet =
          n.type === 'orderedList' ? `${Number(n.attrs?.start ?? 1) + i}.` : n.type === 'taskList' ? `- [${item.attrs?.checked ? 'x' : ' '}]` : '-'
        return [`${indent}${bullet} ${first ?? ''}`, ...rest]
      })
    default:
      return (n.content ?? []).flatMap((c) => mdBlock(c, indent))
  }
}

/** Markdown for export. Blocks are separated by blank lines, list items are not. */
export function docToMarkdown(doc: DocNode): string {
  const out: string[] = []
  for (const block of doc.content ?? []) {
    const lines = mdBlock(block)
    if (lines.length) out.push(lines.join('\n'))
  }
  return out.join('\n\n').trim()
}

/**
 * Flip the `checked` attr of the nth task item (document order, nested items after their parent, the same order
 * as the checkboxes in the rendered HTML). Returns a new doc, or null when there is no such item.
 */
export function toggleTaskItem(doc: DocNode, index: number): DocNode | null {
  let i = 0
  let hit = false
  const walk = (n: DocNode): DocNode => {
    let out = n
    if (n.type === 'taskItem') {
      if (i === index) { hit = true; out = { ...n, attrs: { ...n.attrs, checked: !n.attrs?.checked } } }
      i++
    }
    if (n.content) {
      const kids = n.content.map(walk)
      if (kids.some((k, j) => k !== n.content![j])) out = { ...out, content: kids }
    }
    return out
  }
  const next = walk(doc)
  return hit ? next : null
}
