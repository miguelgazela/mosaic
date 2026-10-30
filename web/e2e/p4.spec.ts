import { expect, test, type Page } from '@playwright/test'

// P4 flows on the auth-free dev board. Storage calls are mocked at the network layer.

const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

interface Mock { uploads: string[]; failNext: number }

async function mockStorage(page: Page): Promise<Mock> {
  const mock: Mock = { uploads: [], failNext: 0 }
  await page.route('**/storage/v1/object/milanote-files/**', async (route) => {
    const url = new URL(route.request().url())
    if (route.request().method() === 'POST') {
      if (mock.failNext > 0) { mock.failNext--; return route.abort('connectionreset') }
      mock.uploads.push(decodeURIComponent(url.pathname.split('/milanote-files/')[1]))
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"Key":"ok"}' })
    }
    return route.fulfill({ status: 200 })
  })
  await page.route('**/storage/v1/object/sign/milanote-files**', async (route) => {
    const req = route.request()
    const path = new URL(req.url()).pathname.split('/sign/milanote-files')[1]?.replace(/^\//, '')
    const body = req.postDataJSON() as { paths?: string[] }
    if (body.paths) {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(body.paths.map((p) => ({ path: p, error: null, signedURL: `/object/sign/milanote-files/${p}?token=t` }))),
      })
    }
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ signedURL: `/object/sign/milanote-files/${path}?token=t` }) })
  })
  await page.route('**/storage/v1/object/sign/milanote-files/**?token=*', (route) =>
    route.request().method() === 'GET' ? route.fulfill({ contentType: 'image/png', body: PNG_1X1 }) : route.fallback(),
  )
  return mock
}

/** Dispatch a file drop on the canvas, like dragging from the desktop. */
async function dropFiles(page: Page, files: Array<{ name: string; type: string; bytes?: number; image?: boolean }>, at = { x: 300, y: 250 }) {
  const box = (await page.getByTestId('canvas').boundingBox())!
  await page.evaluate(async ({ files, x, y }) => {
    const dt = new DataTransfer()
    for (const f of files) {
      if (f.image) {
        const c = document.createElement('canvas')
        c.width = 600
        c.height = 400
        const ctx = c.getContext('2d')!
        ctx.fillStyle = '#c8d1bf'
        ctx.fillRect(0, 0, 600, 400)
        const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), f.type))
        dt.items.add(new File([blob], f.name, { type: f.type }))
      } else {
        dt.items.add(new File([new Uint8Array(f.bytes ?? 10)], f.name, { type: f.type }))
      }
    }
    const target = document.querySelector('[data-testid="canvas"]')!
    const opts = { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }
    target.dispatchEvent(new DragEvent('dragover', opts))
    await new Promise((r) => setTimeout(r, 50))
    ;(window as unknown as { __dropSeen: boolean }).__dropSeen = !!document.querySelector('[data-testid="drop-zone"]')
    target.dispatchEvent(new DragEvent('drop', opts))
  }, { files, x: box.x + at.x, y: box.y + at.y })
}

test('dropping an image shows the drop zone, uploads under {uid}/{id}/ and opens in the lightbox', async ({ page }) => {
  const mock = await mockStorage(page)
  await page.goto('/dev/board/p4a')
  await expect(page.getByTestId('canvas')).toBeVisible()

  await dropFiles(page, [{ name: 'IMG_2041.png', type: 'image/png', image: true }])
  expect(await page.evaluate(() => (window as unknown as { __dropSeen: boolean }).__dropSeen)).toBe(true)
  await expect(page.getByTestId('drop-zone')).toHaveCount(0)

  const card = page.getByTestId('image-card')
  await expect(card).toHaveAttribute('data-state', 'ready')
  await expect.poll(() => mock.uploads.length).toBe(2)
  const id = (await page.locator('[data-card-id]').first().getAttribute('data-card-id'))!
  expect(mock.uploads).toContain(`dev-user/${id}/original.png`)
  expect(mock.uploads).toContain(`dev-user/${id}/thumb.webp`)
  // P14: a just-uploaded image shows the full image (600 px wide), not the 512 px thumb.
  await expect.poll(() => card.locator('img').evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(600)
  // 600 × 400 fits 280 × 360 → 280 × 187 (3:2).
  const box = (await card.boundingBox())!
  expect(Math.abs(box.width / box.height - 1.5)).toBeLessThan(0.02)

  // Caption: Enter edits the selected card.
  await card.click()
  await page.keyboard.press('Enter')
  await page.getByRole('textbox', { name: 'Caption' }).fill('Studio test, natural light')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('image-caption')).toHaveText('Studio test, natural light')

  await card.dblclick()
  const lb = page.getByTestId('lightbox')
  await expect(lb).toContainText('1 of 1 images on')
  await expect(lb).toContainText('IMG_2041.png, 600 × 400')
  await expect(lb.getByRole('button', { name: 'Download original' })).toBeEnabled()
  await page.keyboard.press('Escape')
  await expect(lb).toHaveCount(0)
})

