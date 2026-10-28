import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Download, Image as ImageIcon, Maximize2, Pencil, RotateCw } from 'lucide-react'
import { patchCmd } from '../../canvas/commands'
import { useBoard } from '../../canvas/store'
import { addImages, keepLocal, retryUpload, useUploads } from '../../features/upload/uploads'
import { downloadObject } from '../../lib/storage/client'
import { isImageFile } from '../../lib/storage/imagePlan'
import { formatBytes } from '../../lib/storage/paths'
import { useNearViewport, useSignedUrl } from '../../lib/storage/useSignedUrl'
import { toast } from '../../ui'
import type { CardDefinition, CardProps } from '../types'
import { readImage } from './content'
import { Lightbox, useLightbox } from './Lightbox'

function setCaption(id: string, caption: string) {
  const s = useBoard.getState()
  const el = s.elements[id]
  if (!el) return
  const prev = typeof el.content.caption === 'string' ? el.content.caption : ''
  if (prev === caption) return
  s.exec(patchCmd('Edit caption', [{ id, before: { content: el.content }, after: { content: { ...el.content, caption: caption || undefined } } }]))
}

function CaptionEditor({ id, initial }: { id: string; initial: string }) {
  const [v, setV] = useState(initial)
  const done = useRef(false)
  const finish = (save: boolean) => {
    if (done.current) return
    done.current = true
    if (save) setCaption(id, v.trim())
    useBoard.getState().setEditing(null)
  }
  return (
    <input
      autoFocus
      data-nodrag
      aria-label="Caption"
      value={v}
      maxLength={300}
      placeholder="Add a caption"
      onChange={(e) => setV(e.target.value)}
      onBlur={() => finish(true)}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') finish(true)
        else if (e.key === 'Escape') finish(false)
      }}
      className="w-full rounded-[var(--radius-chip)] border border-[var(--primary)] px-1.5 py-0.5 text-[length:var(--text-card)] outline-none"
    />
  )
}

