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
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const zs = keysAfter([], count)
    const cols = Math.ceil(Math.sqrt(count * 1.6))
    const els: CanvasElement[] = Array.from({ length: count }, (_, i) => ({
      id: newId(),
      type: 'debug',
      x: 200 + (i % cols) * 200,
      y: 100 + Math.floor(i / cols) * 160,
      width: 160,
      height: 96,
      z: zs[i],
      color: null,
      content: {},
    }))
    useBoard.getState().reset(els)
    setReady(true)
  }, [count])
  return <div className="h-full">{ready && <CanvasView />}</div>
}
