import { create } from 'zustand'
import { addCard } from '../../canvas/actions'
import type { Point } from '../../canvas/geometry'
import { useBoard } from '../../canvas/store'
import { toast } from '../../ui'
import { currentUid, putObject } from '../../lib/storage/client'
import { cardSizeFor, isImageFile } from '../../lib/storage/imagePlan'
import { MAX_FILE_BYTES, extForMime, extOf, formatBytes, originalPath, previewPath, thumbPath } from '../../lib/storage/paths'
import { isPdfFile, renderPdfPreview } from '../../lib/storage/pdfPreview'
import { prepareImage } from '../../lib/storage/processImage'

/** Per-card upload state. Lives only in this tab; a card with no `path` and no state here is an unfinished upload. */
export interface UploadState {
  status: 'uploading' | 'failed'
  /** 0..1 */
  progress: number
  error?: string
  /** false when retrying can't help (file too large, unreadable image). */
  retryable: boolean
  /** Object URL of the thumbnail, so a just-added image shows without a download. */
  localUrl?: string
  /** Bytes sent so far / total, for the file card's "1.6 of 8.4 MB". */
  loaded: number
  total: number
}

export const useUploads = create<{ byId: Record<string, UploadState> }>()(() => ({ byId: {} }))
const setState = (id: string, patch: Partial<UploadState> | null) =>
  useUploads.setState((s) => {
    const byId = { ...s.byId }
    if (patch === null) delete byId[id]
    else byId[id] = { ...(byId[id] ?? { status: 'uploading', progress: 0, retryable: true, loaded: 0, total: 0 }), ...patch }
    return { byId }
  })

/** Object URLs of freshly added images, kept for the session so they never flash a placeholder. */
export const keepLocal = new Map<string, string>()

interface Job {
  file: File
  kind: 'image' | 'file'
}
const jobs = new Map<string, Job>()
const MAX_PARALLEL = 3
let running = 0
const queue: Array<() => Promise<void>> = []
function enqueue(task: () => Promise<void>): void {
  queue.push(task)
  pump()
}
function pump(): void {
  while (running < MAX_PARALLEL && queue.length) {
    const t = queue.shift()!
    running++
    void t().finally(() => { running--; pump() })
  }
}

const mergeContent = (id: string, patch: Record<string, unknown>, extra: Record<string, unknown> = {}) => {
  const el = useBoard.getState().elements[id]
  if (!el) return false
  // Raw patch (no undo entry): the add command already covers undo, and the queue syncs the diff.
  useBoard.getState()._patch([{ id, patch: { ...extra, content: { ...el.content, ...patch } } }])
  return true
}

const place = (at: Point, i: number): Point => ({ x: at.x + i * 24, y: at.y + i * 24 })

function fail(id: string, name: string, error: string, retryable: boolean) {
  setState(id, { status: 'failed', error, retryable })
  toast(`Couldn’t upload ${name}`, { tone: 'error', action: retryable ? { label: 'Retry', run: () => retryUpload(id) } : undefined })
}

async function runImage(id: string, file: File): Promise<void> {
  let prepared
  try {
    prepared = await prepareImage(file)
  } catch {
    return fail(id, file.name, 'Couldn’t read this image.', false)
  }
  if (prepared.original.size > MAX_FILE_BYTES) {
    return fail(id, file.name, `Too large (${formatBytes(prepared.original.size)}). The limit is 10 MB.`, false)
  }
  const size = cardSizeFor(prepared.w, prepared.h)
  mergeContent(id, { w: prepared.w, h: prepared.h }, { width: size.width, height: size.height })
  // The full (≤ 2560 px) image, not the 512 px thumb: it stays on screen until reload and must look sharp.
  const localUrl = URL.createObjectURL(prepared.original)
  setState(id, { localUrl })
  try {
    const uid = await currentUid()
    const orig = originalPath(uid, id, extForMime(prepared.original.type))
    const thumb = thumbPath(uid, id, extForMime(prepared.thumb.type))
    const total = prepared.original.size + prepared.thumb.size
    setState(id, { total, loaded: 0 })
    await putObject(thumb, prepared.thumb, (l) => setState(id, { loaded: l, progress: l / total }))
    await putObject(orig, prepared.original, (l) => {
      const loaded = prepared.thumb.size + l
      setState(id, { loaded, progress: loaded / total })
    })
    mergeContent(id, { path: orig, thumbPath: thumb, name: prepared.name, bytes: prepared.original.size })
    keepLocal.set(id, localUrl)
    setState(id, null)
  } catch (e) {
    fail(id, file.name, e instanceof Error && e.message === 'Network error' ? 'The connection dropped.' : 'Upload failed.', true)
  }
}

async function runFile(id: string, file: File): Promise<void> {
  try {
    const uid = await currentUid()
    const path = originalPath(uid, id, extOf(file.name))
    setState(id, { total: file.size, loaded: 0 })
    await putObject(path, file, (l) => setState(id, { loaded: l, progress: l / file.size }))
    mergeContent(id, { path })
    setState(id, null)
    if (isPdfFile(file)) void uploadPdfPreview(id, uid, file)
  } catch (e) {
    fail(id, file.name, e instanceof Error && e.message === 'Network error' ? 'The connection dropped.' : 'Upload failed.', true)
  }
}

/** Best effort: a PDF without a preview still works as a plain file card. */
async function uploadPdfPreview(id: string, uid: string, file: File): Promise<void> {
  try {
    const pv = await renderPdfPreview(file)
    const path = previewPath(uid, id)
    await putObject(path, pv.blob, () => {})
    mergeContent(id, { previewPath: path, pages: pv.pages, pw: pv.w, ph: pv.h })
  } catch { /* leave the card as it is */ }
}

function start(id: string): void {
  const job = jobs.get(id)
  if (!job) return
  setState(id, { status: 'uploading', progress: 0, error: undefined, retryable: true, loaded: 0 })
  enqueue(() => (job.kind === 'image' ? runImage(id, job.file) : runFile(id, job.file)))
}

export function retryUpload(id: string): void {
  if (!useBoard.getState().elements[id]) return
  start(id)
}

/** Create an image card for each image file and upload it. */
export function addImages(files: File[], at: Point): void {
  files.filter(isImageFile).forEach((file, i) => {
    const el = addCard('image', place(at, i), { content: { name: file.name, bytes: file.size } })
    if (!el) return
    jobs.set(el.id, { file, kind: 'image' })
    start(el.id)
  })
}

/** Create a file card for each non-image file and upload it. Over-size files get a failed card. */
export function addFiles(files: File[], at: Point): void {
  files.filter((f) => !isImageFile(f)).forEach((file, i) => {
    const el = addCard('file', place(at, i), { content: { name: file.name, mime: file.type || 'application/octet-stream', bytes: file.size } })
    if (!el) return
    if (file.size > MAX_FILE_BYTES) {
      setState(el.id, { status: 'failed', retryable: false, error: `Too large (${formatBytes(file.size)}). The limit is 10 MB.`, progress: 0, loaded: 0, total: file.size })
      toast(`${file.name} is over the 10 MB limit`, { tone: 'error' })
      return
    }
    jobs.set(el.id, { file, kind: 'file' })
    start(el.id)
  })
}
