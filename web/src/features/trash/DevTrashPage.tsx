import { ensureDevRepo } from '../boards/boardRepo'
import { BoardHrefContext } from '../boards/nav'
import { TrashPage } from './TrashPage'

/** Dev-only trash page on the in-memory database (/dev/trash), for e2e and visual checks. */
export function DevTrashPage() {
  ensureDevRepo()
  return (
    <BoardHrefContext.Provider value={(id) => `/dev/board/${id}`}>
      <TrashPage homeTo="/dev/board/home" />
    </BoardHrefContext.Provider>
  )
}
