import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, Download, MoreHorizontal, Palette, Pencil, Share2, Trash2 } from 'lucide-react'
import { IconButton, MenuDivider, MenuItem, MenuPanel, toast } from '../../ui'
import { Popover } from '../../ui/Popover'
import { queryClient } from '../../lib/queryClient'
import { flushActiveBoard } from '../../lib/sync/boardSync'
import { BoardPicker } from './BoardPicker'
import { getBoardRepo } from './boardRepo'
import { useBoardHref } from './nav'

/** Export (P11) and Share (P9) have their place in the menu but stay hidden until those phases land. */
const SHOW_EXPORT = false
const SHOW_SHARE = false

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
}

/** Board menu (00-menus): Rename, Icon and colour, Duplicate board, Export, Share, Move to Trash. */
export function BoardMenu({ boardId, title, parentId, onRename }: BoardMenuProps) {
  const navigate = useNavigate()
  const href = useBoardHref()
  const [panel, setPanel] = useState(false)

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
        <IconButton aria-label="Board menu" aria-haspopup="menu" className="!h-8 !w-8" onClick={() => { setPanel(false); toggle() }}>
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
          {SHOW_EXPORT && <MenuItem icon={<Download size={15} />} submenu>Export</MenuItem>}
          {SHOW_SHARE && <MenuItem icon={<Share2 size={15} />}>Share…</MenuItem>}
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
