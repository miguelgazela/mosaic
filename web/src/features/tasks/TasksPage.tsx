import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, CalendarDays, ChevronRight, CircleAlert, Clock, Search } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { isoDay, longDate, shortDate } from '../../cards/todo/logic'
import { Button, LogoMark, Toggle, toast } from '../../ui'
import { fetchTasks, setTaskDone, setTaskDue, TASKS_KEY } from './api'
import { groupTasks, taskPath, type GroupKey, type TaskRow } from './group'

const initials = (email: string) => email.split('@')[0].replace(/[^a-z0-9]/gi, ' ').trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '?'

const HEAD: Record<GroupKey, { icon: typeof Clock | null; cls: string }> = {
  overdue: { icon: CircleAlert, cls: 'text-[var(--danger-ink)]' },
  today: { icon: Clock, cls: 'text-[var(--warning-ink)]' },
  upcoming: { icon: CalendarDays, cls: 'text-[var(--text)]' },
  none: { icon: null, cls: 'text-[var(--text-secondary)]' },
}

const openHref = (t: TaskRow) => `/b/${t.board_id}?card=${t.element_id}`

function DueText({ t, today, onChange }: { t: TaskRow; today: string; onChange: (due: string | null) => void }) {
  const cls = !t.due ? 'px-2 font-medium text-[var(--text-muted)]' : t.due < today ? 'font-semibold text-[var(--danger-ink)]' : t.due === today ? 'font-semibold text-[var(--warning-ink)]' : 'text-[var(--text-secondary)]'
  // Overdue and today are words/icons in the group header too; the date itself stays text.
  const text = !t.due ? 'Add date' : t.due === today ? 'Today' : t.due < today ? shortDate(t.due) : longDate(t.due)
  // A native date input sits over the label (transparent) so the whole label opens the picker, on top of the row link.
  return (
    <span className="relative z-10 shrink-0">
      <span className={`block rounded-[var(--radius-chip)] text-[length:var(--text-sm)] hover:bg-[var(--fill-hover)] ${cls}`}>{text}</span>
      <input
        type="date"
        data-testid="task-due"
        aria-label={`${t.due ? 'Change' : 'Add'} due date for "${t.item_text}"`}
        value={t.due ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        onClick={(e) => { try { e.currentTarget.showPicker() } catch { /* not supported: the input still works by typing */ } }}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </span>
  )
}

function Row({ t, today, onToggle, onDue }: { t: TaskRow; today: string; onToggle: (done: boolean) => void; onDue: (due: string | null) => void }) {
  return (
    <li data-testid="task-row" data-item-id={t.item_id} className="group/task relative flex items-center gap-3 border-b border-[var(--border)] px-4 py-2 last:border-b-0 hover:bg-[var(--fill-hover)]">
      <input
        type="checkbox"
        aria-label={`Mark "${t.item_text}" done`}
        checked={t.done}
        onChange={(e) => onToggle(e.target.checked)}
        className="relative z-10 h-[18px] w-[18px] shrink-0 cursor-pointer appearance-none rounded-[var(--radius-chip)] border-[1.5px] border-[var(--border-strong)] bg-[var(--card-bg)] checked:border-[var(--success)] checked:bg-[var(--success)] focus-visible:shadow-[var(--ring-focus)]"
        style={t.done ? { backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M3.5 8.5l3 3 6-6.5' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/></svg>")`, backgroundSize: '100%' } : undefined}
      />
      <Link to={openHref(t)} className="flex min-w-0 flex-1 items-center gap-3 rounded-[var(--radius-chip)] after:absolute after:inset-0 after:content-['']">
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[length:var(--text-card)] leading-5 ${t.done ? 'text-[var(--text-muted)] line-through' : ''}`}>{t.item_text || 'Untitled item'}</span>
          <span className="block truncate text-[length:var(--text-caption)] leading-4 text-[var(--text-muted)]">{taskPath(t) || 'Untitled board'}</span>
        </span>
        <span className="hidden shrink-0 items-center gap-0.5 text-[length:var(--text-sm)] font-semibold text-[var(--link)] group-hover/task:flex group-focus-within/task:flex">
          Open in board <ChevronRight size={14} aria-hidden />
        </span>
      </Link>
      <DueText t={t} today={today} onChange={onDue} />
    </li>
  )
}

export function TasksPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showCompleted, setShowCompleted] = useState(false)
  const tasks = useQuery({ queryKey: TASKS_KEY, queryFn: fetchTasks, refetchOnWindowFocus: true })

  const toggle = useMutation({
    mutationFn: (v: { t: TaskRow; done: boolean }) => setTaskDone(v.t.element_id, v.t.item_id, v.done),
    onMutate: async ({ t, done }) => {
      await qc.cancelQueries({ queryKey: TASKS_KEY })
      const prev = qc.getQueryData<TaskRow[]>(TASKS_KEY)
      qc.setQueryData<TaskRow[]>(TASKS_KEY, (rows) => rows?.map((r) => (r.element_id === t.element_id && r.item_id === t.item_id ? { ...r, done } : r)))
      return { prev }
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(TASKS_KEY, ctx.prev); toast('Couldn’t update that task', { tone: 'error' }) },
    onSettled: () => void qc.invalidateQueries({ queryKey: TASKS_KEY }),
  })

  const setDue = useMutation({
    mutationFn: (v: { t: TaskRow; due: string | null }) => setTaskDue(v.t.element_id, v.t.item_id, v.due),
    onMutate: async ({ t, due }) => {
      await qc.cancelQueries({ queryKey: TASKS_KEY })
      const prev = qc.getQueryData<TaskRow[]>(TASKS_KEY)
      qc.setQueryData<TaskRow[]>(TASKS_KEY, (rows) => rows?.map((r) => (r.element_id === t.element_id && r.item_id === t.item_id ? { ...r, due } : r)))
      return { prev }
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(TASKS_KEY, ctx.prev); toast('Couldn’t set that date. Has migration 0010 been run?', { tone: 'error' }) },
    onSettled: () => void qc.invalidateQueries({ queryKey: TASKS_KEY }),
  })

  const today = isoDay(new Date())
  const groups = groupTasks(tasks.data ?? [], today, showCompleted)
  const email = session?.user.email ?? ''

  return (
    <div className="flex min-h-full flex-col bg-[var(--chrome-bg)]">
      <header className="flex shrink-0 items-center gap-2 border-b border-[var(--chrome-border)] bg-[var(--chrome-bg)] px-4" style={{ height: 'var(--topbar-h)' }}>
        <Link to="/" aria-label="Home" className="mr-2 rounded-[var(--radius-ui)]"><LogoMark /></Link>
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[length:var(--text-card)]">
          <Link to="/" className="rounded-[var(--radius-ui)] px-2 py-1 text-[var(--text-secondary)] hover:bg-[var(--fill-hover)] hover:text-[var(--text)]">Home</Link>
          <ChevronRight size={14} className="text-[var(--icon-subtle)]" aria-hidden />
          <span aria-current="page" className="px-2 py-1 font-semibold">Tasks</span>
        </nav>
        <div className="flex-1" />
        <button onClick={() => toast('Search is coming soon')} className="flex h-9 w-[220px] items-center gap-2 rounded-[var(--radius-ui)] border border-[var(--border-strong)] bg-[var(--card-bg)] px-3 text-[length:var(--text-card)] text-[var(--text-muted)] hover:bg-[var(--fill-hover)]">
          <Search size={16} /> <span className="flex-1 text-left">Search</span>
          <kbd className="rounded-[var(--radius-chip)] bg-[var(--fill-hover)] px-1.5 text-[length:var(--text-caption)] font-medium">⌘K</kbd>
        </button>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[length:var(--text-caption)] font-bold text-[var(--primary-ink)]">{initials(email)}</span>
      </header>

      <main className="mx-auto w-full max-w-[800px] flex-1 px-4 pb-16 pt-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[length:var(--text-h1)] font-semibold leading-[var(--leading-h1)]">Tasks</h1>
            <p className="mt-1 text-[var(--text-secondary)]">To-do items with due dates, from every board.</p>
          </div>
          {groups.length > 0 || showCompleted ? <Toggle checked={showCompleted} onChange={setShowCompleted} label="Show completed" /> : null}
        </div>

        {tasks.isPending ? (
          <p className="mt-10 text-[var(--text-muted)]" role="status">Loading tasks…</p>
        ) : tasks.isError ? (
          <div className="mt-10 flex items-center gap-3">
            <p className="text-[var(--danger)]">Couldn’t load tasks. {tasks.error.message}</p>
            <Button onClick={() => void tasks.refetch()}>Try again</Button>
          </div>
        ) : groups.length === 0 ? (
          <div data-testid="tasks-empty" className="mt-8 flex flex-col items-center rounded-[var(--radius-menu)] border border-[var(--border)] bg-[var(--card-bg)] px-6 py-16 text-center">
            <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[var(--fill-hover)]"><CalendarCheck size={24} aria-hidden /></span>
            <h2 className="mt-4 text-[length:var(--text-body)] font-semibold">No tasks with due dates</h2>
            <p className="mt-2 max-w-[340px] text-[length:var(--text-card)] text-[var(--text-secondary)]">Give a to-do item a due date and it shows up here, grouped by when it’s due.</p>
            <Button className="mt-4" onClick={() => navigate('/')}>Go to Home</Button>
          </div>
        ) : (
          groups.map((g) => {
            const { icon: Icon, cls } = HEAD[g.key]
            return (
              <section key={g.key} data-testid={`group-${g.key}`} className="mt-8" aria-label={g.label}>
                <h2 className={`mb-2 flex items-center gap-2 text-[length:var(--text-card)] font-semibold ${cls}`}>
                  {Icon && <Icon size={14} aria-hidden />}
                  {g.label}
                  <span className="font-medium text-[var(--text-secondary)]">{g.tasks.length}</span>
                </h2>
                <ul className="overflow-hidden rounded-[var(--radius-menu)] border border-[var(--border)] bg-[var(--card-bg)]">
                  {g.tasks.map((t) => (
                    <Row key={`${t.element_id}:${t.item_id}`} t={t} today={today} onToggle={(done) => toggle.mutate({ t, done })} onDue={(due) => setDue.mutate({ t, due })} />
                  ))}
                </ul>
              </section>
            )
          })
        )}
      </main>
    </div>
  )
}
