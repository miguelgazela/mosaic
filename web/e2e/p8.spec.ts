import { expect, test, type Page } from '@playwright/test'

// P8 flows on the auth-free dev board: boards, cards and lines live in an in-memory database (DevDb).

type P = { x: number; y: number }

const canvasBox = async (page: Page) => (await page.getByTestId('canvas').boundingBox())!

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

async function newBoard(page: Page, name: string) {
  await expect(page.getByTestId('canvas')).toBeVisible()
  await page.keyboard.press('b')
  await page.getByRole('textbox', { name: 'Board name' }).fill(name)
  await page.keyboard.press('Enter')
}

async function drag(page: Page, from: P, to: P) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 })
  await page.mouse.move(to.x, to.y, { steps: 6 })
  await page.mouse.up()
}

const note = (page: Page, text: string) => page.getByTestId('note-card').filter({ hasText: text }).locator('xpath=ancestor::*[@data-card-id][1]')
const center = async (loc: ReturnType<Page['locator']>) => {
  const b = (await loc.boundingBox())!
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}
const toast = (page: Page) => page.locator('[aria-live="polite"]')
const crumbHome = (page: Page) => page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Home' })
const lines = (page: Page) => page.getByTestId('connection')

async function connect(page: Page, a: string, b: string) {
  await note(page, a).hover()
  const h = await center(note(page, a).locator('[data-edge-handle="right"]'))
  await page.mouse.move(h.x, h.y)
  await page.mouse.down()
  const to = await center(note(page, b))
  await page.mouse.move(to.x, to.y, { steps: 8 })
  await page.mouse.up()
  await expect(lines(page)).toHaveCount(1)
  await page.keyboard.press('Escape')
}

test('drop a note on a board card: moved, toast with Undo, arrow to a card left behind goes and comes back', async ({ page }) => {
  await page.goto('/dev/board/p8-move')
  await expect(page.getByTestId('canvas')).toBeVisible()
  await newBoard(page, 'Ideas')
  await newNote(page, { x: 300, y: 450 }, 'Brief')
  await newNote(page, { x: 700, y: 450 }, 'Shot list')
  await connect(page, 'Brief', 'Shot list')

  await drag(page, await center(note(page, 'Brief')), await center(page.getByTestId('board-card')))
  await expect(toast(page)).toContainText('Moved 1 card to Ideas')
  await expect(note(page, 'Brief')).toHaveCount(0)
  await expect(lines(page)).toHaveCount(0) // the arrow joined it to a card that stayed

  await toast(page).getByRole('button', { name: 'Undo' }).click()
  await expect(note(page, 'Brief')).toBeVisible()
  await expect(lines(page)).toHaveCount(1)

  // Same again, then look inside the board: the card is there.
  await drag(page, await center(note(page, 'Brief')), await center(page.getByTestId('board-card')))
  await expect(note(page, 'Brief')).toHaveCount(0)
  await page.getByTestId('board-card').click()
  await expect(note(page, 'Brief')).toBeVisible()
  await page.goBack()
  await expect(note(page, 'Shot list')).toBeVisible()
  await expect(page.getByTestId('board-card')).toContainText('1 item')
})

test('Move to… picker, then Ctrl+Z brings the cards back', async ({ page }) => {
  await page.goto('/dev/board/p8-picker')
  await newBoard(page, 'Ideas')
  await newNote(page, { x: 300, y: 450 }, 'Alpha')
  await newNote(page, { x: 600, y: 450 }, 'Beta')
  await note(page, 'Alpha').click()
  await note(page, 'Beta').click({ modifiers: ['Shift'] })

  await note(page, 'Alpha').click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Move to…' }).click()
  const dialog = page.getByRole('dialog', { name: /Move 2 cards to/ })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('treeitem', { name: /p8-picker|Untitled board/ }).first()).toHaveAttribute('aria-disabled', 'true')
  await expect(dialog.getByRole('button', { name: 'Move', exact: true })).toBeDisabled()
  await dialog.getByRole('treeitem', { name: 'Ideas' }).click()
  await dialog.getByRole('button', { name: 'Move to Ideas' }).click()

  await expect(toast(page)).toContainText('Moved 2 cards to Ideas')
  await expect(note(page, 'Alpha')).toHaveCount(0)
  await expect(note(page, 'Beta')).toHaveCount(0)

  await page.locator('body').click({ position: { x: 5, y: 500 } })
  await page.keyboard.press('Control+z')
  await expect(note(page, 'Alpha')).toBeVisible()
  await expect(note(page, 'Beta')).toBeVisible()
})

