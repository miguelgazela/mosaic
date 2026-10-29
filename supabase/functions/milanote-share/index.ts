// milanote-share: public, read-only view of a shared board. POST { token, boardId? } → board, cards, lines, signed file URLs.
// The caller has no session; the token is the credential. Deployed with --no-verify-jwt (see README).
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0'
import { type BoardRow, type ConnectionRow, displayName, type ElementRow, handleShare, type ShareRow, type ShareStore } from './share.ts'

const BUCKET = 'milanote-files'
const SIGN_SECONDS = 3600

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json', 'cache-control': 'no-store' } })

// deno-lint-ignore no-explicit-any
type Sb = SupabaseClient<any, 'milanote', any>

const BOARD_COLS = 'id,title,icon,color,parent_board_id,viewport,deleted_at'
const ELEMENT_COLS = 'id,board_id,type,parent_id,x,y,width,height,z,sort_key,color,content'
const CONNECTION_COLS = 'id,board_id,from_element_id,to_element_id,from_point,to_point,style,label'

export function supabaseStore(sb: Sb): ShareStore {
  const must = <T>(r: { data: T | null; error: { message: string } | null }, what: string): T => {
    if (r.error) throw new Error(`${what}: ${r.error.message}`)
    return r.data as T
  }
  return {
    async findShare(token) {
      return must(await sb.from('shares').select('id,board_id,owner_id,include_subboards,revoked_at').eq('token', token).maybeSingle(), 'shares') as ShareRow | null
    },
    async board(id) {
      return must(await sb.from('boards').select(BOARD_COLS).eq('id', id).maybeSingle(), 'boards') as BoardRow | null
    },
    async elements(boardId) {
      return must(await sb.from('elements').select(ELEMENT_COLS).eq('board_id', boardId).is('deleted_at', null), 'elements') as ElementRow[]
    },
    async connections(boardId) {
      return must(await sb.from('connections').select(CONNECTION_COLS).eq('board_id', boardId).is('deleted_at', null), 'connections') as ConnectionRow[]
    },
    async boards(ids) {
      return must(await sb.from('boards').select(BOARD_COLS).in('id', ids).is('deleted_at', null), 'boards') as BoardRow[]
    },
    async counts(ids) {
      const rows = must(await sb.from('elements').select('board_id').in('board_id', ids).is('deleted_at', null), 'counts') as { board_id: string }[]
      const out: Record<string, number> = {}
      for (const r of rows) out[r.board_id] = (out[r.board_id] ?? 0) + 1
      return out
    },
    async ownerName(ownerId) {
      const { data } = await sb.auth.admin.getUserById(ownerId)
      return displayName(data?.user?.user_metadata, data?.user?.email)
    },
    async sign(paths) {
      const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(paths, SIGN_SECONDS)
      if (error) throw new Error(`storage: ${error.message}`)
      const out: Record<string, string> = {}
      for (const d of data ?? []) if (d.path && d.signedUrl && !d.error) out[d.path] = d.signedUrl
      return out
    },
  }
}

if (import.meta.main) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
    if (req.method !== 'POST') return json({ status: 'bad_request' }, 405)
    let body: Record<string, unknown>
    try { body = await req.json() } catch { return json({ status: 'bad_request' }, 400) }
    // Service role stays inside this function; it is never sent to the browser.
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      db: { schema: 'milanote' },
      auth: { persistSession: false },
    })
    try {
      const r = await handleShare(supabaseStore(sb), body)
      return json(r.body, r.status)
    } catch (e) {
      console.error('milanote-share failed', e)
      return json({ status: 'error' }, 500)
    }
  })
}
