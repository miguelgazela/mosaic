import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Globe, Link2, LoaderCircle, Pencil, Play, RefreshCw } from 'lucide-react'
import { addCard } from '../../canvas/actions'
import { patchCmd } from '../../canvas/commands'
import { useBoard } from '../../canvas/store'
import type { CardDefinition, CardProps } from '../types'
import { displayUrl, domainOf, embedSrc, formatDuration, linkContent, normalizeUrl } from './logic'
import { unfurlCard, useUnfurling } from './unfurl'

const PREVIEW_KEYS = ['title', 'description', 'image', 'favicon', 'embed', 'duration', 'failed']

/** Anchor that does nothing when the pointer travelled (a drag), so moving a card never opens the link. */
function useClickGuard() {
  const down = useRef<{ x: number; y: number } | null>(null)
  return {
    onPointerDown: (e: React.PointerEvent) => { down.current = { x: e.clientX, y: e.clientY } },
    onClick: (e: React.MouseEvent) => {
      const d = down.current
      if (e.shiftKey || e.metaKey || e.ctrlKey || (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4)) e.preventDefault()
    },
  }
}

function Favicon({ src, domain }: { src?: string; domain: string }) {
  const [bad, setBad] = useState(false)
  if (!src || bad) {
    return <span aria-hidden className="grid h-4 w-4 shrink-0 place-items-center rounded-[3px] bg-[var(--border)] text-[12px] leading-none font-bold uppercase text-[var(--text-secondary)]">{domain[0]}</span>
  }
  return <img src={src} alt="" width={14} height={14} onError={() => setBad(true)} className="h-[14px] w-[14px] shrink-0 rounded-[3px]" />
}

function DomainRow({ url, favicon, loading }: { url: string; favicon?: string; loading?: boolean }) {
  const domain = domainOf(url)
  const guard = useClickGuard()
  return (
    <div className="mt-1.5 flex items-center gap-1.5 text-[length:var(--text-caption)] leading-[var(--leading-caption)] text-[var(--text-muted)]">
      {loading ? <LoaderCircle size={14} className="shrink-0 animate-spin" aria-hidden /> : <Favicon src={favicon} domain={domain} />}
      <a href={url} target="_blank" rel="noopener noreferrer" data-testid="link-domain" className="truncate hover:text-[var(--link-hover)] hover:underline" {...guard}>{domain}</a>
    </div>
  )
}

function LinkCard({ element: el }: CardProps) {
  const c = linkContent(el.content)
  const editing = useBoard((s) => s.editing === el.id)
  const busy = useUnfurling((s) => !!s.ids[el.id])
  const [playing, setPlaying] = useState(false)
  const [imgBad, setImgBad] = useState(false)
  const guard = useClickGuard()
  const hasPreview = Boolean(c.title || c.image || c.embed)

  useEffect(() => {
    if (c.url && !hasPreview && !c.failed && !editing) void unfurlCard(el.id, c.url)
  }, [el.id, c.url, hasPreview, c.failed, editing])
  useEffect(() => { setPlaying(false); setImgBad(false) }, [c.url])

  if (editing) return <LinkEditor id={el.id} url={c.url} />
  if (!c.url) return null

  const loading = !hasPreview && !c.failed
  if (c.failed && !hasPreview) {
    return (
      <div data-testid="link-card" data-state="failed" className="flex items-center gap-2 rounded-[var(--radius-card)] bg-[var(--card-bg)] px-3.5 py-2.5" onDoubleClick={() => useBoard.getState().setEditing(el.id)}>
        <Globe size={16} className="shrink-0 text-[var(--link)]" aria-hidden />
        <a href={c.url} target="_blank" rel="noopener noreferrer" className="min-w-0 break-all text-[length:var(--text-sm)] leading-[var(--leading-sm)] text-[var(--link)] underline hover:text-[var(--link-hover)]" {...guard}>{displayUrl(c.url)}</a>
      </div>
    )
  }

  const showImage = loading || (c.image && !imgBad) || c.embed
  const state = loading || busy ? 'loading' : c.embed ? 'video' : c.image && !imgBad ? 'full' : 'text'
  return (
    <div data-testid="link-card" data-state={state} className="overflow-hidden rounded-[var(--radius-card)] bg-[var(--card-bg)]" onDoubleClick={() => useBoard.getState().setEditing(el.id)}>
      {showImage && (
        <div className={`relative w-full bg-[var(--canvas-bg-sunken,#f1efec)] ${c.embed ? 'aspect-video' : 'aspect-[280/146]'}`} style={c.embed ? { background: '#4a4d42' } : undefined}>
          {c.embed && playing ? (
            <iframe
              data-nodrag
              title={c.title ?? 'Video'}
              src={embedSrc(c.embed)}
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          ) : (
            <>
              {!loading && c.image && !imgBad && (
                <img src={c.image} alt="" loading="lazy" draggable={false} onError={() => setImgBad(true)} className="absolute inset-0 h-full w-full object-cover" />
              )}
              {c.embed && (
                <>
                  <button
                    type="button"
                    aria-label={`Play ${c.title ?? 'video'}`}
                    onClick={() => setPlaying(true)}
                    className="absolute left-1/2 top-1/2 grid h-11 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[var(--radius-menu)] bg-black/80 text-white hover:bg-black focus-visible:shadow-[var(--ring-focus)]"
                  >
                    <Play size={20} fill="currentColor" aria-hidden />
                  </button>
                  {c.duration ? <span className="absolute bottom-2 right-2 rounded-[var(--radius-chip)] bg-black/80 px-1.5 text-[length:var(--text-caption)] font-semibold leading-[18px] text-white">{formatDuration(c.duration)}</span> : null}
                </>
              )}
            </>
          )}
        </div>
      )}
      <div className="px-3.5 py-3">
        {loading ? (
          <div aria-label="Loading preview" role="status" className="flex flex-col gap-2 pt-1">
            <div className="h-2.5 w-[55%] rounded-full bg-[var(--border)]" />
            <div className="h-2.5 w-[85%] rounded-full bg-[var(--border)]" />
            <div className="h-2.5 w-[40%] rounded-full bg-[var(--border)]" />
          </div>
        ) : (
          <>
            {c.title && (
              <a href={c.url} target="_blank" rel="noopener noreferrer" data-testid="link-title" className="line-clamp-2 block text-[length:var(--text-card-title)] font-semibold leading-[var(--leading-card-title)] text-[var(--text)] hover:text-[var(--link-hover)]" {...guard}>{c.title}</a>
            )}
            {c.description && !c.embed && (
              <p className="mt-0.5 line-clamp-3 text-[length:var(--text-sm)] leading-[var(--leading-sm)] text-[var(--text-secondary)]">{c.description}</p>
            )}
          </>
        )}
        <DomainRow url={c.url} favicon={c.favicon} loading={loading} />
      </div>
    </div>
  )
}

