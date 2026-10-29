// milanote-purge: daily clean-up. Hard-deletes boards, cards and lines that sat in the trash for 30 days, then
// removes storage objects no card refers to. Called by a schedule (see README), never by the web app.
// POST with header `x-cron-secret: <PURGE_CRON_SECRET>`; `?dry=1` reports what it would remove and removes nothing.
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0'
import { runPurge, type PurgeStore, type StoredObject } from './purge.ts'

const BUCKET = 'milanote-files'
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** Constant-time string compare. */
export function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let d = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return d === 0
}

// deno-lint-ignore no-explicit-any
type Sb = SupabaseClient<any, 'milanote', any>

export function supabaseStore(sb: Sb): PurgeStore {
  const del = async (table: string, cutoffIso: string): Promise<number> => {
    const { count, error } = await sb.from(table).delete({ count: 'exact' }).lt('deleted_at', cutoffIso)
    if (error) throw new Error(`${table}: ${error.message}`)
    return count ?? 0
  }
  return {
    async deleteTrashedBefore(cutoffIso) {
      // Cards and lines first, then boards (their remaining cards and lines go through the foreign keys).
      const elements = await del('elements', cutoffIso)
      const connections = await del('connections', cutoffIso)
      const boards = await del('boards', cutoffIso)
      return { elements, connections, boards }
    },
    async fileContents() {
      const out: unknown[] = []
      for (let from = 0; ; from += 1000) {
        const { data, error } = await sb.from('elements').select('content').in('type', ['image', 'file']).range(from, from + 999)
        if (error) throw new Error(`elements: ${error.message}`)
        out.push(...(data ?? []).map((r: { content: unknown }) => r.content))
        if (!data || data.length < 1000) return out
      }
    },
    async listObjects() {
      // Layout is {user_id}/{element_id}/{file}; the API lists one folder level at a time.
      const out: StoredObject[] = []
      const walk = async (prefix: string, depth: number): Promise<void> => {
        for (let offset = 0; ; offset += 1000) {
          const { data, error } = await sb.storage.from(BUCKET).list(prefix, { limit: 1000, offset })
          if (error) throw new Error(`storage: ${error.message}`)
          for (const e of data ?? []) {
            const name = prefix ? `${prefix}/${e.name}` : e.name
            if (e.id === null && depth < 3) await walk(name, depth + 1)
            else if (e.id !== null) out.push({ name, createdAt: e.created_at ?? null })
          }
          if (!data || data.length < 1000) return
        }
      }
      await walk('', 1)
      return out
    },
    async removeObjects(names) {
      const { error } = await sb.storage.from(BUCKET).remove(names)
      if (error) throw new Error(`storage remove: ${error.message}`)
    },
  }
}

if (import.meta.main) {
  Deno.serve(async (req) => {
    if (req.method !== 'POST') return json({ error: 'method' }, 405)
    const secret = Deno.env.get('PURGE_CRON_SECRET')
    if (!secret || !safeEqual(req.headers.get('x-cron-secret') ?? '', secret)) return json({ error: 'unauthorized' }, 401)
    // Service role stays inside this function; it is never sent to the browser.
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      db: { schema: 'milanote' },
      auth: { persistSession: false },
    })
    try {
      const dryRun = new URL(req.url).searchParams.get('dry') === '1'
      return json(await runPurge(supabaseStore(sb), new Date(), { dryRun }))
    } catch (e) {
      console.error('milanote-purge failed', e)
      return json({ error: 'failed', message: (e as Error).message }, 500)
    }
  })
}
