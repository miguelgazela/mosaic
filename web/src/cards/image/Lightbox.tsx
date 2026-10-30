import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Download, Image as ImageIcon, Loader2, X } from 'lucide-react'
import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { useBoard } from '../../canvas/store'
import { useBoardInfo } from '../../features/boards/boardRepo'
import { keepLocal } from '../../features/upload/uploads'
import { downloadObject } from '../../lib/storage/client'
import { useSignedUrl } from '../../lib/storage/useSignedUrl'
import { toast } from '../../ui'
import { readImage } from './content'

export const useLightbox = create<{ openId: string | null; open(id: string): void; close(): void }>()((set) => ({
  openId: null,
  open: (openId) => set({ openId }),
  close: () => set({ openId: null }),
}))

const circle =
  'absolute top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30'

/** Full-screen viewer (08-lightbox-*). Rendered by the open card, so it unmounts with it. */
export function Lightbox({ id }: { id: string }) {
  const close = useLightbox((s) => s.close)
  const open = useLightbox((s) => s.open)
  const ids = useBoard(
    useShallow((s) =>
      Object.values(s.elements)
        .filter((e) => e.type === 'image' && !e.parentId && typeof e.content.path === 'string')
        .sort((a, b) => a.y - b.y || a.x - b.x)
        .map((e) => e.id),
    ),
  )
  const boardId = useBoard((s) => s.boardId)
  const boardTitle = useBoardInfo(boardId ?? undefined).data?.title ?? 'this board'
  const el = useBoard((s) => s.elements[id])
  const c = readImage(el?.content ?? {})
  const idx = ids.indexOf(id)
  const full = useSignedUrl(c.path)
  const thumb = useSignedUrl(c.thumbPath, !keepLocal.has(id))
  const preview = keepLocal.get(id) ?? thumb.url
  const [loaded, setLoaded] = useState<string | null>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)
  const ready = !!full.url && loaded === full.url

  const go = (d: number) => { if (ids.length > 1) open(ids[(idx + d + ids.length) % ids.length]) }

  useEffect(() => { closeBtn.current?.focus() }, [])
  useEffect(() => {
    if (!el) close()
  }, [el, close])
  useEffect(() => {
    // Capture on document so the canvas' arrow-key nudge never sees these keys.
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
      else return
      e.preventDefault()
      e.stopPropagation()
    }
    document.addEventListener('keydown', key, true)
    return () => document.removeEventListener('keydown', key, true)
  })

  if (!el) return null
  const download = async () => {
    if (!c.path) return
    try { await downloadObject(c.path, c.name) } catch { toast('Couldn’t download the image', { tone: 'error' }) }
  }
  // Fit the window, but never bigger than ~960 px on the long edge (08-lightbox-default).
  const LIGHTBOX_MAX = 960
  const sizeStyle = {
    aspectRatio: `${c.w} / ${c.h}`,
    height: `min(calc(100vh - 220px), calc((100vw - 240px) * ${c.h / c.w}), ${Math.min(LIGHTBOX_MAX, LIGHTBOX_MAX * (c.h / c.w))}px)`,
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      data-testid="lightbox"
      className="fixed inset-0 z-[3000000] flex flex-col items-center justify-center bg-[var(--text)] text-white"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => { if (e.target === e.currentTarget) close() }}
    >
      <div className="absolute left-6 top-6 text-[length:var(--text-sm)] text-white/80">
        {idx >= 0 ? `${idx + 1} of ${ids.length} images on ${boardTitle}` : boardTitle}
      </div>
      <div className="absolute right-4 top-3 flex gap-3">
        <button
          type="button"
          onClick={download}
          disabled={!ready}
          className="flex h-10 items-center gap-2 rounded-[var(--radius-ui)] bg-white/10 px-4 text-[length:var(--text-card)] font-semibold hover:bg-white/20 disabled:opacity-40"
        >
          <Download size={16} aria-hidden /> Download original
        </button>
        <button ref={closeBtn} type="button" aria-label="Close" onClick={close} className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-ui)] bg-white/10 hover:bg-white/20">
          <X size={18} aria-hidden />
        </button>
      </div>
      {ids.length > 1 && (
        <>
          <button type="button" aria-label="Previous image" className={`${circle} left-4`} onClick={() => go(-1)}><ChevronLeft size={20} aria-hidden /></button>
          <button type="button" aria-label="Next image" className={`${circle} right-4`} onClick={() => go(1)}><ChevronRight size={20} aria-hidden /></button>
        </>
      )}
      <div className="relative overflow-hidden rounded-[var(--radius-chip)] bg-[var(--card-color-7)]" style={sizeStyle}>
        {preview && <img src={preview} alt="" className="absolute inset-0 h-full w-full object-contain" />}
        {full.url && (
          <img
            key={full.url}
            src={full.url}
            alt={c.caption || c.name}
            data-testid="lightbox-image"
            className="absolute inset-0 h-full w-full object-contain"
            style={{ opacity: ready ? 1 : 0 }}
            onLoad={() => setLoaded(full.url)}
          />
        )}
        {!ready && (
          <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/30 text-[length:var(--text-sm)] font-medium">
            {full.failed ? (
              <>
                <ImageIcon size={32} aria-hidden /> Couldn’t load this image
              </>
            ) : (
              <>
                <Loader2 size={28} className="animate-spin" aria-hidden /> Loading full size…
              </>
            )}
          </div>
        )}
      </div>
      <div className="absolute bottom-8 flex max-w-[70vw] flex-col items-center gap-1 text-center">
        {c.caption && <div className="text-[length:var(--text-card)]">{c.caption}</div>}
        <div className="text-[length:var(--text-sm)] text-white/70">{c.name}, {c.w} × {c.h}</div>
      </div>
    </div>,
    document.body,
  )
}
