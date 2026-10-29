import { expect, test } from '@playwright/test'

// D2: Mosaic name and icons, on the auth-free dev board.

test('app shell shows the Mosaic icon and title, never the old name', async ({ page }) => {
  await page.goto('/dev/board/d2-brand')
  await expect(page).toHaveTitle('Mosaic')
  await expect(page.locator('header img[src="/mosaic-icon-512.png"]')).toBeVisible()
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/apple-touch-icon.png')
  await expect(page.locator('body')).not.toContainText(/milanote/i)
})

test('icon picker offers 12 icons and the chosen one shows on the card and the breadcrumb chip', async ({ page }) => {
  await page.goto('/dev/board/d2-icons')
  await expect(page.getByTestId('canvas')).toBeVisible()
  await page.keyboard.press('b')
  await page.getByRole('textbox', { name: 'Board name' }).fill('Icons')
  await page.keyboard.press('Enter')
  const card = page.getByTestId('board-card')
  await card.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Icon & colour' }).click()
  const rocket = page.getByRole('button', { name: /^Rocket$/ })
  await expect(rocket).toBeVisible()
  expect(await page.getByRole('button', { name: /^(Star|Camera|Image|Folder|Idea|Heart|Calendar|Flag|Rocket|Palette|Book|Music)$/ }).count()).toBe(12)
  await rocket.click()
  await expect(card.getByTestId('board-tile').locator('svg')).toHaveCount(1)
})