function ImageCard({ element: el, inColumn }: CardProps) {
  const c = readImage(el.content)
  const up = useUploads((s) => s.byId[el.id])
  const thumbView = useBoard((s) => s.viewport.zoom < 1)
  const editing = useBoard((s) => s.editing === el.id)
  const lightboxOpen = useLightbox((s) => s.openId === el.id)
  const root = useRef<HTMLDivElement>(null)
  const near = useNearViewport(root)
  const local = up?.localUrl ?? keepLocal.get(el.id)
  const wantPath = thumbView && c.thumbPath ? c.thumbPath : c.path
  const remote = useSignedUrl(wantPath, near && !local && !up && !!c.path)
  const [broken, setBroken] = useState(false)
  const src = local ?? remote.url
  const unfinished = !c.path && !up
  const failed = up?.status === 'failed' || unfinished
  const uploading = up?.status === 'uploading' && !c.path
  const loadFailed = !!c.path && !local && (remote.failed || broken)

  // In a column the card's width is the column's, so keep the stored height in step with it.
  useEffect(() => {
    const node = root.current
    if (!inColumn || !node) return
    const ro = new ResizeObserver(() => {
      const h = Math.round(node.offsetHeight)
      const cur = useBoard.getState().elements[el.id]
      if (cur && h > 0 && Math.abs((cur.height ?? 0) - h) > 1) useBoard.getState()._patch([{ id: el.id, patch: { height: h } }])
    })
    ro.observe(node)
    return () => ro.disconnect()
  }, [inColumn, el.id])

  const pct = Math.round((up?.progress ?? 0) * 100)
  const strip = editing ? (
    <CaptionEditor id={el.id} initial={c.caption} />
  ) : c.caption ? (
    <span className="line-clamp-3 break-words">{c.caption}</span>
  ) : uploading || failed ? (
    <span className="truncate text-[var(--text-secondary)]">{c.name}{uploading && c.bytes ? ` · ${formatBytes(c.bytes)}` : ''}</span>
  ) : null

  return (
    <div
      ref={root}
      data-testid="image-card"
      data-state={failed ? 'failed' : uploading ? 'uploading' : 'ready'}
      className="relative rounded-[var(--radius-card)]"
      style={{ boxShadow: failed ? '0 0 0 1px var(--danger)' : 'var(--shadow-card)' }}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-nodrag]') || !c.path) return
        useLightbox.getState().open(el.id)
      }}
    >
      <div
        className={`relative w-full overflow-hidden ${strip ? (inColumn ? '' : '') : ''}`}
        style={{
          aspectRatio: `${c.w} / ${c.h}`,
          borderRadius: strip && inColumn ? 'var(--radius-card) var(--radius-card) 0 0' : 'var(--radius-card)',
          background: failed ? 'var(--danger-soft)' : 'var(--card-color-9)',
        }}
      >
        {src && !failed && !loadFailed && (
          <img
            src={src}
            alt={c.caption || c.name}
            draggable={false}
            loading="lazy"
            onError={() => setBroken(true)}
            className="block h-full w-full select-none object-cover"
            style={{ opacity: uploading ? 0.35 : 1 }}
          />
        )}
        {!src && !failed && !uploading && !loadFailed && (
          <div className="flex h-full items-center justify-center text-[var(--icon-subtle)]" data-testid="image-placeholder">
            <ImageIcon size={32} aria-hidden />
          </div>
        )}
        {loadFailed && (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-[length:var(--text-caption)] text-[var(--text-muted)]">
            <ImageIcon size={28} aria-hidden /> Couldn’t load image
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6" role="status">
            <span className="text-[length:var(--text-sm)] font-medium">Uploading… {pct}%</span>
            <div className="h-1 w-full max-w-40 overflow-hidden rounded-full bg-[var(--border-strong)]">
              <div className="h-full bg-[var(--primary)]" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
        {failed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-[length:var(--text-sm)] text-[var(--danger-ink)]" role="alert">
            <AlertCircle size={20} aria-hidden />
            <span>{up?.error ? `Upload failed. ${up.error}` : 'Upload didn’t finish.'}</span>
            {up?.retryable && (
              <button
                type="button"
                data-nodrag
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => retryUpload(el.id)}
                className="flex h-8 items-center gap-1.5 rounded-[var(--radius-ui)] border border-[var(--border)] bg-[var(--card-bg)] px-3 font-semibold text-[var(--text)] hover:bg-[var(--fill-hover)]"
              >
                <RotateCw size={14} aria-hidden /> Retry upload
              </button>
            )}
          </div>
        )}
      </div>
      {strip && (
        <div
          className={`bg-[var(--card-bg)] px-3 py-2 text-[length:var(--text-card)] leading-[var(--leading-card)] ${
            inColumn ? 'rounded-b-[var(--radius-card)]' : 'absolute left-0 right-0 top-full rounded-b-[var(--radius-card)]'
          }`}
          style={inColumn ? undefined : { boxShadow: 'var(--shadow-card)' }}
          data-testid="image-caption"
        >
          {strip}
        </div>
      )}
      {lightboxOpen && <Lightbox id={el.id} />}
    </div>
  )
}

export const imageCard: CardDefinition = {
  type: 'image',
  label: 'Image',
  Component: ImageCard,
  defaultSize: { width: 280, height: 186 },
  resize: 'aspect',
  minWidth: 96,
  minHeight: 48,
  colorable: false,
  editOnCreate: false,
  defaultContent: () => ({}),
  onPaste(data, at) {
    const imgs = (data.files ?? []).filter(isImageFile)
    if (!imgs.length) return false
    addImages(imgs, at)
    return true
  },
  onDropFiles: (files, at) => addImages(files, at),
  menuItems(el) {
    const c = readImage(el.content)
    const items = [
      { id: 'caption', label: c.caption ? 'Edit caption' : 'Add caption', icon: Pencil, run: () => useBoard.getState().setEditing(el.id) },
    ]
    if (!c.path) return items
    return [
      { id: 'open', label: 'Open', icon: Maximize2, run: () => useLightbox.getState().open(el.id) },
      ...items,
      {
        id: 'download',
        label: 'Download original',
        icon: Download,
        run: () => { void downloadObject(c.path!, c.name).catch(() => toast('Couldn’t download the image', { tone: 'error' })) },
      },
    ]
  },
  toPlainText: (el) => {
    const c = readImage(el.content)
    return c.caption || c.name
  },
  toMarkdown: (el) => {
    const c = readImage(el.content)
    return `![${c.caption || c.name}](${c.name})`
  },
}
