import { Calendar, EyeOff, GripVertical, ListChecks, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { colorVar } from '../../canvas/colors'
import { patchCmd, patchEntries } from '../../canvas/commands'
import { useBoard } from '../../canvas/store'
import { Popover } from '../../ui/Popover'
import { newId } from '../../lib/ids'
import type { CardDefinition, CardProps } from '../types'
import { DatePicker } from './DatePicker'
import { DueChip } from './DueChip'
import {
  hiddenCount, insertItem, isoDay, moveItem, progress, readTodo, removeItem, setItem,
  todoMarkdown, todoPlainText, writeTodo, type TodoContent, type TodoItem,
} from './logic'

/** Interactive regions: keep the card from starting a drag or the canvas from starting a marquee, and select the card. */
const stopAndSelect = (id: string) => (e: React.PointerEvent) => {
  e.stopPropagation()
  if (!useBoard.getState().selected[id]) useBoard.getState().setSelection([id])
}

/** Every edit is one command, so undo/redo and sync work like any other canvas change. */
function commit(id: string, label: string, next: TodoContent) {
  const s = useBoard.getState()
  const el = s.elements[id]
  if (!el) return
  const entries = patchEntries(s.elements, { [id]: { content: writeTodo(el.content, next) } })
  if (entries.length) s.exec(patchCmd(label, entries))
}

const field = 'select-text min-w-0 flex-1 bg-transparent outline-none placeholder:text-[var(--text-muted)] focus-visible:shadow-none'

function ItemRow({
  item, today, autoFocus, onFocus, onPointerDown, onChange, onDelete, onEnter, onBackspaceEmpty, onMoveKey, onGrip, dragging,
}: {
  item: TodoItem
  today: string
  autoFocus: boolean
  onFocus: () => void
  onPointerDown: (e: React.PointerEvent) => void
  onChange: (patch: Partial<TodoItem>) => void
  onDelete: () => void
  onEnter: () => void
  onBackspaceEmpty: () => void
  onMoveKey: (dir: -1 | 1) => void
  onGrip: (e: React.PointerEvent) => void
  dragging: boolean
}) {
  return (
    <div
      data-todo-row={item.id}
      data-nodrag
      onPointerDown={onPointerDown}
      onFocus={onFocus}
      className={`group/row -mx-2 flex h-8 items-center gap-2 rounded-[var(--radius-chip)] px-2 hover:bg-[var(--fill-hover)] focus-within:bg-[var(--primary-soft)] ${dragging ? 'opacity-60' : ''}`}
    >
      <button type="button" aria-label="Reorder item" onPointerDown={onGrip} className="-ml-1.5 hidden shrink-0 cursor-grab touch-none text-[var(--icon-subtle)] group-hover/row:block">
        <GripVertical size={14} />
      </button>
      <input
        type="checkbox"
        aria-label={`Mark "${item.text || 'item'}" done`}
        checked={item.done}
        onChange={(e) => onChange({ done: e.target.checked })}
        className="h-[18px] w-[18px] shrink-0 cursor-pointer appearance-none rounded-[var(--radius-chip)] border-[1.5px] border-[var(--border-strong)] bg-[var(--card-bg)] checked:border-[var(--success)] checked:bg-[var(--success)] focus-visible:shadow-[var(--ring-focus)]"
        style={item.done ? { backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M3.5 8.5l3 3 6-6.5' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/></svg>")`, backgroundSize: '100%' } : undefined}
      />
      <input
        data-item-input={item.id}
        key={item.text}
        defaultValue={item.text}
        autoFocus={autoFocus}
        placeholder="Add an item…"
        aria-label="To-do item"
        onBlur={(e) => { if (e.target.value !== item.text) onChange({ text: e.target.value }) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); const v = e.currentTarget.value; if (v !== item.text) onChange({ text: v }); onEnter() }
          else if (e.key === 'Escape') (e.target as HTMLElement).blur()
          else if (e.key === 'Backspace' && e.currentTarget.value === '') { e.preventDefault(); onBackspaceEmpty() }
          else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); onMoveKey(e.key === 'ArrowUp' ? -1 : 1) }
        }}
        className={`${field} text-[length:var(--text-card)] ${item.done ? 'text-[var(--text-muted)] line-through' : ''}`}
      />
      {item.due && <span className="group-focus-within/row:hidden"><DueChip due={item.due} today={today} /></span>}
      <Popover
        align="right"
        trigger={({ toggle }) => (
          <button
            type="button"
            aria-label={item.due ? 'Change due date' : 'Set due date'}
            onClick={toggle}
            className={`shrink-0 rounded-[var(--radius-chip)] p-1 text-[var(--primary)] hover:bg-[var(--primary-soft)] ${item.due ? 'hidden group-focus-within/row:inline-flex group-hover/row:inline-flex' : 'hidden group-focus-within/row:inline-flex group-hover/row:inline-flex'}`}
          >
            <Calendar size={14} />
          </button>
        )}
      >
        {(close) => (
          <DatePicker
            value={item.due}
            today={today}
            onPick={(due) => { onChange({ due }); close() }}
            onClear={() => { onChange({ due: undefined }); close() }}
          />
        )}
      </Popover>
      <button type="button" aria-label="Delete item" onClick={() => onDelete()} className={`shrink-0 rounded-[var(--radius-chip)] p-1 text-[var(--text-muted)] hover:bg-[var(--fill-pressed)] hidden group-focus-within/row:inline-flex group-hover/row:inline-flex`}>
        <X size={14} />
      </button>
    </div>
  )
}

