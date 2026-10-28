// milanote-unfurl: member-only link preview. POST { url } -> { title?, description?, image?, favicon?, embed?, duration? }
// Deploy: see README in the repo root of this function (supabase functions deploy milanote-unfurl).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0'
import { detectVideo, merge, oembedUrl, parseHtml, parseOembed, type Unfurl } from './parse.ts'
import { assertPublicUrl, safeFetchText, UnfurlError } from './ssrf.ts'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } })

const UA = { 'user-agent': 'Mozilla/5.0 (compatible; MosaicLinkPreview/1.0)', accept: 'text/html,application/xhtml+xml,application/json;q=0.9' }

export async function unfurl(raw: string): Promise<Unfurl> {
  const target = await assertPublicUrl(raw)
  const video = detectVideo(target)
  let result: Unfurl = {}
  if (video) {
    try {
      const { body } = await safeFetchText(oembedUrl(video), { headers: UA })
      result = parseOembed(JSON.parse(body), video, target)
    } catch { /* fall back to page meta below */ }
  }
  if (!result.title || !result.image) {
    try {
      const page = await safeFetchText(target.href, { headers: UA })
      if (/html|xml/i.test(page.contentType) || !page.contentType) {
        result = merge(result, parseHtml(page.body, page.finalUrl))
      }
    } catch (e) {
      if (!result.title) throw e
    }
  }
  if (video) result.embed = video
  return result
}

// Import-safe: tests import `unfurl`; only serve when run as the function entrypoint.
if (import.meta.main) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
    if (req.method !== 'POST') return json({ error: 'method' }, 405)

    const auth = req.headers.get('authorization')
    if (!auth?.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { authorization: auth } },
      db: { schema: 'milanote' },
    })
    const { data: user } = await sb.auth.getUser()
    if (!user?.user) return json({ error: 'unauthorized' }, 401)
    const { data: member } = await sb.rpc('is_member')
    if (member !== true) return json({ error: 'forbidden' }, 403)

    let url: unknown
    try { url = (await req.json()).url } catch { return json({ error: 'bad_request' }, 400) }
    if (typeof url !== 'string' || url.length > 2048) return json({ error: 'bad_url' }, 400)

    try {
      return json(await unfurl(url))
    } catch (e) {
      if (e instanceof UnfurlError) {
        const status = e.code === 'blocked' || e.code === 'bad_url' ? 400 : e.code === 'timeout' ? 504 : 502
        return json({ error: e.code }, status)
      }
      return json({ error: 'upstream' }, 502)
    }
  })
}
