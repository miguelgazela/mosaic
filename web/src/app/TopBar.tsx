import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, Keyboard, LogOut, Search, Trash2 } from 'lucide-react'
import { Button, LogoMark, MenuDivider, MenuItem, MenuPanel, toast } from '../ui'
import { Popover } from '../ui/Popover'
import { BoardMenu } from '../features/boards/BoardMenu'
import { useTrashHref } from '../features/boards/nav'
import { Breadcrumbs, type Crumb } from './Breadcrumbs'
import { SaveStatus, type SaveState } from './SaveStatus'

const initials = (email: string) => email.split('@')[0].replace(/[^a-z0-9]/gi, ' ').trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '?'
const soon = (what: string) => () => toast(`${what} is coming soon`)

export interface TopBarProps {
  ancestors: Crumb[]
  title: string
  onRename: (t: string) => void
  saveState: SaveState
  email: string
  onSignOut: () => void
  /** The board shown; enables the board menu. `parentId` null = Home. */
  board?: { id: string; parentId: string | null }
}

export function TopBar({ ancestors, title, onRename, saveState, email, onSignOut, board }: TopBarProps) {
  const navigate = useNavigate()
  const trashHref = useTrashHref()
  const [renameToken, setRenameToken] = useState(0)
  return (
    <header
      className="flex shrink-0 items-center gap-2 border-b border-[var(--chrome-border)] bg-[var(--chrome-bg)] px-4"
      style={{ height: 'var(--topbar-h)' }}
    >
      <Link to="/" aria-label="Home" className="mr-2 rounded-[var(--radius-ui)]"><LogoMark /></Link>
      <Breadcrumbs ancestors={ancestors} title={title} onRename={onRename} renameToken={renameToken} />
      {board && <BoardMenu boardId={board.id} title={title} parentId={board.parentId} onRename={() => setRenameToken((n) => n + 1)} />}
      <span className="ml-2"><SaveStatus state={saveState} /></span>
      <div className="flex-1" />
      <button
        onClick={soon('Search')}
        className="flex h-9 w-[220px] items-center gap-2 rounded-[var(--radius-ui)] border border-[var(--border-strong)] bg-[var(--card-bg)] px-3 text-[length:var(--text-card)] text-[var(--text-muted)] hover:bg-[var(--fill-hover)]"
      >
        <Search size={16} /> <span className="flex-1 text-left">Search</span>
        <kbd className="rounded-[var(--radius-chip)] bg-[var(--fill-hover)] px-1.5 text-[length:var(--text-caption)] font-medium">⌘K</kbd>
      </button>
      <Button variant="ghost" onClick={() => navigate('/tasks')}><CheckCircle2 size={16} /> Tasks</Button>
      <Button variant="primary" onClick={soon('Sharing')}>Share</Button>
      <Popover
        align="right"
        trigger={({ toggle }) => (
          <button
            aria-label="Account"
            onClick={toggle}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[length:var(--text-caption)] font-bold text-[var(--primary-ink)]"
          >
            {initials(email)}
          </button>
        )}
      >
        {(close) => (
          <MenuPanel className="w-[240px]" onClose={close}>
            <div className="flex items-center gap-3 px-2.5 pb-2 pt-1">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[length:var(--text-caption)] font-bold text-[var(--primary-ink)]">{initials(email)}</span>
              <span className="min-w-0 text-[length:var(--text-sm)] text-[var(--text-secondary)]"><span className="block truncate">{email}</span></span>
            </div>
            <MenuDivider />
            <MenuItem icon={<Trash2 size={15} />} onClick={() => { close(); navigate(trashHref) }}>Trash</MenuItem>
            <MenuItem icon={<Keyboard size={15} />} shortcut="?" onClick={() => { close(); soon('The shortcuts sheet')() }}>Keyboard shortcuts</MenuItem>
            <MenuDivider />
            <MenuItem icon={<LogOut size={15} />} onClick={onSignOut}>Sign out</MenuItem>
          </MenuPanel>
        )}
      </Popover>
    </header>
  )
}
