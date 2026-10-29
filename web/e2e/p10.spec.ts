import { expect, test, type Page } from '@playwright/test'

// P10: the ⌘K palette on the auth-free dev board (in-memory database with a search stand-in, see DevDb.search).

async function newNote(page: Page, at: { x: number; y: number }, text: string) {
  const c = (await page.getByTestId('canvas').boundingBox())!
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

const palette = (page: Page) => page.getByRole('dialog', { name: 'Search' })
const card = (page: Page, text: string) => page.getByTestId('note-card').filter({ hasText: text }).locator('xpath=ancestor::*[@data-card-id][1]')

test('palette: recent boards, grouped results, keyboard jump across boards with a flash, no results', async ({ page }) => {
  await page.goto('/dev/board/p10-a')
  await newNote(page, { x: 300, y: 200 }, 'Shot list for the spring shoot')
  await newBoard(page, 'Linen swatches')
  await page.getByTestId('board-card').click()
  await expect(page.getByRole('button', { name: 'Linen swatches', exact: true })).toBeVisible()
  await newNote(page, { x: 400, y: 300 }, 'Texture ref, linen and clay')

  // Opens from the top bar; empty shows the boards opened so far.
  await page.getByRole('button', { name: /Search/ }).click()
  await expect(palette(page)).toBeVisible()
  await expect(palette(page).getByText('Recent boards')).toBeVisible()
  await expect(palette(page).getByTestId('search-row').first()).toContainText('Linen swatches')
  await page.keyboard.press('Escape')
  await expect(palette(page)).toHaveCount(0)

  // ⌘K / Ctrl+K, prefix match, groups, highlight.
  await page.keyboard.press('Control+k')
  await page.keyboard.type('lin')
  await expect(palette(page).getByText('Boards', { exact: true })).toBeVisible()
  await expect(palette(page).getByText('Cards', { exact: true })).toBeVisible()
  const rows = palette(page).getByTestId('search-row')
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(0)).toContainText('Linen swatches')
  await expect(rows.nth(0)).toHaveAttribute('aria-selected', 'true')
  await expect(palette(page).locator('mark').first()).toHaveText('Linen')
  await page.keyboard.press('ArrowDown')
  await expect(rows.nth(1)).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Enter')
  await expect(palette(page)).toHaveCount(0)
  await expect(card(page, 'Texture ref').first()).toHaveAttribute('data-flash', 'true')

  // Several words, other board: jump to the card in the parent board.
  await page.keyboard.press('Control+k')
  await page.keyboard.type('shot li')
  await expect(rows).toHaveCount(1)
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/dev\/board\/p10-a(\?|$)/)
  await expect(card(page, 'Shot list')).toHaveAttribute('data-flash', 'true')

  // Nothing found.
  await page.keyboard.press('Control+k')
  await page.keyboard.type('drone')
  await expect(page.getByTestId('search-empty')).toContainText('No matches for “drone”')
  await expect(page.getByRole('link', { name: 'Look in Trash' })).toBeVisible()
  await page.keyboard.press('Escape')
})