test('a failed upload shows the failed state and Retry finishes it', async ({ page }) => {
  const mock = await mockStorage(page)
  mock.failNext = 1
  await page.goto('/dev/board/p4b')
  await dropFiles(page, [{ name: 'IMG_2041.png', type: 'image/png', image: true }])

  const card = page.getByTestId('image-card')
  await expect(card).toHaveAttribute('data-state', 'failed')
  await expect(card).toContainText('Upload failed')
  await expect(page.getByRole('status').filter({ hasText: 'Couldn’t upload IMG_2041.png' })).toBeVisible()

  await card.getByRole('button', { name: 'Retry upload' }).click()
  await expect(card).toHaveAttribute('data-state', 'ready')
  expect(mock.uploads.some((p) => p.endsWith('/original.png'))).toBe(true)
})

test('files: Upload button makes a file card; over 10 MB fails without retry', async ({ page }) => {
  const mock = await mockStorage(page)
  await page.goto('/dev/board/p4c')
  await page.getByTestId('upload-input').setInputFiles({ name: 'Call sheet.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(220 * 1024) })
  const files = page.getByTestId('file-card')
  await expect(files).toHaveCount(1)
  await expect(files.first()).toHaveAttribute('data-state', 'ready')
  await expect(files.first()).toContainText('Call sheet.pdf')
  await expect(files.first()).toContainText('220 KB')
  expect(mock.uploads.some((p) => p.endsWith('/original.pdf'))).toBe(true)

  await dropFiles(page, [{ name: 'Raw selects.zip', type: 'application/zip', bytes: 11 * 1024 * 1024 }], { x: 300, y: 450 })
  const big = files.nth(1)
  await expect(big).toHaveAttribute('data-state', 'failed')
  await expect(big).toContainText('Too large (11 MB). The limit is 10 MB.')
  await expect(big.getByRole('button', { name: 'Retry' })).toHaveCount(0)
})

function tinyPdf(pages: number): Buffer {
  const objs: string[] = []
  const kids = Array.from({ length: pages }, (_, i) => `${3 + i} 0 R`).join(' ')
  objs.push('<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${kids}] /Count ${pages} >>`)
  for (let i = 0; i < pages; i++) objs.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>')
  let out = '%PDF-1.4\n'
  const offs: number[] = []
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n` })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(out)
}

test('a PDF gets a first-page preview and a page count', async ({ page }) => {
  const mock = await mockStorage(page)
  await page.goto('/dev/board/p13pdf')
  await page.getByTestId('upload-input').setInputFiles({ name: 'Call sheet.pdf', mimeType: 'application/pdf', buffer: tinyPdf(2) })
  const card = page.getByTestId('file-card')
  await expect(card).toHaveAttribute('data-state', 'ready')
  await expect.poll(() => mock.uploads.some((p) => p.endsWith('/preview.jpg')), { timeout: 15000 }).toBe(true)
  await expect(card.getByTestId('file-preview')).toBeVisible()
  await expect(card).toContainText('2 pages')
})

test('selected image: ring and size badge include the caption; lightbox is capped at 960 px; drop zone lets cards show', async ({ page }) => {
  await mockStorage(page)
  await page.goto('/dev/board/p13img')
  await dropFiles(page, [{ name: 'IMG_2041.png', type: 'image/png', image: true }])
  const card = page.getByTestId('image-card')
  await expect(card).toHaveAttribute('data-state', 'ready')
  await card.click()
  await page.keyboard.press('Enter')
  await page.getByRole('textbox', { name: 'Caption' }).fill('Studio test, natural light')
  await page.keyboard.press('Enter')
  await page.getByTestId('canvas').click({ position: { x: 700, y: 500 } })
  await card.click()
  await expect(page.getByTestId('size-badge')).toHaveText(/^\d+ × \d+$/)
  const ring = (await page.getByTestId('image-ring').boundingBox())!
  const cap = (await page.getByTestId('image-caption').boundingBox())!
  expect(ring.y + ring.height).toBeGreaterThanOrEqual(cap.y + cap.height - 1)

  await page.setViewportSize({ width: 1800, height: 1400 })
  await card.dblclick()
  const img = (await page.getByTestId('lightbox-image').boundingBox())!
  expect(Math.max(img.width, img.height)).toBeLessThanOrEqual(961)
  await page.keyboard.press('Escape')

  // Drop zone is a translucent tint: a card under it is still painted (not dimmed to nothing).
  await page.evaluate(() => {
    const dt = new DataTransfer()
    dt.items.add(new File([new Uint8Array(4)], 'a.zip', { type: 'application/zip' }))
    const c = document.querySelector('[data-testid="canvas"]')!
    const r = c.getBoundingClientRect()
    c.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.left + 50, clientY: r.top + 50 }))
  })
  const alpha = await page.getByTestId('drop-zone').evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(alpha).toMatch(/0\.[3-8]/)
})
