import { memo, useEffect, useMemo, useRef } from 'react'
import { FileText } from 'lucide-react'
import { generateHTML } from '@tiptap/html'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import { patchCmd, removeCmd } from '../../canvas/commands'
import { colorVar } from '../../canvas/colors'
import { useBoard } from '../../canvas/store'
import type { CardDefinition, CardProps } from '../types'
import { noteExtensions } from './extensions'
import { FormatToolbar } from './FormatToolbar'
import { docOf, docToMarkdown, docToText, isEmptyDoc, textToDoc, type DocNode } from './noteDoc'

const SAVE_DELAY = 400

/** Read-only render: plain HTML from the schema, no editor instance per card (500-card boards stay light). */
const NoteView = memo(function NoteView({ doc }: { doc: DocNode }) {
  const html = useMemo(() => (isEmptyDoc(doc) && !doc.content?.some((n) => n.type !== 'paragraph') ? '' : generateHTML(doc, noteExtensions)), [doc])
  if (!html) return <p className="note-prose-placeholder">Type something…</p>
  return <div className="note-prose" dangerouslySetInnerHTML={{ __html: html }} />
})

function NoteEditor({ id }: { id: string }) {
  const initial = useRef<{ content: Record<string, unknown>; doc: DocNode } | null>(null)
  if (!initial.current) {
    const c = useBoard.getState().elements[id].content
    initial.current = { content: c, doc: docOf(c) }
  }
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const editorRef = useRef<Editor | null>(null)

  const writeLive = () => {
    clearTimeout(timer.current)
    timer.current = undefined
    const ed = editorRef.current
    const s = useBoard.getState()
    if (!ed || !s.elements[id]) return
    s._patch([{ id, patch: { content: { ...initial.current!.content, doc: ed.getJSON() } } }])
  }

  const editor = useEditor({
    extensions: noteExtensions,
    content: initial.current.doc,
    autofocus: 'end',
    editorProps: { attributes: { class: 'note-prose', 'aria-label': 'Note text', role: 'textbox' } },
    onUpdate: () => {
      clearTimeout(timer.current)
      timer.current = setTimeout(writeLive, SAVE_DELAY)
    },
  })
  editorRef.current = editor

  useEffect(() => {
    // Leave edit mode when the store says so (blur, Escape, selecting something else) and record one undo step.
    const finish = () => {
      const s = useBoard.getState()
      const ed = editorRef.current
      const el = s.elements[id]
      if (!ed || !el) return
      writeLive()
      const before = initial.current!
      const after = { ...before.content, doc: ed.getJSON() as DocNode }
      if (isEmptyDoc(after.doc)) {
        // An empty note is not worth keeping.
        s.exec(removeCmd([{ ...el, content: before.content }]))
        return
      }
      if (JSON.stringify(after.doc) !== JSON.stringify(before.doc)) {
        s.commit(patchCmd('Edit note', [{ id, before: { content: before.content }, after: { content: after } }]))
      }
    }
    let ended = false
    const unsub = useBoard.subscribe((s) => {
      if (s.editing !== id && !ended) { ended = true; finish() }
    })
    return () => {
      unsub()
      // Unmounted while still editing (board closed): keep what was typed.
      if (timer.current) writeLive()
    }
  }, [id])

  if (!editor) return null
  return (
    <div
      data-nodrag
      className="note-editor select-text"
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape') useBoard.getState().setEditing(null)
      }}
      onBlur={(e) => {
        const next = e.relatedTarget as Node | null
        if (next && (e.currentTarget.contains(next) || (next as HTMLElement).closest?.('[data-testid="format-toolbar"]'))) return
        // Defer so a click on the toolbar (which keeps focus) does not end editing.
        setTimeout(() => { if (!editor.isFocused && !document.activeElement?.closest('[data-testid="format-toolbar"]')) useBoard.getState().setEditing(null) }, 0)
      }}
    >
      <EditorContent editor={editor} />
      <FormatToolbar editor={editor} />
    </div>
  )
}

function NoteCard({ element: el }: CardProps) {
  const editing = useBoard((s) => s.editing === el.id)
  const doc = docOf(el.content)
  return (
    <div
      data-testid="note-card"
      className="rounded-[var(--radius-card)] px-4 py-3.5 text-[length:var(--text-card)] leading-[var(--leading-card)]"
      style={{ background: colorVar(el.color) ?? 'var(--card-bg)' }}
      onDoubleClick={() => useBoard.getState().setEditing(el.id)}
    >
      {editing ? <NoteEditor id={el.id} /> : <NoteView doc={doc} />}
    </div>
  )
}

export const noteCard: CardDefinition = {
  type: 'note',
  label: 'Note',
  Component: NoteCard,
  defaultSize: { width: 300, height: null },
  resize: 'width',
  minWidth: 120,
  minHeight: 40,
  shortcut: 'N',
  editOnCreate: true,
  toolbar: { label: 'Note', icon: FileText },
  defaultContent: () => ({ doc: { type: 'doc', content: [{ type: 'paragraph' }] } }),
  contentFromText: (text) => ({ doc: textToDoc(text) }),
  toPlainText: (el) => docToText(docOf(el.content)),
  toMarkdown: (el) => docToMarkdown(docOf(el.content)),
}
