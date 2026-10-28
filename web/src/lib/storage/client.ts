import { supabase } from '../supabase'
import { BUCKET } from './paths'
import { createSignedUrlCache } from './signedUrls'

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? 'http://localhost:54321'
const ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? ''

/** Owner folder for new uploads. Dev boards have no session; they use a fixed folder. */
export async function currentUid(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const uid = data.session?.user.id
  if (uid) return uid
  if (import.meta.env.DEV) return 'dev-user'
  throw new Error('Not signed in')
}

/** Upload with progress (supabase-js has none, so this talks to the storage REST endpoint). */
export async function putObject(path: string, blob: Blob, onProgress: (loaded: number) => void): Promise<void> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token ?? ANON_KEY
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('apikey', ANON_KEY)
    xhr.setRequestHeader('x-upsert', 'true')
    xhr.setRequestHeader('cache-control', 'max-age=31536000')
    xhr.setRequestHeader('Content-Type', blob.type || 'application/octet-stream')
    xhr.upload.onprogress = (e) => onProgress(e.loaded)
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)))
    xhr.onerror = () => reject(new Error('Network error'))
    xhr.onabort = () => reject(new Error('Upload cancelled'))
    xhr.send(blob)
  })
}

export const signedUrls = createSignedUrlCache(async (paths) => {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600)
  if (error || !data) throw error ?? new Error('sign failed')
  return Object.fromEntries(data.map((d) => [d.path ?? '', d.error ? null : d.signedUrl]))
})

/** Download through a short-lived URL that sets Content-Disposition, so the browser saves the file. */
export async function downloadObject(path: string, filename: string): Promise<void> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60, { download: filename })
  if (error || !data) throw error ?? new Error('Couldn’t create download link')
  const a = document.createElement('a')
  a.href = data.signedUrl
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}
