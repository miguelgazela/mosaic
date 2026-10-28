import { boundsOf, clampZoom, fitViewport, zoomAt, type Point } from './geometry'
import { elementRect, useBoard } from './store'

const st = () => useBoard.getState()
const viewCentre = (): Point => ({ x: st().size.w / 2, y: st().size.h / 2 })

export function zoomTo(zoom: number, anchor: Point = viewCentre()): void {
  st().setViewport(zoomAt(st().viewport, clampZoom(zoom), anchor))
}

export const zoomBy = (factor: number, anchor?: Point): void => zoomTo(st().viewport.zoom * factor, anchor)

export function fitToContent(): void {
  const s = st()
  const rects = Object.keys(s.elements).map((id) => elementRect(s, id))
  s.setViewport(fitViewport(boundsOf(rects), s.size))
}

export function panBy(dx: number, dy: number): void {
  const vp = st().viewport
  st().setViewport({ ...vp, x: vp.x + dx, y: vp.y + dy })
}
