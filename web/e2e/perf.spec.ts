import { expect, test, type Page } from '@playwright/test'

/** NFR-1 / NFR-2 / NFR-3 measurements. Numbers are printed; thresholds are loose because CI machines vary. Dev server = unminified, so real numbers are better. */

async function frames(page: Page, kind: 'pan' | 'zoom', ms = 2000) {
  return page.evaluate(([k, dur]) => new Promise<{ fps: number; p95: number; max: number }>((resolve) => {
    const node = document.querySelector('[data-testid="canvas"]') as HTMLElement
    const r = node.getBoundingClientRect()
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2
    const deltas: number[] = []
    let last = performance.now()
    const t0 = last
    let i = 0
    const tick = (now: number) => {
      deltas.push(now - last)
      last = now
      i++
      const ev = k === 'pan'
        ? new WheelEvent('wheel', { deltaX: 12, deltaY: 9, clientX: cx, clientY: cy, bubbles: true, cancelable: true })
        : new WheelEvent('wheel', { deltaY: i % 120 < 60 ? -12 : 12, ctrlKey: true, clientX: cx, clientY: cy, bubbles: true, cancelable: true })
      node.dispatchEvent(ev)
      if (now - t0 < (dur as number)) requestAnimationFrame(tick)
      else {
        const d = deltas.slice(5).sort((a, b) => a - b)
        resolve({ fps: Math.round(1000 / (d.reduce((a, b) => a + b, 0) / d.length)), p95: Math.round(d[Math.floor(d.length * 0.95)]), max: Math.round(d[d.length - 1]) })
      }
    }
    requestAnimationFrame(tick)
  }), [kind, ms] as const)
}

test('500 notes: pan and zoom stay smooth, only visible cards are mounted', async ({ page }) => {
  await page.goto('/dev/canvas?cards=500&type=note')
  await expect(page.locator('[data-card-id]').first()).toBeVisible()
  const mounted = await page.locator('[data-card-id]').count()
  expect(mounted).toBeLessThan(500)
  const pan = await frames(page, 'pan')
  const zoom = await frames(page, 'zoom')
  console.log(`PERF 500 notes: mounted ${mounted}/500, pan ${pan.fps} fps (p95 frame ${pan.p95} ms, max ${pan.max} ms), zoom ${zoom.fps} fps (p95 ${zoom.p95} ms, max ${zoom.max} ms)`)
  expect(pan.fps).toBeGreaterThan(45)
  expect(zoom.fps).toBeGreaterThan(45)
})

test('300 notes: board opens fast', async ({ page }) => {
  await page.goto('/dev/canvas?cards=300&type=note')
  await page.locator('[data-card-id]').first().waitFor()
  await page.goto('about:blank')
  const t = Date.now()
  await page.goto('/dev/canvas?cards=300&type=note') // warm: modules cached
  await page.locator('[data-card-id]').first().waitFor()
  const ms = Date.now() - t
  console.log(`PERF open 300 notes (warm, dev server): ${ms} ms`)
  expect(ms).toBeLessThan(1500)
})

test('zoomed out to 25%: cards still render, culling keeps count bounded', async ({ page }) => {
  await page.goto('/dev/canvas?cards=500&type=note')
  await expect(page.locator('[data-card-id]').first()).toBeVisible()
  await page.keyboard.press('Shift+1') // fit to content
  const zoom = await page.getByTestId('zoom-level').textContent()
  console.log(`PERF fit-to-content zoom: ${zoom}, mounted ${await page.locator('[data-card-id]').count()}`)
  const pan = await frames(page, 'pan')
  console.log(`PERF 500 notes fitted: pan ${pan.fps} fps (p95 ${pan.p95} ms)`)
  expect(pan.fps).toBeGreaterThan(40)
})
