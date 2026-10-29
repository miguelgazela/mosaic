import { expect, test, type Page } from '@playwright/test'

// P3 flows on the auth-free dev board (boards live in memory): /dev/board/<id>.

async function canvasBox(page: Page) {
  return (await page.getByTestId('canvas').boundingBox())!
}

async function newNote(page: Page, at: { x: number; y: number }, text: string) {
  const c = await canvasBox(page)
  await page.mouse.dblclick(c.x + at.x, c.y + at.y)
  const editor = page.getByRole('textbox', { name: 'Note text' })
  await expect(editor).toBeFocused()
  await page.keyboard.type(text)
  await page.keyboard.press('Escape')
  await expect(editor).toHaveCount(0)
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 })
  await page.mouse.move(to.x, to.y, { steps: 6 })
  await page.mouse.up()
}

const center = async (loc: ReturnType<Page['locator']>) => {
  const b = (await loc.boundingBox())!
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

test('a column of notes inside a child board', async ({ page }) => {
  await page.goto('/dev/board/root')
  await expect(page.getByTestId('canvas')).toBeVisible()

  // Board card: B creates it and opens the name field.
  await page.keyboard.press('b')
  await page.getByRole('textbox', { name: 'Board name' }).fill('Shot list')
  await page.keyboard.press('Enter')
  const boardCard = page.getByTestId('board-card')
  await expect(boardCard).toContainText('Shot list')
  await expect(boardCard).toContainText('Empty')

  // Click opens the child board.
  await boardCard.click()
  await expect(page).toHaveURL(/\/dev\/board\/(?!root)[0-9a-f-]{36}/)
  await expect(page.getByRole('button', { name: 'Shot list' })).toBeVisible()
  await expect(page.locator('[data-card-id]')).toHaveCount(0)

  // Column: C creates it and opens the title field.
  await page.keyboard.press('c')
  await page.getByRole('textbox', { name: 'Column title' }).fill('Scenes')
  await page.keyboard.press('Enter')
  const column = page.locator('[data-card-id]').filter({ has: page.getByTestId('column-card') })
  await expect(column).toContainText('Scenes')
  await expect(column.getByTestId('column-count')).toHaveText('0')

  // Two notes made by double-clicking empty canvas.
  await newNote(page, { x: 1000, y: 100 }, 'Wide, table set')
  await newNote(page, { x: 1000, y: 220 }, 'Mid, pouring tea')
  const notes = page.getByTestId('note-card')
  await expect(notes).toHaveCount(2)

  // Drag both into the column; the insert line shows while hovering.
  const first = notes.filter({ hasText: 'Wide, table set' })
  const second = notes.filter({ hasText: 'Mid, pouring tea' })
  const colBox = (await column.boundingBox())!
  await drag(page, await center(first), { x: colBox.x + colBox.width / 2, y: colBox.y + 90 })
  await expect(column.getByTestId('column-count')).toHaveText('1')
  const mid = await center(second)
  const after = (await column.boundingBox())!
  await page.mouse.move(mid.x, mid.y)
  await page.mouse.down()
  await page.mouse.move(after.x + after.width / 2, after.y + 60, { steps: 6 })
  await expect(page.getByTestId('insert-line')).toBeVisible()
  await page.mouse.move(after.x + after.width / 2, after.y + after.height - 6, { steps: 4 })
  await page.mouse.up()
  await expect(column.getByTestId('column-count')).toHaveText('2')

  const columnId = (await column.getAttribute('data-card-id'))!
  const kids = page.locator(`[data-parent="${columnId}"]`)
  await expect(kids).toHaveCount(2)
  await expect(kids.nth(0)).toContainText('Wide, table set')
  await expect(kids.nth(1)).toContainText('Mid, pouring tea')

  // Undo puts the last note back on the canvas, redo returns it.
  await page.getByTestId('canvas').click({ position: { x: 700, y: 560 } })
  await page.keyboard.press('Control+z')
  await expect(column.getByTestId('column-count')).toHaveText('1')
  await page.keyboard.press('Control+Shift+z')
  await expect(column.getByTestId('column-count')).toHaveText('2')

  // Move into column… (menu alternative to dragging).
  await newNote(page, { x: 1000, y: 450 }, 'Close, hands')
  const third = notes.filter({ hasText: 'Close, hands' })
  await third.click({ button: 'right' })
  await page.getByRole('menuitem', { name: /Move into column/ }).click()
  await page.getByRole('menuitem', { name: 'Scenes' }).click()
  await expect(column.getByTestId('column-count')).toHaveText('3')
  await expect(page.locator(`[data-parent="${columnId}"]`).nth(2)).toContainText('Close, hands')

  // Collapse hides the stack and shows the count.
  await column.getByRole('button', { name: 'Collapse column' }).click()
  await expect(column).toContainText('3 cards')
  await expect(page.getByTestId('note-card')).toHaveCount(0)
})

test('pasting plain text makes a note', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/dev/board/paste')
  await expect(page.getByTestId('canvas')).toBeVisible()
  await page.evaluate(() => {
    const dt = new DataTransfer()
    dt.setData('text/plain', 'Call the studio\nabout parking')
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }))
  })
  const note = page.getByTestId('note-card')
  await expect(note).toHaveCount(1)
  await expect(note).toContainText('Call the studio')
  await expect(note).toContainText('about parking')
})

test('swatch copies its hex with a Copied state', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/dev/board/swatch')
  await page.getByRole('button', { name: 'Add colour' }).click()
  await page.getByRole('textbox', { name: 'Hex' }).fill('#3e5c50')
  await page.getByRole('textbox', { name: 'Name' }).fill('Pine')
  await page.getByRole('button', { name: 'Done' }).click()
  const swatch = page.getByTestId('swatch-card')
  await expect(swatch).toContainText('Pine')
  await expect(swatch).toContainText('#3E5C50')
  await swatch.click()
  await expect(swatch.getByRole('status')).toHaveText(/Copied/)
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('#3E5C50')
  await expect(swatch.getByRole('status')).toHaveCount(0, { timeout: 3000 })
})

test('Home shows the onboarding card until dismissed', async ({ page }) => {
  await page.goto('/dev/board/home?home=1')
  await expect(page.getByTestId('home-onboarding')).toContainText('This is your Home board')
  await expect(page.getByTestId('recent-strip')).toBeVisible()
  await page.getByRole('button', { name: 'Dismiss' }).click()
  await expect(page.getByTestId('home-onboarding')).toHaveCount(0)
  await page.getByRole('button', { name: 'Add colour' }).click()
  // The Recent strip stays on a populated Home (03-home-populated); only the onboarding card goes.
  await expect(page.getByTestId('recent-strip')).toHaveCount(1)
})
