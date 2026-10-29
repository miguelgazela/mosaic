import type { ConnRow, ElementRow } from '../../lib/sync/rows'
import type { Viewport } from '../../canvas/geometry'

/** Answer of the `milanote-share` edge function (see supabase/functions/milanote-share/README.md). */
export interface SharedBoardInfo { id: string; title: string; icon: string | null; color: string | null }
export interface SharePayload {
  status: 'ok'
  ownerName: string
  includeSubboards: boolean
  root: SharedBoardInfo
  board: SharedBoardInfo & { viewport: Viewport | null }
  /** Shared board → board shown. */
  path: SharedBoardInfo[]
  elements: ElementRow[]
  connections: ConnRow[]
  children: Record<string, { title: string; icon: string | null; color: string | null; count: number }>
  /** Storage path → signed URL. */
  urls: Record<string, string>
}

/** Revoked, unknown, or a board the link doesn't open. */
export class ShareGone extends Error {
  constructor() { super('share not available') }
}

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? 'http://localhost:54321'
const ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? ''

export async function fetchShared(token: string, boardId?: string): Promise<SharePayload> {
  if (import.meta.env.DEV && token.startsWith('demo')) {
    const { demoShare } = await import('./demo')
    return demoShare(token, boardId)
  }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/milanote-share`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: ANON_KEY },
    body: JSON.stringify({ token, boardId }),
  })
  if (res.status === 404 || res.status === 400) throw new ShareGone()
  if (!res.ok) throw new Error(`Couldn’t load the board (${res.status})`)
  return (await res.json()) as SharePayload
}
