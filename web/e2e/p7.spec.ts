import { expect, test, type Page } from '@playwright/test'

// P7 flows on the auth-free dev board (boards live in memory): /dev/board/<id>.

type P = { x: number; y: number }

async function canvasBox(page: Page) {
  return (await page.getByTestId('canvas').boundingBox())!
}

async function newNote(page: Page, at: P, text: string) {
  const c = await canvasBox(page)
  await page.mouse.dblclick(c.x + at.x, c.y + at.y)
  const editor = page.getByRole('textbox', { name: 'Note text' })
  await expect(editor).toBeFocused()
  await page.keyboard.type(text)
  await page.keyboard.press('Escape')
  await expect(editor).toHaveCount(0)
  await page.keyboard.press('Escape')
}

async function drag(page: Page, from: P, to: P) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 })
  await page.mouse.move(to.x, to.y, { steps: 6 })
  await page.mouse.up()
}

const card = (page: Page, text: string) =>
  page.getByTestId('note-card').filter({ hasText: text }).locator('xpath=ancestor::*[@data-card-id][1]')
const center = async (loc: ReturnType<Page['locator']>) => {
  const b = (await loc.boundingBox())!
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}
const lines = (page: Page) => page.getByTestId('connection')
const pathD = (page: Page) => page.getByTestId('connection').locator('path').nth(1).getAttribute('d')

async function twoNotes(page: Page) {
  await page.goto('/dev/board/lines')
  await expect(page.getByTestId('canvas')).toBeVisible()
  await newNote(page, { x: 200, y: 200 }, 'Brief')
  await newNote(page, { x: 640, y: 320 }, 'Shot list')
  await expect(page.locator('[data-card-id]')).toHaveCount(2)
}

test('draw a line from an edge handle, move a card, undo', async ({ page }) => {
  await twoNotes(page)
  const a = card(page, 'Brief')
  const b = card(page, 'Shot list')

  // Hover shows the edge handles; drag the right one onto the other note.
  await a.hover()
  const handle = a.locator('[data-edge-handle="right"]')
  await expect(handle).toBeVisible()
  const from = await center(handle)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + 120, from.y + 40, { steps: 5 })
  await expect(page.getByTestId('connection-preview')).toBeVisible()
  const target = await center(b)
  await page.mouse.move(target.x, target.y, { steps: 8 })
  await expect(page.getByTestId('connection-snap')).toBeVisible()
  await page.mouse.up()

  await expect(lines(page)).toHaveCount(1)
  await expect(lines(page)).toHaveAttribute('data-selected', 'true')
  await expect(page.getByTestId('connection-popover')).toBeVisible()
  const d0 = await pathD(page)

  // Moving the target note drags the line's end along.
  await page.keyboard.press('Escape')
  const bc = await center(b)
  await drag(page, { x: bc.x, y: bc.y + 10 }, { x: bc.x + 80, y: bc.y + 120 })
  const d1 = await pathD(page)
  expect(d1).not.toBe(d0)

  // Undo: the move first, then the line.
  await page.keyboard.press('ControlOrMeta+z')
  expect(await pathD(page)).toBe(d0)
  await page.keyboard.press('ControlOrMeta+z')
  await expect(lines(page)).toHaveCount(0)
})

test('line tool, style popover, label, delete', async ({ page }) => {
  await twoNotes(page)
  const a = card(page, 'Brief')
  const b = card(page, 'Shot list')

  await page.keyboard.press('l')
  await expect(page.getByRole('button', { name: 'Draw a line' })).toHaveAttribute('aria-pressed', 'true')
  await drag(page, await center(a), await center(b))
  await expect(lines(page)).toHaveCount(1)
  // The tool returns to Select after one line.
  await expect(page.getByRole('button', { name: 'Select' })).toHaveAttribute('aria-pressed', 'true')

  const pop = page.getByTestId('connection-popover')
  await pop.getByRole('radio', { name: 'Curved' }).click()
  await pop.getByRole('radio', { name: 'Dashed' }).click()
  await pop.getByRole('radio', { name: 'Arrowheads at both ends' }).click()
  await pop.getByRole('radio', { name: 'Violet' }).click()
  const visible = lines(page).locator('path').nth(1)
  await expect(visible).toHaveAttribute('stroke', '#7C3AED')
  await expect(visible).toHaveAttribute('stroke-dasharray', /\d/)
  await expect(lines(page).locator('polygon')).toHaveCount(2)
  expect(await pathD(page)).toContain('Q')

  await pop.getByRole('button', { name: 'Label' }).click()
  await page.getByRole('textbox', { name: 'Line label' }).fill('then')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('connection-label')).toHaveText('then')

  // Bend handle reshapes the curve.
  const d0 = await pathD(page)
  const bend = await center(page.getByTestId('bend-handle'))
  await drag(page, bend, { x: bend.x, y: bend.y - 80 })
  expect(await pathD(page)).not.toBe(d0)

  // Delete + undo.
  await page.keyboard.press('Delete')
  await expect(lines(page)).toHaveCount(0)
  await page.keyboard.press('ControlOrMeta+z')
  await expect(lines(page)).toHaveCount(1)
})

