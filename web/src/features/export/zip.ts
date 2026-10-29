import JSZip from 'jszip'
import type { CanvasElement } from '../../canvas/types'
import { getBoardRepo } from '../boards/boardRepo'
import { fetchBoard } from '../../lib/sync/boardApi'
import { fromRow } from '../../lib/sync/rows'
import { signedUrls } from '../../lib/storage/client'
import { boardToMarkdown } from './markdown'
import { assetPathFor } from './paths'
import { planBoards } from './plan'

export interface ZipInput {
  rootId: string
  rootTitle: string
  /** The open board's cards (live, includes edits not yet saved). Sub-boards are fetched. */
  rootElements: CanvasElement[]
  onProgress: (done: number, total: number, label: string) => void
  signal: AbortSignal
}

const aborted = () => new DOMException('Export cancelled', 'AbortError')

async function fetchAsset(path: string): Promise<Blob | null> {
  const url = await signedUrls.get(path)
  if (!url) return null
  try {
    const r = await fetch(url)
    return r.ok ? await r.blob() : null
  } catch {
    return null
  }
}

/** Markdown zip: one `.md` per board mirroring the board tree, plus `assets/` with every image and file. */
export async function buildMarkdownZip({ rootId, rootTitle, rootElements, onProgress, signal }: ZipInput): Promise<{ blob: Blob; missing: number }> {
  let nodes = await getBoardRepo().tree().catch(() => [])
  if (!nodes.length) nodes = [{ id: rootId, parentId: null, title: rootTitle, icon: null, color: null, isHome: false }]
  const planned = planBoards(nodes, rootId, rootTitle)
  const boardPaths = Object.fromEntries(planned.map((b) => [b.id, { title: b.title, path: b.path }]))
  const zip = new JSZip()
  const assets = new Map<string, string>() // storage path → zip path
  let missing = 0

  let done = 0
  const total = planned.length
  for (const b of planned) {
    if (signal.aborted) throw aborted()
    onProgress(done, total, `Reading board ${done + 1} of ${total}`)
    let elements: CanvasElement[] | null = null
    if (b.id === rootId) elements = rootElements
    else {
      try { elements = (await fetchBoard(b.id)).elements.map(fromRow) } catch { elements = null }
    }
    if (!elements) { missing++; zip.file(b.path, `# ${b.title}\n\n_This board couldn’t be read._\n`); done++; continue }
    zip.file(b.path, boardToMarkdown({ title: b.title, elements, path: b.path, boardPaths }))
    for (const el of elements) if ((el.type === 'image' || el.type === 'file') && typeof el.content.path === 'string') assets.set(el.content.path, assetPathFor(el))
    done++
  }

  const files = [...assets.entries()]
  signedUrls.prefetch(files.map(([p]) => p))
  for (let i = 0; i < files.length; i++) {
    if (signal.aborted) throw aborted()
    onProgress(i, files.length, `Downloading file ${i + 1} of ${files.length}`)
    const blob = await fetchAsset(files[i][0])
    if (blob) zip.file(files[i][1], blob)
    else missing++
  }
  onProgress(files.length, files.length, 'Zipping…')
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  return { blob, missing }
}
