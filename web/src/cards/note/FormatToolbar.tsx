import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/react'
import {
  Bold, ChevronDown, Code, Highlighter, Italic, Link as LinkIcon, List, ListChecks, ListOrdered, Strikethrough, TextQuote, Underline,
} from 'lucide-react'

const HIGHLIGHTS = [
  { label: 'Yellow', value: 'var(--card-color-1)' },
  { label: 'Green', value: 'var(--card-color-6)' },
  { label: 'Blue', value: 'var(--card-color-5)' },
  { label: 'Pink', value: 'var(--card-color-3)' },
]

const btn =
  'flex h-8 min-w-8 items-center justify-center rounded-[var(--radius-ui)] px-1.5 text-white/90 hover:bg-white/10 aria-pressed:bg-white/20 aria-pressed:text-white'

/** Floating dark toolbar 8 px above the text selection (00-card-note). Mouse-down is cancelled so the editor keeps focus. */
export function FormatToolbar({ editor }: { editor: Editor }) {
  const [, bump] = useState(0)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [menu, setMenu] = useState<'heading' | 'highlight' | null>(null)
  const [linkDraft, setLinkDraft] = useState<string | null>(null)

  useEffect(() => {
    const update = () => {
      const { from, to, empty } = editor.state.selection
      if (empty || !editor.isFocused && linkDraft === null) { setPos(null); return }
      const a = editor.view.coordsAtPos(from)
      const b = editor.view.coordsAtPos(to)
      setPos({ x: (Math.min(a.left, b.left) + Math.max(a.right, b.right)) / 2, y: Math.min(a.top, b.top) })
      bump((n) => n + 1)
    }
    editor.on('selectionUpdate', update)
    editor.on('transaction', update)
    editor.on('focus', update)
    editor.on('blur', update)
    update()
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('transaction', update)
      editor.off('focus', update)
      editor.off('blur', update)
    }
  }, [editor, linkDraft])

  if (!pos) return null
  const run = editor.chain().focus()
  const heading = editor.isActive('heading', { level: 1 }) ? 'Heading 1' : editor.isActive('heading', { level: 2 }) ? 'Heading 2' : editor.isActive('heading', { level: 3 }) ? 'Heading 3' : 'Body'
  const no = (e: React.MouseEvent) => e.preventDefault()

  const applyLink = (url: string) => {
    const href = url.trim()
    if (!href) editor.chain().focus().extendMarkRange('link').unsetLink().run()
    else editor.chain().focus().extendMarkRange('link').setLink({ href: /^[a-z][a-z0-9+.-]*:/i.test(href) ? href : `https://${href}` }).run()
    setLinkDraft(null)
  }

  return createPortal(
    <div
      data-testid="format-toolbar"
      role="toolbar"
      aria-label="Text formatting"
      className="fixed z-[3000000] flex -translate-x-1/2 -translate-y-full items-center gap-0.5 rounded-[var(--radius-menu)] bg-[var(--text)] p-1 text-[length:var(--text-sm)]"
      style={{ left: pos.x, top: Math.max(pos.y - 8, 64), boxShadow: 'var(--shadow-menu)' }}
      onMouseDown={no}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {linkDraft !== null ? (
        <form
          className="flex items-center gap-1 px-1"
          onSubmit={(e) => { e.preventDefault(); applyLink(linkDraft) }}
        >
          <input
            autoFocus
            aria-label="Link address"
            placeholder="Paste a link"
            value={linkDraft}
            onChange={(e) => setLinkDraft(e.target.value)}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') { setLinkDraft(null); editor.commands.focus() } }}
            className="h-7 w-52 rounded-[var(--radius-chip)] bg-white/10 px-2 text-white outline-none placeholder:text-white/60"
          />
          <button type="submit" className={btn}>Apply</button>
        </form>
      ) : (
        <>
          <div className="relative">
            <button className={`${btn} gap-1 font-semibold`} aria-haspopup="menu" aria-expanded={menu === 'heading'} onClick={() => setMenu(menu === 'heading' ? null : 'heading')}>
              {heading} <ChevronDown size={13} aria-hidden />
            </button>
            {menu === 'heading' && (
              <div role="menu" className="absolute left-0 top-full mt-2 w-[184px] rounded-[var(--radius-menu)] bg-[var(--card-bg)] p-1.5 text-[var(--text)]" style={{ boxShadow: 'var(--shadow-menu)' }}>
                {([1, 2, 3] as const).map((l) => (
                  <button key={l} role="menuitem" className="flex h-9 w-full items-center rounded-[var(--radius-ui)] px-2.5 hover:bg-[var(--fill-hover)]"
                    style={{ fontWeight: 700, fontSize: l === 1 ? 20 : l === 2 ? 17 : 15 }}
                    onClick={() => { run.setHeading({ level: l }).run(); setMenu(null) }}>
                    Heading {l}
                  </button>
                ))}
                <button role="menuitem" className="flex h-9 w-full items-center rounded-[var(--radius-ui)] bg-[var(--fill-hover)] px-2.5 text-[length:var(--text-card)]"
                  onClick={() => { run.setParagraph().run(); setMenu(null) }}>
                  Body
                </button>
              </div>
            )}
          </div>
          <span className="mx-0.5 h-5 w-px bg-white/20" aria-hidden />
          <button className={btn} aria-label="Bold" aria-pressed={editor.isActive('bold')} onClick={() => run.toggleBold().run()}><Bold size={15} /></button>
          <button className={btn} aria-label="Italic" aria-pressed={editor.isActive('italic')} onClick={() => run.toggleItalic().run()}><Italic size={15} /></button>
          <button className={btn} aria-label="Underline" aria-pressed={editor.isActive('underline')} onClick={() => run.toggleUnderline().run()}><Underline size={15} /></button>
          <button className={btn} aria-label="Strikethrough" aria-pressed={editor.isActive('strike')} onClick={() => run.toggleStrike().run()}><Strikethrough size={15} /></button>
          <button className={btn} aria-label="Inline code" aria-pressed={editor.isActive('code')} onClick={() => run.toggleCode().run()}><Code size={15} /></button>
          <span className="mx-0.5 h-5 w-px bg-white/20" aria-hidden />
          <button className={btn} aria-label="Bulleted list" aria-pressed={editor.isActive('bulletList')} onClick={() => run.toggleBulletList().run()}><List size={15} /></button>
          <button className={btn} aria-label="Numbered list" aria-pressed={editor.isActive('orderedList')} onClick={() => run.toggleOrderedList().run()}><ListOrdered size={15} /></button>
          <button className={btn} aria-label="Checklist" aria-pressed={editor.isActive('taskList')} onClick={() => run.toggleTaskList().run()}><ListChecks size={15} /></button>
          <button className={btn} aria-label="Quote" aria-pressed={editor.isActive('blockquote')} onClick={() => run.toggleBlockquote().run()}><TextQuote size={15} /></button>
          <span className="mx-0.5 h-5 w-px bg-white/20" aria-hidden />
          <button className={btn} aria-label="Link" aria-pressed={editor.isActive('link')} onClick={() => setLinkDraft((editor.getAttributes('link').href as string | undefined) ?? '')}><LinkIcon size={15} /></button>
          <div className="relative">
            <button className={btn} aria-label="Highlight" aria-haspopup="menu" aria-expanded={menu === 'highlight'} aria-pressed={editor.isActive('highlight')} onClick={() => setMenu(menu === 'highlight' ? null : 'highlight')}>
              <Highlighter size={15} />
            </button>
            {menu === 'highlight' && (
              <div role="menu" className="absolute right-0 top-full mt-2 flex gap-1.5 rounded-[var(--radius-menu)] bg-[var(--card-bg)] p-2" style={{ boxShadow: 'var(--shadow-menu)' }}>
                <button role="menuitem" aria-label="No highlight" className="h-6 w-6 rounded-[var(--radius-chip)] border border-[var(--border-strong)] bg-white"
                  onClick={() => { run.unsetHighlight().run(); setMenu(null) }} />
                {HIGHLIGHTS.map((h) => (
                  <button key={h.label} role="menuitem" aria-label={`${h.label} highlight`} className="h-6 w-6 rounded-[var(--radius-chip)]" style={{ background: h.value }}
                    onClick={() => { run.setHighlight({ color: h.value }).run(); setMenu(null) }} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>,
    document.body,
  )
}
