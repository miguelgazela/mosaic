import { useBoard } from '../../canvas/store'
import { flushActiveBoard } from '../../lib/sync/boardSync'
import { toast } from '../../ui'
import { safeName } from './paths'
import { useExportJob } from './store'

export type ExportKind = 'png-board' | 'png-view' | 'pdf' | 'markdown'

const LABEL: Record<ExportKind, string> = { 'png-board': 'PNG', 'png-view': 'PNG', pdf: 'PDF', markdown: 'Markdown zip' }

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Runs one export of the open board: progress panel, download, "Export ready" toast. Export code loads on first use. */
export async function runExport(kind: ExportKind, board: { id: string; title: string }): Promise<void> {
  if (useExportJob.getState().job) return
  const abort = new AbortController()
  const set = (detail: string, ratio: number | null) => useExportJob.setState({ job: { label: LABEL[kind], ratio, detail, abort } })
  set('Starting…', null)
  const base = safeName(board.title, 'Board')
  try {
    const els = Object.values(useBoard.getState().elements)
    if (kind !== 'markdown' && !els.length) {
      toast('This board is empty, nothing to export', { tone: 'error' })
      return
    }
    let blob: Blob
    let filename: string
    let note = ''
    if (kind === 'markdown') {
      await flushActiveBoard().catch(() => {})
      const { buildMarkdownZip } = await import('./zip')
      const r = await buildMarkdownZip({
        rootId: board.id,
        rootTitle: board.title,
        rootElements: els,
        signal: abort.signal,
        onProgress: (done, total, label) => set(label, total ? done / total : null),
      })
      blob = r.blob
      filename = `${base}.zip`
      if (r.missing) note = ` (${r.missing} item${r.missing === 1 ? '' : 's'} couldn’t be included)`
    } else {
      const { renderBoardImage, dataUrlToBlob, imageToPdf } = await import('./image')
      const img = await renderBoardImage(kind === 'png-view' ? 'view' : 'board', (l) => set(l, null))
      if (abort.signal.aborted) throw new DOMException('Export cancelled', 'AbortError')
      if (kind === 'pdf') {
        set('Building the PDF', 0.9)
        blob = await imageToPdf(img)
        filename = `${base}.pdf`
      } else {
        blob = await dataUrlToBlob(img.dataUrl)
        filename = `${base}.png`
      }
    }
    if (abort.signal.aborted) throw new DOMException('Export cancelled', 'AbortError')
    saveBlob(blob, filename)
    useExportJob.setState({ job: null })
    toast(`Export ready: ${filename}${note}`, { tone: 'success', action: { label: 'Download', run: () => saveBlob(blob, filename) } })
  } catch (e) {
    useExportJob.setState({ job: null })
    if (e instanceof DOMException && e.name === 'AbortError') toast('Export cancelled')
    else toast('Couldn’t export the board', { tone: 'error' })
  } finally {
    useExportJob.setState({ job: null })
  }
}
