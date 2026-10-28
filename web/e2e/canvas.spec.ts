import { expect, test, type Page } from '@playwright/test'

const pos = async (page: Page, i: number) => {
  const c = page.locator('[data-card-id]').nth(i)
  return { x: Number(await c.getAttribute('data-x')), y: Number(await c.getAttribute('data-y')) }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/dev/canvas?cards=6')
  await expect(page.locator('[data-card-id]')).toHaveCount(6)
})

test('drag moves a card with snap, undo restores it', async ({ page }) => {
  const card = page.locator('[data-card-id]').first()
  const before = await pos(page, 0)
  const box = (await card.boundingBox())!
  await page.mouse.move(box.x + 20, box.y + 20)
  await page.mouse.down()
  await page.mouse.move(box.x + 70, box.y + 63, { steps: 5 })
  await page.mouse.up()
  const after = await pos(page, 0)
  expect(after.x).toBe(before.x + 48)
  expect(after.y % 8).toBe(0)
  expect(after.y).toBeGreaterThan(before.y)
  await page.keyboard.press('Control+z')
  expect(await pos(page, 0)).toEqual(before)
  await page.keyboard.press('Control+Shift+z')
  expect(await pos(page, 0)).toEqual(after)
})

test('marquee selects, delete and undo', async ({ page }) => {
  const canvas = (await page.getByTestId('canvas').boundingBox())!
  // cards live at world x>=200,y>=100; drag a rectangle around the first two
  await page.mouse.move(canvas.x + 150, canvas.y + 60)
  await page.mouse.down()
  await page.mouse.move(canvas.x + 560, canvas.y + 230, { steps: 8 })
  await expect(page.getByTestId('marquee')).toBeVisible()
  await page.mouse.up()
  const selected = page.locator('[data-card-id][data-selected="true"]')
  await expect(selected).toHaveCount(2)
  await page.keyboard.press('Delete')
  await expect(page.locator('[data-card-id]')).toHaveCount(4)
  await page.keyboard.press('Control+z')
  await expect(page.locator('[data-card-id]')).toHaveCount(6)
})

test('ctrl+wheel zooms, space-drag pans, fit works', async ({ page }) => {
  const canvas = (await page.getByTestId('canvas').boundingBox())!
  await page.mouse.move(canvas.x + 500, canvas.y + 300)
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -100)
  await page.keyboard.up('Control')
  await expect(page.getByTestId('zoom-level')).not.toHaveText('100%')
  await page.keyboard.press('0')
  await expect(page.getByTestId('zoom-level')).toHaveText('100%')
  const before = (await page.locator('[data-card-id]').first().boundingBox())!
  await page.keyboard.down('Space')
  await page.mouse.move(canvas.x + 600, canvas.y + 500)
  await page.mouse.down()
  await page.mouse.move(canvas.x + 650, canvas.y + 530, { steps: 4 })
  await page.mouse.up()
  await page.keyboard.up('Space')
  const after = (await page.locator('[data-card-id]').first().boundingBox())!
  expect(Math.round(after.x - before.x)).toBe(50)
  expect(Math.round(after.y - before.y)).toBe(30)
  await page.keyboard.press('Shift+Digit1')
  await expect(page.getByTestId('zoom-level')).toHaveText(/\d+%/)
})

test('toolbar adds, duplicate and context menu delete work', async ({ page }) => {
  await page.getByRole('button', { name: 'Debug' }).click()
  await expect(page.locator('[data-card-id]')).toHaveCount(7)
  await page.keyboard.press('Control+d')
  await expect(page.locator('[data-card-id]')).toHaveCount(8)
  await page.locator('[data-card-id][data-selected="true"]').click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await expect(page.locator('[data-card-id]')).toHaveCount(7)
})
