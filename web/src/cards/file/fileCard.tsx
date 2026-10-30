import { useRef, useState } from 'react'
import { AlertCircle, Download, RotateCw } from 'lucide-react'
import type { CanvasElement } from '../../canvas/types'
import { addFiles, retryUpload, useUploads } from '../../features/upload/uploads'
import { downloadObject } from '../../lib/storage/client'
import { isImageFile } from '../../lib/storage/imagePlan'
import { extOf, formatBytes } from '../../lib/storage/paths'
import { useSignedUrl } from '../../lib/storage/useSignedUrl'
import { toast } from '../../ui'
import type { CardDefinition, CardProps } from '../types'

interface FileContent { path?: string; previewPath?: string; pages: number; pw: number; ph: number; name: string; mime: string; bytes: number }

const readFile = (c: CanvasElement['content']): FileContent => ({
  path: typeof c.path === 'string' ? c.path : undefined,
  previewPath: typeof c.previewPath === 'string' ? c.previewPath : undefined,
  pages: typeof c.pages === 'number' ? c.pages : 0,
  pw: typeof c.pw === 'number' && c.pw > 0 ? c.pw : 3,
  ph: typeof c.ph === 'number' && c.ph > 0 ? c.ph : 4,
  name: typeof c.name === 'string' ? c.name : 'File',
  mime: typeof c.mime === 'string' ? c.mime : '',
  bytes: typeof c.bytes === 'number' ? c.bytes : 0,
})

/** Badge colours per kind: icon tile background + ink. */
function badgeFor(ext: string): { bg: string; ink: string } {
  if (ext === 'pdf') return { bg: 'var(--danger-soft)', ink: 'var(--danger-ink)' }
  if (['xls', 'xlsx', 'csv', 'numbers'].includes(ext)) return { bg: 'var(--success-soft)', ink: 'var(--success)' }
  if (['doc', 'docx', 'pages', 'txt', 'md', 'rtf'].includes(ext)) return { bg: 'var(--info-soft)', ink: 'var(--info)' }
  if (['ppt', 'pptx', 'key'].includes(ext)) return { bg: 'var(--warning-soft)', ink: 'var(--warning-ink)' }
  return { bg: 'var(--fill-pressed)', ink: 'var(--text-secondary)' }
}

async function download(c: FileContent) {
  if (!c.path) return
  try { await downloadObject(c.path, c.name) } catch { toast(`Couldn’t download ${c.name}`, { tone: 'error' }) }
}

function FileCard({ element: el }: CardProps) {
  const c = readFile(el.content)
  const up = useUploads((s) => s.byId[el.id])
  const down = useRef<{ x: number; y: number } | null>(null)
  const ext = extOf(c.name, '').toUpperCase().slice(0, 4)
  const badge = badgeFor(ext.toLowerCase())
  const failed = up?.status === 'failed' || (!c.path && !up)
  const uploading = up?.status === 'uploading' && !c.path
  const pct = Math.round((up?.progress ?? 0) * 100)

  const preview = useSignedUrl(c.previewPath, !failed && !uploading && !!c.previewPath)
  const [previewBroken, setPreviewBroken] = useState(false)
  const showPreview = !!preview.url && !previewBroken && !failed && !uploading

  const sub = failed
    ? (up?.retryable ? 'Upload failed' : up?.error ?? 'Upload didn’t finish.')
    : uploading
      ? `Uploading… ${formatBytes(up.loaded)} of ${formatBytes(up.total || c.bytes)}`
      : [c.pages ? `${c.pages} ${c.pages === 1 ? 'page' : 'pages'}` : '', formatBytes(c.bytes)].filter(Boolean).join(' · ')

  return (
    <div
      data-testid="file-card"
      data-state={failed ? 'failed' : uploading ? 'uploading' : 'ready'}
      className={`relative overflow-hidden rounded-[var(--radius-card)] bg-[var(--card-bg)] ${showPreview ? '' : 'p-3'} ${c.path && !failed ? 'cursor-pointer' : ''}`}
      style={{ boxShadow: failed ? '0 0 0 1.5px var(--danger)' : 'var(--shadow-card)' }}
      onPointerDown={(e) => { down.current = { x: e.clientX, y: e.clientY } }}
      onClick={(e) => {
        const d = down.current
        if (e.shiftKey || e.metaKey || e.ctrlKey || (e.target as HTMLElement).closest('[data-nodrag]')) return
        if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return
        if (!failed && !uploading) void download(c)
      }}
    >
      {showPreview && (
        <div data-testid="file-preview" className="flex justify-center bg-[var(--fill-hover)] px-6 pt-3" style={{ maxHeight: 220, overflow: 'hidden' }}>
          <img
            src={preview.url ?? undefined}
            alt=""
            draggable={false}
            loading="lazy"
            onError={() => setPreviewBroken(true)}
            className="block max-h-[208px] select-none bg-white object-cover object-top shadow-[0_0_0_1px_var(--border)]"
            style={{ aspectRatio: `${c.pw} / ${c.ph}`, maxWidth: '100%' }}
          />
        </div>
      )}
      <div className={`flex items-center gap-3 ${showPreview ? 'px-3 py-2' : ''}`}>
        <div
          className={`flex shrink-0 items-end justify-center rounded-[var(--radius-ui)] pb-1 text-[length:var(--text-caption)] font-bold leading-4 ${showPreview ? 'h-6 w-9 pb-0.5' : 'h-10 w-10'}`}
          style={{ background: failed ? 'var(--danger-soft)' : badge.bg, color: failed ? 'var(--danger)' : badge.ink }}
          aria-hidden
        >
          {failed ? <AlertCircle size={18} className="self-center pb-0" /> : ext}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[length:var(--text-card)] font-semibold leading-[var(--leading-card)]" title={c.name}>{c.name}</div>
          <div
            className="truncate text-[length:var(--text-caption)] leading-[var(--leading-caption)]"
            style={{ color: failed ? 'var(--danger)' : 'var(--text-muted)' }}
          >
            {sub}
          </div>
        </div>
        {failed && up?.retryable && (
          <button
            type="button"
            data-nodrag
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => retryUpload(el.id)}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-[var(--radius-ui)] border border-[var(--border)] bg-[var(--card-bg)] px-3 text-[length:var(--text-sm)] font-semibold hover:bg-[var(--fill-hover)]"
          >
            <RotateCw size={14} aria-hidden /> Retry
          </button>
        )}
      </div>
      {uploading && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--border-strong)]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
          <div className="h-full bg-[var(--primary)]" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  )
}

export const fileCard: CardDefinition = {
  type: 'file',
  label: 'File',
  Component: FileCard,
  defaultSize: { width: 280, height: null },
  resize: 'width',
  minWidth: 200,
  minHeight: 56,
  colorable: false,
  defaultContent: () => ({}),
  onPaste(data, at) {
    const files = (data.files ?? []).filter((f) => !isImageFile(f))
    if (!files.length) return false
    addFiles(files, at)
    return true
  },
  onDropFiles: (files, at) => addFiles(files, at),
  menuItems(el) {
    const c = readFile(el.content)
    return c.path ? [{ id: 'download', label: 'Download', icon: Download, run: () => { void download(c) } }] : []
  },
  toPlainText: (el) => readFile(el.content).name,
  toMarkdown: (el, ctx) => {
    const name = readFile(el.content).name
    const href = ctx?.assetLink(el)
    return href ? `- 📎 [${name}](${href})` : `- 📎 ${name}`
  },
}
