import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { LayoutDashboard, Palette, Pencil } from 'lucide-react'
import { colorVar } from '../../canvas/colors'
import { useBoard } from '../../canvas/store'
import { BoardPicker } from '../../features/boards/BoardPicker'
import { boardInfoKey, getBoardRepo, useBoardCount, useBoardInfo } from '../../features/boards/boardRepo'
import { BoardIcon } from '../../features/boards/icons'
import { useBoardHref } from '../../features/boards/nav'
import { newId } from '../../lib/ids'
import { toast } from '../../ui'
import type { CardDefinition, CardProps } from '../types'

const boardIdOf = (c: Record<string, unknown>): string | undefined => (typeof c.boardId === 'string' ? c.boardId : undefined)

function BoardCard({ element: el }: CardProps) {
  const boardId = boardIdOf(el.content)
  const info = useBoardInfo(boardId).data
  const count = useBoardCount(boardId).data
  const editing = useBoard((s) => s.editing === el.id)
  const navigate = useNavigate()
  const href = useBoardHref()
  const down = useRef<{ x: number; y: number } | null>(null)
  const tint = colorVar(info?.color ?? null)
  const title = info?.title ?? 'Untitled board'
  const sub = count === undefined ? ' ' : count === 0 ? 'Empty' : `${count} ${count === 1 ? 'item' : 'items'}`
  const dropActive = useBoard((s) => s.dropHint?.targetId === el.id)

  return (
    <div
      data-testid="board-card"
      role="link"
      aria-label={`Open board ${title}`}
      className="flex cursor-pointer flex-col items-center gap-2 rounded-[var(--radius-card)] px-3 pb-3 pt-3.5 text-center"
      style={{ background: dropActive ? 'var(--primary-soft)' : (tint ?? 'var(--card-bg)') }}
      onPointerDown={(e) => { down.current = { x: e.clientX, y: e.clientY } }}
      onClick={(e) => {
        const d = down.current
        if (editing || e.shiftKey || e.metaKey || e.ctrlKey || !boardId) return
        if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return
        navigate(href(boardId))
      }}
      onKeyDown={(e) => { if (e.key === 'Enter' && !editing && boardId) navigate(href(boardId)) }}
    >
      <span
        className="flex h-16 w-16 items-center justify-center rounded-[var(--radius-tile)]"
        style={{
          background: info?.color ? `color-mix(in oklab, ${tint}, var(--text) 62%)` : 'var(--card-color-9)',
          color: info?.color ? '#fff' : 'var(--text-secondary)',
        }}
      >
        <BoardIcon icon={info?.icon ?? null} size={28} />
      </span>
      {editing && boardId ? <TitleInput boardId={boardId} initial={title} /> : (
        <div className="w-full truncate text-[length:var(--text-card)] font-semibold leading-[var(--leading-card)]">{title}</div>
      )}
      <div className="-mt-1.5 text-[length:var(--text-caption)] leading-[var(--leading-caption)] text-[var(--text-muted)]">
        {dropActive ? <span className="font-semibold text-[var(--primary)]">Drop to move here</span> : sub}
      </div>
    </div>
  )
}

function TitleInput({ boardId, initial }: { boardId: string; initial: string }) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState(initial === 'Untitled board' ? '' : initial)
  const ref = useRef<HTMLInputElement>(null)
  const done = useRef(false)
  useEffect(() => { ref.current?.focus() }, [])
  const finish = (save: boolean) => {
    if (done.current) return
    done.current = true
    const t = draft.trim()
    if (save && t && t !== initial) {
      qc.setQueryData(boardInfoKey(boardId), (d: { title: string } | undefined) => (d ? { ...d, title: t } : d))
      void getBoardRepo().update(boardId, { title: t }).catch(() => toast('Couldn’t rename the board'))
    }
    useBoard.getState().setEditing(null)
  }
  return (
    <input
      ref={ref}
      data-nodrag
      aria-label="Board name"
      placeholder="Name this board"
      value={draft}
      maxLength={120}
      onChange={(e) => setDraft(e.target.value)}
      onPointerDown={(e) => e.stopPropagation()}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') finish(true)
        else if (e.key === 'Escape') finish(false)
      }}
      className="w-full rounded-[var(--radius-chip)] border border-[var(--primary)] bg-[var(--card-bg)] px-1.5 py-0.5 text-center text-[length:var(--text-card)] font-semibold outline-none"
    />
  )
}

export const boardCard: CardDefinition = {
  type: 'board',
  label: 'Board',
  Component: BoardCard,
  defaultSize: { width: 136, height: null },
  resize: 'none',
  minWidth: 136,
  minHeight: 120,
  shortcut: 'B',
  colorable: false,
  editOnCreate: true,
  toolbar: { label: 'Board', icon: LayoutDashboard },
  defaultContent: () => ({ boardId: newId() }),
  onCreate(el) {
    const id = boardIdOf(el.content)
    if (!id) return
    getBoardRepo()
      .create({ id, parentId: useBoard.getState().boardId, title: 'Untitled board' })
      .catch(() => toast('Couldn’t create the board. Check your connection.'))
  },
  menuItems: (el) => {
    const id = boardIdOf(el.content)
    return [
      { id: 'rename', label: 'Rename', icon: Pencil, run: () => useBoard.getState().setEditing(el.id) },
      ...(id ? [{ id: 'icon', label: 'Icon & colour', icon: Palette, panel: () => <BoardPicker boardId={id} /> }] : []),
    ]
  },
  toPlainText: () => '',
  toMarkdown: () => '',
}
