import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePhone } from '../lib/usePhone'
import { ChevronLeft, CheckCircle2, Keyboard, LogOut, Search, Trash2 } from 'lucide-react'
import { Button, LogoMark, MenuDivider, MenuItem, MenuPanel } from '../ui'
import { useDisplayName } from '../auth/useDisplayName'
import { versionLabel } from '../lib/version'
import { openShortcuts } from '../features/shortcuts/store'
import { Popover } from '../ui/Popover'
import { BoardMenu } from '../features/boards/BoardMenu'
import { useTrashHref } from '../features/boards/nav'
import { ShareDialog } from '../features/share/ShareDialog'
import { ViewOnlyChip } from '../canvas/ViewOnly'
import { SearchPalette, useSearchHotkey } from '../features/search/SearchPalette'
import { Breadcrumbs, type Crumb } from './Breadcrumbs'
import { SaveStatus, type SaveState } from './SaveStatus'

const initials = (name: string) => name.split('@')[0].replace(/[^\p{L}\p{N}]/gu, ' ').trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '?'


function AccountMenu({ email, onSignOut, size = 32 }: { email: string; onSignOut: () => void; size?: number }) {
  const navigate = useNavigate()
  const trashHref = useTrashHref()
  const name = useDisplayName() || email
  return (
    <Popover
    align="right"
    trigger={({ toggle, open }) => (
      <button
        aria-label="Account" aria-haspopup="menu" aria-expanded={open}
        onClick={toggle}
        className="flex items-center justify-center rounded-full"
      >
        <span style={{ width: size, height: size }} className="flex items-center justify-center rounded-full bg-[var(--primary-soft)] text-[length:var(--text-caption)] font-bold text-[var(--primary-ink)]">{initials(name)}</span>
      </button>
    )}
  >
    {(close) => (
      <MenuPanel className="w-[240px]" onClose={close}>
        <div className="flex items-center gap-3 px-2.5 pb-2 pt-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[length:var(--text-caption)] font-bold text-[var(--primary-ink)]">{initials(name)}</span>
          <span className="min-w-0 text-[length:var(--text-sm)] text-[var(--text-secondary)]">
            {name !== email && <span className="block truncate text-[length:var(--text-card)] font-semibold text-[var(--text)]">{name}</span>}
            <span className="block truncate">{email}</span>
          </span>
        </div>
        <MenuDivider />
        <MenuItem icon={<Trash2 size={15} />} onClick={() => { close(); navigate(trashHref) }}>Trash</MenuItem>
        <MenuItem icon={<Keyboard size={15} />} shortcut="?" onClick={() => { close(); openShortcuts() }}>Keyboard shortcuts</MenuItem>
        <MenuDivider />
        <MenuItem icon={<LogOut size={15} />} onClick={onSignOut}>Sign out</MenuItem>
        <MenuDivider />
        <p data-testid="app-version" className="select-text px-2.5 pb-1 pt-0.5 text-[length:var(--text-caption)] text-[var(--text-muted)]">Version {versionLabel()}</p>
      </MenuPanel>
    )}
  </Popover>
  )
}

export interface TopBarProps {
  ancestors: Crumb[]
  title: string
  onRename: (t: string) => void
  saveState: SaveState
  email: string
  onSignOut: () => void
  /** The board shown; enables the board menu. `parentId` null = Home. */
  board?: { id: string; parentId: string | null; icon?: string | null; color?: string | null }
  /** FR-54: view-only chip instead of rename, board menu, save status and Share. */
  readOnly?: boolean
  /** Board data not here yet: keep the chrome, disable what needs the board. */
  loading?: boolean
}

export function TopBar({ ancestors, title, onRename, saveState, email, onSignOut, board, readOnly, loading }: TopBarProps) {
  const navigate = useNavigate()
  const phone = usePhone()
  const [renameToken, setRenameToken] = useState(0)
  const [sharing, setSharing] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  useSearchHotkey(useCallback(() => setSearchOpen((o) => !o), []))
  if (phone) {
    // 04-board-phone: back, title with its parent underneath, search, account. 44 px targets.
    const parent = ancestors[ancestors.length - 1]
    return (
      <header className="flex shrink-0 items-center gap-1 border-b border-[var(--chrome-border)] bg-[var(--chrome-bg)] px-2" style={{ height: 'var(--topbar-h)' }}>
        {parent
          ? <Link to={parent.to} aria-label={`Back to ${parent.title}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-ui)]"><ChevronLeft size={22} /></Link>
          : <Link to="/" aria-label="Home" className="flex h-11 w-11 shrink-0 items-center justify-center"><LogoMark /></Link>}
        <div className="min-w-0 flex-1 leading-tight">
          <h1 className="truncate text-[length:var(--text-body)] font-semibold">{title || ' '}</h1>
          {parent && <p className="truncate text-[length:var(--text-caption)] text-[var(--text-secondary)]">{parent.title}</p>}
        </div>
        <button aria-label="Search" onClick={() => setSearchOpen(true)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-ui)]"><Search size={20} /></button>
        <AccountMenu email={email} onSignOut={onSignOut} size={32} />
        {searchOpen && <SearchPalette onClose={() => setSearchOpen(false)} />}
      </header>
    )
  }
  return (
    <header
      className="flex shrink-0 items-center gap-2 border-b border-[var(--chrome-border)] bg-[var(--chrome-bg)] px-4"
      style={{ height: 'var(--topbar-h)' }}
    >
      <Link to="/" aria-label="Home" className="mr-2 rounded-[var(--radius-ui)]"><LogoMark /></Link>
      <Breadcrumbs ancestors={ancestors} title={title} onRename={onRename} renameToken={renameToken} readOnly={readOnly} icon={board?.icon} color={board?.color} />
      {readOnly && <ViewOnlyChip />}
      {board && !readOnly && <BoardMenu boardId={board.id} title={title} parentId={board.parentId} onRename={() => setRenameToken((n) => n + 1)} onShare={() => setSharing(true)} />}
      {!readOnly && <span className="ml-2"><SaveStatus state={saveState} /></span>}
      <div className="flex-1" />
      <button
        onClick={() => setSearchOpen(true)}
        className="flex h-9 w-[220px] items-center gap-2 rounded-[var(--radius-ui)] border border-[var(--border-strong)] bg-[var(--card-bg)] px-3 text-[length:var(--text-card)] text-[var(--text-muted)] hover:bg-[var(--fill-hover)]"
      >
        <Search size={16} /> <span className="flex-1 text-left">Search</span>
        <kbd className="rounded-[var(--radius-chip)] bg-[var(--fill-hover)] px-1.5 text-[length:var(--text-caption)] font-medium">⌘K</kbd>
      </button>
      <Button variant="ghost" onClick={() => navigate('/tasks')}><CheckCircle2 size={16} /> Tasks</Button>
      {(board || loading) && !readOnly && <Button variant="primary" aria-disabled={!board} onClick={() => { if (board) setSharing(true) }}>Share</Button>}
      <AccountMenu email={email} onSignOut={onSignOut} />
      {sharing && board && <ShareDialog boardId={board.id} title={title} onClose={() => setSharing(false)} />}
      {searchOpen && <SearchPalette onClose={() => setSearchOpen(false)} />}
    </header>
  )
}