test('drag a line end onto another card and off again; thin lines are clickable; duplicate carries lines', async ({ page }) => {
  await twoNotes(page)
  await newNote(page, { x: 200, y: 520 }, 'Third')
  const a = card(page, 'Brief')
  const b = card(page, 'Shot list')

  await page.keyboard.press('l')
  await drag(page, await center(a), await center(b))
  await expect(lines(page)).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(lines(page)).toHaveAttribute('data-selected', 'false')

  // A thin line is clickable a few px off its centre.
  const hit = lines(page).getByTestId('connection-hit')
  const box = (await hit.boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2 + 3)
  await expect(lines(page)).toHaveAttribute('data-selected', 'true')

  const dStart = await pathD(page)
  // Re-attach the end to the third card, then detach it onto empty canvas.
  const end = await center(page.getByTestId('end-handle-to'))
  await drag(page, end, await center(card(page, 'Third')))
  await expect(page.getByTestId('end-handle-to')).toBeVisible()
  const dAttached = await pathD(page)
  expect(dAttached).not.toBe(dStart)
  const end2 = await center(page.getByTestId('end-handle-to'))
  const c = await canvasBox(page)
  await drag(page, end2, { x: c.x + 900, y: c.y + 120 })
  await expect(lines(page)).toHaveCount(1)
  expect(await pathD(page)).not.toBe(dAttached)
  // Undo puts the end back on the third card.
  await page.keyboard.press('ControlOrMeta+z')
  expect(await pathD(page)).toBe(dAttached)
  await page.keyboard.press('ControlOrMeta+y')

  // Duplicate Brief + Shot list: the line between them is copied only when both are selected.
  await page.keyboard.press('Escape')
  await page.keyboard.press('Control+a')
  await page.keyboard.press('Control+d')
  await expect(lines(page)).toHaveCount(2)
})

test('a line from a card inside a column follows the column layout', async ({ page }) => {
  await page.goto('/dev/board/columns')
  await expect(page.getByTestId('canvas')).toBeVisible()
  await page.keyboard.press('c')
  await page.getByRole('textbox', { name: 'Column title' }).fill('Scenes')
  await page.keyboard.press('Enter')
  const column = page.locator('[data-card-id]').filter({ has: page.getByTestId('column-card') })
  await newNote(page, { x: 1000, y: 100 }, 'First')
  await newNote(page, { x: 1000, y: 220 }, 'Second')
  await newNote(page, { x: 700, y: 640 }, 'Target')
  const notes = page.getByTestId('note-card')
  for (const t of ['First', 'Second']) {
    const colBox = (await column.boundingBox())!
    await drag(page, await center(notes.filter({ hasText: t })), { x: colBox.x + colBox.width / 2, y: colBox.y + colBox.height - 10 })
  }
  await expect(column.getByTestId('column-count')).toHaveText('2')
  const second = card(page, 'Second')

  await page.keyboard.press('l')
  await drag(page, await center(second), await center(card(page, 'Target')))
  await expect(lines(page)).toHaveCount(1)
  await page.keyboard.press('Escape')

  // Screen position of where the line leaves its first card (path start, through the layer's transform).
  const start = () =>
    page.evaluate(() => {
      const svg = document.querySelector('[data-testid="connections-layer"]') as SVGSVGElement
      const d = svg.querySelector('[data-testid="connection"] path:nth-of-type(2)')!.getAttribute('d')!
      const [x, y] = d.slice(1).split(/[LQ]/)[0].split(' ').map(Number)
      const m = svg.getScreenCTM()!
      return { x: m.a * x + m.e, y: m.d * y + m.f }
    })
  const startY = async () => (await start()).y
  const nearCardEdge = async () => {
    const cb = (await second.boundingBox())!
    const p = await start()
    const onX = p.x >= cb.x - 2 && p.x <= cb.x + cb.width + 2
    const onY = p.y >= cb.y - 2 && p.y <= cb.y + cb.height + 2
    const onEdge = (onY && (Math.abs(p.x - cb.x) < 2 || Math.abs(p.x - (cb.x + cb.width)) < 2)) || (onX && (Math.abs(p.y - cb.y) < 2 || Math.abs(p.y - (cb.y + cb.height)) < 2))
    return onEdge ? 'on edge' : `start ${JSON.stringify(p)} vs card ${JSON.stringify(cb)}`
  }
  await expect.poll(nearCardEdge).toBe('on edge')

  // Take the first card out: the second moves up inside the column and the line follows.
  const before = await startY()
  await drag(page, await center(card(page, 'First')), { x: 1200, y: 700 })
  await expect.poll(startY).not.toBe(before)
  await expect.poll(nearCardEdge).toBe('on edge')

  // Moving the whole column carries the line too.
  const before2 = await startY()
  const head = (await column.boundingBox())!
  await drag(page, { x: head.x + 40, y: head.y + 12 }, { x: head.x + 40, y: head.y + 112 })
  await expect.poll(startY).not.toBe(before2)
  await expect.poll(nearCardEdge).toBe('on edge')
})
