import { create } from 'zustand'
import { supabase } from '../../lib/supabase'
import { useBoard } from '../../canvas/store'
import { linkContent, type LinkContent } from './logic'

type Preview = Pick<LinkContent, 'title' | 'description' | 'image' | 'favicon' | 'embed' | 'duration'>

/** Ids whose preview is being fetched (drives the loading skeleton). */
export const useUnfurling = create<{ ids: Record<string, true> }>(() => ({ ids: {} }))
const setBusy = (id: string, on: boolean) =>
  useUnfurling.setState((s) => {
    const ids = { ...s.ids }
    if (on) ids[id] = true
    else delete ids[id]
    return { ids }
  })

export async function fetchPreview(url: string): Promise<Preview> {
  const { data, error } = await supabase.functions.invoke('milanote-unfurl', { body: { url } })
  if (error || !data || typeof data !== 'object' || 'error' in data) throw new Error('unfurl failed')
  const d = data as Record<string, unknown>
  const c = linkContent(d)
  const out: Preview = { title: c.title, description: c.description, image: c.image, favicon: c.favicon, embed: c.embed, duration: c.duration }
  if (!out.title && !out.image && !out.embed) throw new Error('empty preview')
  return out
}

/**
 * Fetch the preview for a link card and store it in the card's content. The result is written with a
 * raw patch, not a command: it is derived data, so Undo must not roll it back (the card would refetch).
 * The write still reaches the sync queue through the store.
 */
/** `id|url` pairs fetched this session; a failed card loaded from the database is retried once, not in a loop. */
const tried = new Set<string>()
export const wasTried = (id: string, url: string) => tried.has(`${id}|${url}`)

export async function unfurlCard(id: string, url: string): Promise<void> {
  if (useUnfurling.getState().ids[id]) return
  tried.add(`${id}|${url}`)
  setBusy(id, true)
  let patch: Record<string, unknown>
  try {
    const p = await fetchPreview(url)
    patch = { ...p, failed: undefined }
  } catch {
    patch = { failed: true }
  }
  setBusy(id, false)
  const s = useBoard.getState()
  const el = s.elements[id]
  // Card gone, or its URL changed while we waited: drop the stale result.
  if (!el || el.content.url !== url) return
  const content: Record<string, unknown> = { ...el.content, ...patch }
  for (const k of Object.keys(content)) if (content[k] === undefined) delete content[k]
  s._patch([{ id, patch: { content } }])
}
