import { useEffect, useRef, useState, type RefObject } from 'react'
import { signedUrls } from './client'
import { useExportMode } from './exportMode'

/** true once the element has come within `margin` px of the viewport (stays true). */
export function useNearViewport(ref: RefObject<Element | null>, margin = 400): boolean {
  const [near, setNear] = useState(typeof IntersectionObserver === 'undefined')
  const exporting = useExportMode((s) => s.on)
  useEffect(() => {
    const node = ref.current
    if (near || !node) return
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setNear(true); io.disconnect() } }, { rootMargin: `${margin}px` })
    io.observe(node)
    return () => io.disconnect()
  }, [ref, near, margin])
  return near || exporting
}

/**
 * Signed URL for `path` (null while loading or on failure). Keeps showing the previous URL while a
 * different path loads, so swapping thumb ↔ original on zoom doesn't flash.
 */
export function useSignedUrl(path: string | undefined, enabled = true): { url: string | null; failed: boolean } {
  const [state, setState] = useState<{ path?: string; url: string | null; failed: boolean }>({ url: null, failed: false })
  const last = useRef<string | null>(null)
  useEffect(() => {
    if (!path || !enabled) return
    let live = true
    void signedUrls.get(path).then((url) => {
      if (!live) return
      if (url) last.current = url
      setState({ path, url, failed: !url })
    })
    return () => { live = false }
  }, [path, enabled])
  if (state.path === path) return { url: state.url ?? last.current, failed: state.failed }
  return { url: last.current, failed: false }
}
