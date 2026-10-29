import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, Download, MoreHorizontal, Palette, Pencil, Share2, Trash2 } from 'lucide-react'
import { IconButton, MenuDivider, MenuItem, MenuPanel, toast } from '../../ui'
import { Popover } from '../../ui/Popover'
import { queryClient } from '../../lib/queryClient'
import { flushActiveBoard } from '../../lib/sync/boardSync'
import { runExport, type ExportKind } from '../export/run'
import { BoardPicker } from './BoardPicker'
import { getBoardRepo } from './boardRepo'
import { useBoardHref } from './nav'

const SHOW_SHARE = true

const refreshBoards = () => {
  void queryClient.invalidateQueries({ queryKey: ['board-count'] })
  void queryClient.invalidateQueries({ queryKey: ['board-tree'] })
  void queryClient.invalidateQueries({ queryKey: ['trash'] })
}

export interface BoardMenuProps {
  boardId: string
  title: string
  /** null for Home, which can't be renamed, copied or trashed. */
  parentId: string | null
  onRename: () => void
  /** Opens the share dialog (owned by the top bar, which also has a Share button). */
  onShare?: () => void
}

/** Row of the export submenu: no icon slot, optional second line. */
function ExportRow({ label, hint, onClick }: { label: string; hint?: string; onClick: () => void }) {
  return (
    <button
      role="menuitem"
      className="flex w-full flex-col justify-center rounded-[var(--radius-ui)] px-2.5 py-1.5 text-left hover:bg-[var(--fill-hover)] focus-visible:bg-[var(--fill-hover)]"
      onClick={onClick}
    >
      <span className="text-[length:var(--text-card)] text-[var(--text)]">{label}</span>
      {hint && <span className="text-[length:var(--text-meta,12px)] text-[var(--text-muted)]">{hint}</span>}
    </button>
  )
}

/** Board menu (00-menus): Rename, Icon and colour, Duplicate board, Export, Share, Move to Trash. */
export function BoardMenu({ boardId, title, parentId, onRename, onShare }: BoardMenuProps) {
  const navigate = useNavigate()
  const href = useBoardHref()
  const [panel, setPanel] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const doExport = (kind: ExportKind) => { void runExport(kind, { id: boardId, title }) }

  const duplicate = async () => {
    if (!parentId) return
    try {
      await flushActiveBoard()
      const copy = await getBoardRepo().duplicate({ id: boardId, parentId, withCard: true })
      refreshBoards()
      toast(`Duplicated “${title}”`, { tone: 'success', action: { label: 'Open', run: () => navigate(href(copy)) } })
    } catch {
      toast('Couldn’t duplicate the board', { tone: 'error' })
    }
  }

  const trash = async () => {
    if (!parentId) return
    const repo = getBoardRepo()
    try {
      await flushActiveBoard()
      await repo.trash(boardId)
    } catch {
      toast('Couldn’t move the board to the trash', { tone: 'error' })
      return
    }
    refreshBoards()
    navigate(href(parentId), { replace: true })
    toast(`Moved “${title}” to Trash`, {
      action: {
        label: 'Undo',
        run: () => {
          repo.restore(boardId).then(() => { refreshBoards(); navigate(href(boardId)) }, () => toast('Couldn’t restore the board', { tone: 'error' }))
        },
      },
    })
  }

  return (
    <Popover
      trigger={({ toggle }) => (
        <IconButton aria-label="Board menu" aria-haspopup="menu" className="!h-8 !w-8" onClick={() => { setPanel(false); setExportOpen(false); toggle() }}>
          <MoreHorizontal size={16} />
        </IconButton>
      )}
    >
      {(close) => (
        <MenuPanel className="w-[240px]" label="Board" onClose={close}>
          {parentId && <MenuItem icon={<Pencil size={15} />} onClick={() => { close(); onRename() }}>Rename</MenuItem>}
          <div className="relative">
            <MenuItem icon={<Palette size={15} />} submenu onClick={() => setPanel((p) => !p)}>Icon and colour</MenuItem>
            {panel && (
              <div
                className="absolute left-full top-0 z-10 ml-1 rounded-[var(--radius-menu)] border border-[var(--border)] bg-[var(--card-bg)]"
                style={{ boxShadow: 'var(--shadow-menu)' }}
              >
                <BoardPicker boardId={boardId} />
              </div>
            )}
          </div>
          {parentId && <MenuItem icon={<Copy size={15} />} onClick={() => { close(); void duplicate() }}>Duplicate board</MenuItem>}
          <div className="relative">
            <MenuItem icon={<Download size={15} />} submenu onClick={() => setExportOpen((o) => !o)}>Export</MenuItem>
            {exportOpen && (
              <div
                role="menu"
                aria-label="Export"
                className="absolute left-full top-0 z-10 ml-1 w-[240px] rounded-[var(--radius-menu)] border border-[var(--border)] bg-[var(--card-bg)] p-1.5"
                style={{ boxShadow: 'var(--shadow-menu)' }}
              >
                <div className="px-2.5 pb-1 pt-1.5 text-[length:var(--text-meta,12px)] font-semibold text-[var(--text-muted)]">Image</div>
                <ExportRow label="PNG, whole board" onClick={() => { close(); doExport('png-board') }} />
                <ExportRow label="PNG, current view" onClick={() => { close(); doExport('png-view') }} />
                <ExportRow label="PDF" onClick={() => { close(); doExport('pdf') }} />
                <MenuDivider />
                <div className="px-2.5 pb-1 pt-1.5 text-[length:var(--text-meta,12px)] font-semibold text-[var(--text-muted)]">Text</div>
                <ExportRow label="Markdown (.zip)" hint="Notes, to-dos and links, with images" onClick={() => { close(); doExport('markdown') }} />
              </div>
            )}
          </div>
          {SHOW_SHARE && onShare && <MenuItem icon={<Share2 size={15} />} onClick={() => { close(); onShare() }}>Share…</MenuItem>}
          {parentId && (
            <>
              <MenuDivider />
              <MenuItem icon={<Trash2 size={15} />} destructive onClick={() => { close(); void trash() }}>Move to Trash</MenuItem>
            </>
          )}
        </MenuPanel>
      )}
    </Popover>
  )
}
