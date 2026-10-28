import type { SaveStatus } from './status'

/** What the top bar shows. A lost connection wins over everything; a failed send while online is 'error'. */
export function toSaveState(online: boolean, status: SaveStatus): SaveStatus {
  if (!online || status === 'offline') return 'offline'
  return status
}
