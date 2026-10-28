import { describe, expect, it } from 'vitest'
import {
  boundsOf, centerOfView, clampZoom, fitViewport, rectFromPoints, rectsIntersect, resizeBox,
  screenToWorld, snap, worldToScreen, zoomAt, MAX_ZOOM, MIN_ZOOM,
} from './geometry'

describe('snap', () => {
  it('rounds to 8px grid', () => {
    expect(snap(0)).toBe(0)
    expect(snap(3)).toBe(0)
    expect(snap(4)).toBe(8)
    expect(snap(-5)).toBe(-8)
    expect(snap(13)).toBe(16)
  })
})

describe('viewport transforms', () => {
  const vp = { x: 100, y: -50, zoom: 2 }
  it('round-trips', () => {
    const p = { x: 33, y: 71 }
    expect(screenToWorld(vp, worldToScreen(vp, p))).toEqual(p)
  })
  it('clamps zoom', () => {
    expect(clampZoom(0.01)).toBe(MIN_ZOOM)
    expect(clampZoom(99)).toBe(MAX_ZOOM)
  })
  it('zoomAt keeps anchor world point fixed', () => {
    const anchor = { x: 300, y: 200 }
    const before = screenToWorld(vp, anchor)
    const next = zoomAt(vp, 3, anchor)
    expect(next.zoom).toBe(3)
    const after = screenToWorld(next, anchor)
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })
  it('zoomAt respects limits', () => {
    expect(zoomAt(vp, 100, { x: 0, y: 0 }).zoom).toBe(MAX_ZOOM)
  })
  it('centerOfView', () => {
    expect(centerOfView({ x: 0, y: 0, zoom: 2 }, { w: 200, h: 100 })).toEqual({ x: 50, y: 25 })
  })
})

describe('rects', () => {
  it('rectFromPoints normalises', () => {
    expect(rectFromPoints({ x: 10, y: 10 }, { x: 0, y: 4 })).toEqual({ x: 0, y: 4, w: 10, h: 6 })
  })
  it('intersect', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 }
    expect(rectsIntersect(a, { x: 5, y: 5, w: 10, h: 10 })).toBe(true)
    expect(rectsIntersect(a, { x: 10, y: 0, w: 5, h: 5 })).toBe(false)
    expect(rectsIntersect(a, { x: 20, y: 20, w: 1, h: 1 })).toBe(false)
  })
  it('boundsOf', () => {
    expect(boundsOf([])).toBeNull()
    expect(boundsOf([{ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 5, w: 10, h: 10 }])).toEqual({ x: 0, y: 0, w: 30, h: 15 })
  })
})

describe('fitViewport', () => {
  it('empty → 100% origin', () => {
    expect(fitViewport(null, { w: 800, h: 600 })).toEqual({ x: 0, y: 0, zoom: 1 })
  })
  it('centres bounds and scales down when large', () => {
    const vp = fitViewport({ x: 0, y: 0, w: 2000, h: 1000 }, { w: 1000, h: 800 }, 0)
    expect(vp.zoom).toBe(0.5)
    expect(worldToScreen(vp, { x: 1000, y: 500 })).toEqual({ x: 500, y: 400 })
  })
  it('does not zoom in past maxZoom', () => {
    expect(fitViewport({ x: 0, y: 0, w: 10, h: 10 }, { w: 1000, h: 800 }).zoom).toBe(1)
  })
})

describe('resizeBox', () => {
  const base = { axis: 'xy' as const, aspect: false, minW: 80, minH: 48, snap: true }
  it('snaps and clamps to min', () => {
    expect(resizeBox({ w: 160, h: 96 }, { dx: 13, dy: -100 }, base)).toEqual({ w: 176, h: 48 })
  })
  it('alt disables snap', () => {
    expect(resizeBox({ w: 160, h: 96 }, { dx: 13, dy: 0 }, { ...base, snap: false })).toEqual({ w: 173, h: 96 })
  })
  it('x axis leaves height', () => {
    expect(resizeBox({ w: 160, h: 96 }, { dx: 40, dy: 40 }, { ...base, axis: 'x' })).toEqual({ w: 200, h: 96 })
  })
  it('keeps aspect ratio', () => {
    expect(resizeBox({ w: 200, h: 100 }, { dx: 40, dy: 0 }, { ...base, aspect: true })).toEqual({ w: 240, h: 120 })
  })
  it('aspect respects min height', () => {
    const r = resizeBox({ w: 200, h: 100 }, { dx: -500, dy: 0 }, { ...base, aspect: true, minW: 10, minH: 50 })
    expect(r).toEqual({ w: 100, h: 50 })
  })
})
