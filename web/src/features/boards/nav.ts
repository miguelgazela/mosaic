import { createContext, useContext } from 'react'

/** Where a board lives in the URL. Dev pages override this to stay auth-free. */
export const BoardHrefContext = createContext((id: string) => `/b/${id}`)
export const useBoardHref = () => useContext(BoardHrefContext)

/** Where the trash page lives in the URL (dev pages use `/dev/trash`). */
export const TrashHrefContext = createContext('/trash')
export const useTrashHref = () => useContext(TrashHrefContext)