function TodoCard({ element: el, selected }: CardProps) {
  const readOnly = useBoard((s) => s.readOnly)
  const todo = useMemo(() => readTodo(el.content), [el.content])
  const today = isoDay(new Date())
  const [focusId, setFocusId] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ id: string; to: number } | null>(null)
  const body = useRef<HTMLDivElement>(null)
  const { done, total, ratio } = progress(todo.items)
  const hidden = hiddenCount(todo)

  const items = drag ? moveItem(todo.items, drag.id, drag.to) : todo.items
  const visible = items.filter((i) => !(todo.hideCompleted && i.done))
  const stop = stopAndSelect(el.id)
  const save = (label: string, next: Partial<TodoContent>) => commit(el.id, label, { ...todo, ...next })

  const change = (item: TodoItem, patch: Partial<TodoItem>) => {
    save(patch.done !== undefined ? 'Check item' : 'due' in patch ? 'Set due date' : 'Edit item', { items: setItem(todo.items, item.id, patch) })
  }

  const startGrip = (e: React.PointerEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    let to = todo.items.findIndex((i) => i.id === id)
    const move = (ev: PointerEvent) => {
      const rows = [...(body.current?.querySelectorAll<HTMLElement>('[data-todo-row]') ?? [])]
      const ids = rows.map((r) => r.dataset.todoRow!)
      let idx = rows.findIndex((r) => ev.clientY < r.getBoundingClientRect().top + r.getBoundingClientRect().height / 2)
      if (idx < 0) idx = rows.length - 1
      to = todo.items.findIndex((i) => i.id === ids[idx])
      setDrag({ id, to })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setDrag(null)
      if (to !== todo.items.findIndex((i) => i.id === id)) save('Reorder items', { items: moveItem(todo.items, id, to) })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const addAfter = (afterId?: string) => {
    const item: TodoItem = { id: newId(), text: '', done: false }
    setFocusId(item.id)
    save('Add item', { items: insertItem(todo.items, item, afterId) })
  }

  return (
    <div
      data-testid="todo-card"
      className="min-h-full rounded-[var(--radius-card)] p-4 text-[length:var(--text-card)] leading-[var(--leading-card)]"
      style={{ background: colorVar(el.color) ?? 'var(--card-bg)' }}
    >
      <div className="flex items-center gap-2" data-nodrag onPointerDown={stop}>
        <input
          key={todo.title ?? ''}
          defaultValue={todo.title ?? ''}
          placeholder="Title"
          aria-label="To-do title"
          onFocus={() => useBoard.getState().setSelection([el.id])}
          onBlur={(e) => { if (e.target.value !== (todo.title ?? '')) save('Edit title', { title: e.target.value || undefined }) }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLElement).blur() }}
          className={`${field} text-[length:var(--text-card-title)] font-semibold leading-[var(--leading-card-title)]`}
        />
        {total > 0 && (
          <span data-testid="todo-count" className="rounded-full bg-[var(--fill-hover)] px-2 text-[length:var(--text-caption)] font-medium leading-5 text-[var(--text-secondary)]">
            {done}/{total}
          </span>
        )}
      </div>
      {total > 0 && (
        <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-[var(--fill-pressed)]" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
          <div className="h-full bg-[var(--success)]" style={{ width: `${ratio * 100}%` }} />
        </div>
      )}
      <div ref={body} className="mt-2 flex flex-col">
        {visible.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            today={today}
            autoFocus={focusId === item.id}
            dragging={drag?.id === item.id}
            onFocus={() => useBoard.getState().setSelection([el.id])}
            onPointerDown={stop}
            onChange={(p) => change(item, p)}
            onDelete={() => save('Delete item', { items: removeItem(todo.items, item.id) })}
            onEnter={() => addAfter(item.id)}
            onBackspaceEmpty={() => {
              const i = todo.items.findIndex((x) => x.id === item.id)
              const prev = todo.items[i - 1]
              if (prev) setFocusId(prev.id)
              save('Delete item', { items: removeItem(todo.items, item.id) })
              if (prev) body.current?.querySelector<HTMLInputElement>(`[data-item-input="${prev.id}"]`)?.focus()
            }}
            onMoveKey={(dir) => save('Reorder items', { items: moveItem(todo.items, item.id, todo.items.findIndex((i) => i.id === item.id) + dir) })}
            onGrip={(e) => startGrip(e, item.id)}
          />
        ))}
        {total === 0 && !readOnly && (
          <button
            type="button"
            data-nodrag
            onPointerDown={stop}
            onClick={() => addAfter()}
            className="-mx-2 flex h-8 items-center gap-2 rounded-[var(--radius-chip)] px-2 text-left text-[var(--text-muted)] hover:bg-[var(--fill-hover)]"
          >
            <span className="h-[18px] w-[18px] shrink-0 rounded-[var(--radius-chip)] border-[1.5px] border-dashed border-[var(--border-strong)]" />
            Add an item…
          </button>
        )}
      </div>
      {total > 0 && !(readOnly && hidden === 0) && (
        <div data-nodrag onPointerDown={stop} className="mt-1 flex items-center gap-3 text-[length:var(--text-sm)] text-[var(--text-muted)]">
          {!readOnly && <button type="button" onClick={() => addAfter()} className="rounded-[var(--radius-chip)] py-1 hover:text-[var(--text)]">+ Add item</button>}
          {hidden > 0 ? (
            <span className="flex items-center gap-1.5"><EyeOff size={14} aria-hidden /> {hidden} completed hidden.
              <button type="button" onClick={() => save('Show completed', { hideCompleted: false })} className="font-semibold text-[var(--link)] hover:underline">Show</button>
            </span>
          ) : done > 0 && (selected || todo.hideCompleted) ? (
            <button type="button" onClick={() => save('Hide completed', { hideCompleted: true })} className="rounded-[var(--radius-chip)] py-1 hover:text-[var(--text)]">Hide completed</button>
          ) : null}
        </div>
      )}
    </div>
  )
}

export const todoCard: CardDefinition = {
  type: 'todo',
  label: 'To-do',
  Component: TodoCard,
  defaultSize: { width: 288, height: null },
  resize: 'width',
  minWidth: 220,
  minHeight: 64,
  shortcut: 'T',
  toolbar: { label: 'To-do', icon: ListChecks },
  defaultContent: () => ({ hideCompleted: false, items: [] }),
  toPlainText: (el) => todoPlainText(readTodo(el.content)),
  toMarkdown: (el) => todoMarkdown(readTodo(el.content)),
}
