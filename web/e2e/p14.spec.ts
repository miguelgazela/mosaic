import { expect, test, type Page } from '@playwright/test'

// P14: owner bugs from first real use, on the auth-free dev board.

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' }

async function mockUnfurl(page: Page, handler: (url: string, n: number) => { status?: number; body: unknown }) {
  const calls: string[] = []
  await page.route('**/functions/v1/milanote-unfurl', async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    const url = route.request().postDataJSON().url as string
    calls.push(url)
    const r = handler(url, calls.length)
    await route.fulfill({ status: r.status ?? 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(r.body) })
  })
  return calls
}

const paste = (page: Page, text: string) =>
  page.evaluate((t) => {
    const dt = new DataTransfer()
    dt.setData('text/plain', t)
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }))
  }, text)

test.describe('link card drag', () => {
  for (const target of ['title', 'domain', 'body'] as const) {
    test(`dragging from the ${target} moves the card by the pointer delta`, async ({ page }) => {
      await mockUnfurl(page, () => ({ body: { title: 'Lighting a small product studio', description: 'Three set-ups that work.' } }))
      await page.goto('/dev/board/p14-drag-' + target)
      await expect(page.getByTestId('canvas')).toBeVisible()
      await paste(page, 'https://example.com/studio')
      const card = page.getByTestId('link-card')
      await expect(card).toHaveAttribute('data-state', 'text')
      const shell = page.locator('[data-card-id]').first()
      const spot = target === 'title' ? card.getByTestId('link-title') : target === 'domain' ? card.getByTestId('link-domain') : card.getByText('Three set-ups that work.')
      const before = (await shell.boundingBox())!
      const b = (await spot.boundingBox())!
      const from = { x: b.x + Math.min(b.width / 2, 20), y: b.y + b.height / 2 }
      await page.mouse.move(from.x, from.y)
      await page.mouse.down()
      await page.mouse.move(from.x + 40, from.y + 30, { steps: 5 })
      await page.mouse.move(from.x + 120, from.y + 90, { steps: 5 })
      await page.mouse.up()
      const after = (await shell.boundingBox())!
      expect(Math.abs(after.x - before.x - 120)).toBeLessThan(3)
      expect(Math.abs(after.y - before.y - 90)).toBeLessThan(3)
    })
  }
})

test.describe('link preview retry', () => {
  test('Retry preview on a failed card fetches again and fills the card', async ({ page }) => {
    const calls = await mockUnfurl(page, (_u, n) => (n === 1 ? { status: 502, body: { error: 'upstream' } } : { body: { title: 'Spring palette notes', description: 'Muted clay.' } }))
    await page.goto('/dev/board/p14-retry')
    await expect(page.getByTestId('canvas')).toBeVisible()
    await paste(page, 'https://example.org/palette')
    const card = page.getByTestId('link-card')
    await expect(card).toHaveAttribute('data-state', 'failed')
    await card.getByRole('button', { name: 'Retry preview' }).click()
    await expect(card).toHaveAttribute('data-state', 'text')
    await expect(card).toContainText('Spring palette notes')
    expect(calls.length).toBe(2)
  })

  test('a card that was already failed when the board loaded retries once, not in a loop', async ({ page }) => {
    const calls = await mockUnfurl(page, (_u, n) => (n === 1 ? { body: { title: 'Back again' } } : { status: 502, body: {} }))
    await page.goto('/dev/board/p14-auto')
    await expect(page.getByTestId('canvas')).toBeVisible()
    // Seed a failed card straight into the store, as if loaded from the database.
    await page.evaluate(() => {
      type S = { setState: (f: (s: { elements: Record<string, unknown> }) => unknown) => void }
      const b = (window as unknown as { __board: S }).__board
      b.setState((s) => ({
        elements: { ...s.elements, seeded: { id: 'seeded', type: 'link', x: 300, y: 200, width: 280, height: null, z: 'a0', color: null, parentId: null, sortKey: null, content: { url: 'https://example.com/old', failed: true } } },
      }))
    })
    const card = page.getByTestId('link-card')
    await expect(card).toContainText('Back again')
    expect(calls).toEqual(['https://example.com/old'])
  })
})

test.describe('trash multi-select', () => {
  async function trashThree(page: Page) {
    await page.goto('/dev/board/p14-trash')
    const c = (await page.getByTestId('canvas').boundingBox())!
    for (const [i, t] of ['Alpha', 'Bravo', 'Charlie'].entries()) {
      await page.mouse.dblclick(c.x + 300, c.y + 150 + i * 160)
      await expect(page.getByRole('textbox', { name: 'Note text' })).toBeFocused()
      await page.keyboard.type(t)
      await page.keyboard.press('Escape')
      await page.keyboard.press('Escape')
    }
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('Delete')
    await page.getByRole('button', { name: 'Account' }).click()
    await page.getByRole('menuitem', { name: 'Trash' }).click()
    await expect(page.getByTestId('trash-row')).toHaveCount(3)
  }

  test('select all, restore together', async ({ page }) => {
    await trashThree(page)
    await page.getByRole('checkbox', { name: 'Select all' }).check()
    await expect(page.getByTestId('trash-bulk')).toContainText('3 selected')
    await page.getByRole('button', { name: 'Restore selected' }).click()
    await expect(page.getByTestId('trash-empty')).toBeVisible()
  })

  test('select two, delete forever asks first and removes only those', async ({ page }) => {
    await trashThree(page)
    const rows = page.getByTestId('trash-row')
    await rows.nth(0).getByRole('checkbox').check()
    await rows.nth(1).getByRole('checkbox').check()
    await expect(page.getByTestId('trash-bulk')).toContainText('2 selected')
    await page.getByRole('button', { name: 'Delete selected forever' }).click()
    const dlg = page.getByRole('dialog', { name: 'Delete 2 items forever?' })
    await dlg.getByRole('button', { name: 'Cancel' }).click()
    await expect(rows).toHaveCount(3)
    await page.getByRole('button', { name: 'Delete selected forever' }).click()
    await dlg.getByRole('button', { name: 'Delete forever' }).click()
    await expect(rows).toHaveCount(1)
    await expect(page.getByTestId('trash-bulk')).toHaveCount(0)
  })
})
