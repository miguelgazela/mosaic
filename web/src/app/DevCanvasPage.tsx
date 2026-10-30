import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CanvasView } from '../canvas/CanvasView'
import { keysAfter } from '../canvas/order'
import { useBoard } from '../canvas/store'
import type { CanvasElement } from '../canvas/types'
import { newId } from '../lib/ids'

/** Dev-only, auth-free canvas sandbox for e2e and perf checks: /dev/canvas?cards=500 */
export function DevCanvasPage() {
  const [params] = useSearchParams()
  const count = Number(params.get('cards') ?? 6)
  const kind = params.get('type') ?? 'debug' // ?type=note for realistic cards
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const zs = keysAfter([], count)
    const cols = Math.ceil(Math.sqrt(count * 1.6))
    const els: CanvasElement[] = Array.from({ length: count }, (_, i) => ({
      id: newId(),
      type: kind,
      x: 200 + (i % cols) * 200,
      y: 96 + Math.floor(i / cols) * 160,
      width: 160,
      height: 96,
      z: zs[i],
      color: null,
      parentId: null,
      sortKey: null,
      content: kind === 'note' ? { doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: `Note ${i}: a few words of text to lay out.` }] }] } } : {},
    }))
    useBoard.getState().reset(els)
    setReady(true)
  }, [count, kind])
  return <div className="h-full">{ready && <CanvasView />}</div>
}