function LinkEditor({ id, url }: { id: string; url: string }) {
  const [v, setV] = useState(url)
  const [invalid, setInvalid] = useState(false)
  const done = useRef(false)

  const close = () => {
    if (done.current) return
    done.current = true
    const s = useBoard.getState()
    // A brand-new card with no URL is dropped, not left empty.
    if (!url) s._remove([id])
    s.setEditing(null)
  }
  const commit = () => {
    const next = normalizeUrl(v)
    if (!next) {
      if (!v.trim()) return close()
      setInvalid(true)
      return
    }
    done.current = true
    const s = useBoard.getState()
    const el = s.elements[id]
    if (el && next !== url) {
      const before = { ...el.content }
      const after: Record<string, unknown> = { ...el.content, url: next }
      for (const k of PREVIEW_KEYS) delete after[k]
      s.exec(patchCmd('Edit link', [{ id, before: { content: before }, after: { content: after } }]))
    }
    s.setEditing(null)
  }
  // Clicking the canvas ends editing and keeps what is typed if it is a valid URL.
  useEffect(() => {
    const unsub = useBoard.subscribe((s) => { if (s.editing !== id && !done.current) { if (normalizeUrl(v)) commit(); else close() } })
    return () => unsub()
  })

  return (
    <div data-nodrag className="rounded-[var(--radius-card)] bg-[var(--card-bg)] p-2.5" onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      <input
        autoFocus
        type="text"
        inputMode="url"
        aria-label="Link URL"
        aria-invalid={invalid}
        placeholder="Paste or type a link"
        value={v}
        onChange={(e) => { setV(e.target.value); setInvalid(false) }}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') commit()
          else if (e.key === 'Escape') close()
        }}
        className={`h-8 w-full rounded-[var(--radius-ui)] border px-2 text-[length:var(--text-sm)] outline-none focus:border-[var(--primary)] focus:shadow-[var(--ring-focus)] ${invalid ? 'border-[var(--danger)]' : 'border-[var(--border-strong)]'}`}
      />
      {invalid && <p role="alert" className="mt-1 text-[length:var(--text-caption)] text-[var(--danger)]">Enter a web address, like example.com</p>}
    </div>
  )
}

export const linkCard: CardDefinition = {
  type: 'link',
  label: 'Link',
  Component: LinkCard,
  defaultSize: { width: 280, height: null },
  resize: 'width',
  minWidth: 200,
  minHeight: 40,
  colorable: false,
  editOnCreate: true,
  toolbar: { label: 'Link', icon: Link2 },
  defaultContent: () => ({ url: '' }),
  onPaste: (data, at) => {
    if (!data.url) return false
    addCard('link', at, { content: { url: data.url }, noEdit: true })
    return true
  },
  menuItems: (el) => {
    const c = linkContent(el.content)
    return [
      { id: 'open', label: 'Open link', icon: ExternalLink, run: () => window.open(c.url, '_blank', 'noopener,noreferrer') },
      { id: 'edit', label: 'Edit link', icon: Pencil, run: () => useBoard.getState().setEditing(el.id) },
      {
        id: 'refresh',
        label: 'Refresh preview',
        icon: RefreshCw,
        run: () => {
          const s = useBoard.getState()
          const cur = s.elements[el.id]
          if (!cur) return
          const content: Record<string, unknown> = { ...cur.content }
          for (const k of PREVIEW_KEYS) delete content[k]
          s._patch([{ id: el.id, patch: { content } }])
        },
      },
    ]
  },
  toPlainText: (el) => {
    const c = linkContent(el.content)
    return [c.title, c.description, c.url].filter(Boolean).join(' ')
  },
  toMarkdown: (el) => {
    const c = linkContent(el.content)
    return `- [${c.title ?? displayUrl(c.url)}](${c.url})`
  },
}
