import zlib from 'node:zlib'
import { readFile } from 'node:fs/promises'
import JSZip from 'jszip'
import { expect, test, type Page } from '@playwright/test'

// P11: export menu on the auth-free dev board. Downloads are real files (PNG, PDF, zip).

async function setup(page: Page) {
  await page.goto('/dev/board/p11-export')
  const c = (await page.getByTestId('canvas').boundingBox())!
  for (const [x, y, text] of [[200, 200, 'Brief'], [640, 320, 'Shot list']] as const) {
    await page.mouse.dblclick(c.x + x, c.y + y)
    const editor = page.getByRole('textbox', { name: 'Note text' })
    await expect(editor).toBeFocused()
    await page.keyboard.type(text)
    await page.keyboard.press('Escape')
    await expect(editor).toHaveCount(0)
    await page.keyboard.press('Escape')
  }
  const a = page.getByTestId('note-card').filter({ hasText: 'Brief' }).locator('xpath=ancestor::*[@data-card-id][1]')
  await a.hover()
  const h = (await a.locator('[data-edge-handle="right"]').boundingBox())!
  const b = (await page.getByTestId('note-card').filter({ hasText: 'Shot list' }).boundingBox())!
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 })
  await page.mouse.up()
  await expect(page.getByTestId('connection')).toHaveCount(1)
  await page.keyboard.press('Escape')
}

async function exportAs(page: Page, item: string) {
  await page.getByRole('button', { name: 'Board menu' }).click()
  await page.getByRole('menuitem', { name: 'Export' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: item }).click()
  const d = await download
  await expect(page.getByText(/Export ready/)).toBeVisible()
  return { name: d.suggestedFilename(), data: await readFile((await d.path())!) }
}

test('PNG export of the whole board is a real image', async ({ page }) => {
  await setup(page)
  const { name, data } = await exportAs(page, 'PNG, whole board')
  expect(name).toMatch(/\.png$/)
  expect(data.subarray(1, 4).toString()).toBe('PNG')
  expect(data.length).toBeGreaterThan(3000)
  // Decode it in the page: wider than the cards, and it contains the line colour (graphite) between the notes.
  const b64 = data.toString('base64')
  const info = await page.evaluate(async (src) => {
    const img = new Image()
    img.src = `data:image/png;base64,${src}`
    await img.decode()
    return { w: img.naturalWidth, h: img.naturalHeight }
  }, b64)
  expect(info.w).toBeGreaterThan(400)
  expect(info.h).toBeGreaterThan(150)
})

test('PDF and current-view PNG download', async ({ page }) => {
  await setup(page)
  const pdf = await exportAs(page, 'PDF')
  expect(pdf.name).toMatch(/\.pdf$/)
  expect(pdf.data.subarray(0, 4).toString()).toBe('%PDF')
  const png = await exportAs(page, 'PNG, current view')
  expect(png.data.subarray(1, 4).toString()).toBe('PNG')
})

test('Markdown zip holds the notes', async ({ page }) => {
  await setup(page)
  await expect(page.getByRole('button', { name: 'Board menu' })).toBeVisible()
  const { name, data } = await exportAs(page, 'Markdown (.zip)')
  expect(name).toMatch(/\.zip$/)
  const zip = await JSZip.loadAsync(data)
  const md = Object.keys(zip.files).filter((f) => f.endsWith('.md'))
  expect(md).toHaveLength(1)
  const text = await zip.file(md[0])!.async('string')
  expect(text).toContain('Brief')
  expect(text).toContain('Shot list')
})

test('Cancel stops an export', async ({ page }) => {
  await setup(page)
  await page.getByRole('button', { name: 'Board menu' }).click()
  await page.getByRole('menuitem', { name: 'Export' }).click()
  await page.getByRole('menuitem', { name: 'PDF' }).click()
  const cancel = page.getByTestId('export-progress').getByRole('button', { name: 'Cancel' })
  if (await cancel.isVisible().catch(() => false)) await cancel.click()
  await expect(page.getByTestId('export-progress')).toHaveCount(0)
})

// Image cards: storage is mocked (as in p4); the signed GET serves a solid red PNG, so the export must contain red pixels
// and the zip must carry the file under assets/.
function redPng(): Buffer {
  const w = 8
  const h = 8
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = 255 }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type), data])
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(body))
    return Buffer.concat([len, body, crc])
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

test('images are in the PNG and in the zip', async ({ page }) => {
  const png = redPng()
  await page.route('**/storage/v1/object/milanote-files/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"Key":"ok"}' }))
  await page.route('**/storage/v1/object/sign/milanote-files**', async (route) => {
    const body = route.request().postDataJSON() as { paths?: string[] }
    const paths = body.paths ?? []
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(paths.map((p) => ({ path: p, error: null, signedURL: `/object/sign/milanote-files/${p}?token=t` }))),
    })
  })
  await page.route('**/storage/v1/object/sign/milanote-files/**?token=*', (route) =>
    route.request().method() === 'GET' ? route.fulfill({ contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: png }) : route.fallback(),
  )
  await page.goto('/dev/board/p11-img')
  const box = (await page.getByTestId('canvas').boundingBox())!
  await page.evaluate(async ({ x, y }) => {
    const dt = new DataTransfer()
    const c = document.createElement('canvas')
    c.width = 600; c.height = 400
    const g = c.getContext('2d')!; g.fillStyle = '#ff0000'; g.fillRect(0, 0, 600, 400)
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'))
    dt.items.add(new File([blob], 'red.png', { type: 'image/png' }))
    document.querySelector('[data-testid="canvas"]')!.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }))
  }, { x: box.x + 300, y: box.y + 250 })
  await expect(page.getByTestId('image-card')).toHaveAttribute('data-state', 'ready')
  // Scroll the card out of view and zoom out, as a worst case for lazy loading.
  await page.keyboard.press('Escape')

  const out = await exportAs(page, 'PNG, whole board')
  const red = await page.evaluate(async (b64) => {
    const img = new Image()
    img.src = `data:image/png;base64,${b64}`
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.naturalWidth; c.height = img.naturalHeight
    const ctx = c.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    let n = 0
    for (let i = 0; i < d.length; i += 4) if (d[i] > 240 && d[i + 1] < 20 && d[i + 2] < 20) n++
    return n
  }, out.data.toString('base64'))
  expect(red).toBeGreaterThan(1000)

  const z = await JSZip.loadAsync((await exportAs(page, 'Markdown (.zip)')).data)
  const names = Object.keys(z.files)
  expect(names.some((n) => n.startsWith('assets/') && n.endsWith('red.png'))).toBe(true)
  const md = await z.file(names.find((n) => n.endsWith('.md'))!)!.async('string')
  expect(md).toMatch(/!\[red\.png\]\(assets\/[^)]*red\.png\)/)
})