test('Duplicate board copies sub-board and arrow; copy and original stay independent', async ({ page }) => {
  await page.goto('/dev/board/p8-dup')
  await newBoard(page, 'Plan')
  await page.getByTestId('board-card').click()
  await expect(page.getByRole('button', { name: 'Plan', exact: true })).toBeVisible()
  const planUrl = page.url()

  await newNote(page, { x: 300, y: 200 }, 'Brief')
  await newNote(page, { x: 700, y: 200 }, 'Shot list')
  await connect(page, 'Brief', 'Shot list')
  await newBoard(page, 'Sub')
  await expect(page.getByTestId('board-card')).toContainText('Sub')

  await page.getByRole('button', { name: 'Board menu' }).click()
  await page.getByRole('menuitem', { name: 'Duplicate board' }).click()
  await expect(toast(page)).toContainText('Duplicated “Plan”')
  await page.getByRole('button', { name: 'Open' }).click()

  await expect(page).not.toHaveURL(planUrl)
  await expect(page.getByRole('button', { name: 'Plan copy' })).toBeVisible()
  await expect(note(page, 'Brief')).toBeVisible()
  await expect(note(page, 'Shot list')).toBeVisible()
  await expect(lines(page)).toHaveCount(1)
  const sub = page.getByTestId('board-card')
  await expect(sub).toContainText('Sub')
  await sub.click()
  const subCopyUrl = page.url()

  // The original's sub-board is a different board.
  await page.goto(planUrl.replace(/\/[0-9a-f-]{36}$/, '/home'))
  await expect(page.getByTestId('canvas')).toBeVisible()
  expect(subCopyUrl).not.toBe(planUrl)
})

test('copy/paste of a board card makes its own child board', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/dev/board/p8-paste')
  await newBoard(page, 'Ideas')
  const card = page.getByTestId('board-card')
  await page.keyboard.press('Escape')
  await card.click({ modifiers: ['Shift'] }) // select without opening
  await page.keyboard.press('Control+d')
  await expect(page.getByTestId('board-card')).toHaveCount(2)
  const ids = await page.evaluate(() => Object.values((window as unknown as { __board: { getState(): { elements: Record<string, { type: string; content: { boardId?: string } }> } } }).__board.getState().elements).filter((e) => e.type === 'board').map((e) => e.content.boardId))
  expect(new Set(ids).size).toBe(2)
})

test('board menu → Move to Trash → Trash page → Restore; Delete forever asks first', async ({ page }) => {
  await page.goto('/dev/board/p8-trash')
  await newBoard(page, 'Old logo options')
  await page.getByTestId('board-card').click()
  await expect(page.getByRole('button', { name: 'Old logo options', exact: true })).toBeVisible()
  await newNote(page, { x: 300, y: 200 }, 'Sketch')

  await page.getByRole('button', { name: 'Board menu' }).click()
  await page.getByRole('menuitem', { name: 'Move to Trash' }).click()
  await expect(toast(page)).toContainText('Moved “Old logo options” to Trash')
  await expect(page.getByTestId('board-card')).toHaveCount(0) // back on the parent, card gone

  await page.getByRole('button', { name: 'Account' }).click()
  await page.getByRole('menuitem', { name: 'Trash' }).click()
  await expect(page).toHaveURL(/\/dev\/trash/)
  const row = page.getByTestId('trash-row')
  await expect(row).toHaveCount(1)
  await expect(row).toContainText('Old logo options')
  await expect(row).toContainText('Board, 1 item')
  await expect(row).toContainText('30 days')

  await row.getByRole('button', { name: /Delete .* forever/ }).click()
  const confirm = page.getByRole('dialog', { name: 'Delete “Old logo options” forever?' })
  await expect(confirm).toContainText('The board and its 1 item will be gone for good')
  await expect(confirm.getByRole('button', { name: 'Cancel' })).toBeFocused()
  await confirm.getByRole('button', { name: 'Cancel' }).click()
  await expect(row).toHaveCount(1)

  await row.getByRole('button', { name: /Restore/ }).click()
  await expect(page.getByTestId('trash-empty')).toContainText('Trash is empty')
  await toast(page).getByRole('button', { name: 'Open' }).click()
  await expect(note(page, 'Sketch')).toBeVisible()
  await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Untitled board' }).click()
  await expect(page.getByTestId('board-card')).toContainText('Old logo options')
})

test('deleting a board card sends its board to the trash; Delete forever removes it', async ({ page }) => {
  await page.goto('/dev/board/p8-forever')
  await newBoard(page, 'Scrap')
  await page.keyboard.press('Delete')
  await expect(page.getByTestId('board-card')).toHaveCount(0)
  await page.getByRole('button', { name: 'Account' }).click()
  await page.getByRole('menuitem', { name: 'Trash' }).click()
  const row = page.getByTestId('trash-row')
  await expect(row).toContainText('Scrap')
  await row.getByRole('button', { name: /Delete .* forever/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete forever' }).click()
  await expect(page.getByTestId('trash-empty')).toBeVisible()
})

test('Home shows recently opened boards', async ({ page }) => {
  await page.goto('/dev/board/home')
  await expect(page.getByTestId('recent-strip')).toContainText('Boards you open will show here')
  await newBoard(page, 'Spring campaign')
  await page.getByTestId('board-card').click()
  await crumbHome(page).click()
  await expect(page.getByTestId('recent-board')).toHaveText('Spring campaign')
})
