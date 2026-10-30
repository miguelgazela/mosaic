import { expect, test } from '@playwright/test'

type Board = { getState(): { setViewport(v: { x: number; y: number; zoom: number }): void } }
const setZoom = (page: import('@playwright/test').Page, zoom: number) =>
  page.evaluate((z) => (window as unknown as { __board: Board }).__board.getState().setViewport({ x: 120, y: 80, zoom: z }), zoom)

test('25 % zoom: card text becomes bars, layout is unchanged, text returns at 100 %', async ({ page }) => {
  await page.goto('/dev/board/p13lod')
  await page.getByRole('button', { name: 'Dismiss' }).click({ timeout: 1500 }).catch(() => {})
  await page.keyboard.press('n')
  await expect(page.getByRole('textbox', { name: 'Note text' })).toBeFocused()
  await page.keyboard.type('Pick the locations')
  await page.keyboard.press('Escape')
  await page.getByTestId('canvas').click({ position: { x: 900, y: 600 } })
  await page.keyboard.press('t')
  await expect(page.getByTestId('todo-card')).toBeVisible()
  await page.getByTestId('canvas').click({ position: { x: 900, y: 600 } })
  await expect(page.locator('[data-card-id]')).toHaveCount(2)
  const note = page.locator('[data-card-id]').filter({ has: page.locator('.note-prose p') }).first()
  await setZoom(page, 1)
  const h1 = await note.evaluate((el) => (el as HTMLElement).offsetHeight)

  await setZoom(page, 0.25)
  await expect(note).toHaveAttribute('data-lod', 'low')
  expect(await note.locator('.note-prose p').first().evaluate((el) => getComputedStyle(el).color)).toBe('rgba(0, 0, 0, 0)')
  expect(await note.locator('.note-prose p').first().evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('linear-gradient')
  expect(await note.evaluate((el) => (el as HTMLElement).offsetHeight)).toBe(h1)
  await page.screenshot({ path: 'test-results/p13-zoom-25.png' })

  await setZoom(page, 1)
  await expect(note).not.toHaveAttribute('data-lod', 'low')
})
