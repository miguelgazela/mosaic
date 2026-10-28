import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 900 } })

const shot = (name: string) => ({ path: `test-results/d1/${name}.png` })

test.describe('canvas chrome', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dev/canvas?cards=6')
    await expect(page.locator('[data-card-id]')).toHaveCount(6)
  })

  test('uses Plus Jakarta Sans and token colours', async ({ page }) => {
    await expect(page.locator('body')).toHaveCSS('font-family', /Plus Jakarta Sans/)
    await expect(page.getByTestId('canvas')).toHaveCSS('background-color', 'rgb(236, 234, 230)')
    await expect(page.getByRole('navigation', { name: 'Tools' })).toHaveCSS('width', '76px')
  })

  test('rail: tooltip with shortcut, single-key shortcut adds a card, Select/Hand on top', async ({ page }) => {
    const rail = page.getByRole('navigation', { name: 'Tools' })
    const names = await rail.getByRole('button').allTextContents()
    expect(names.slice(0, 2)).toEqual(['Select', 'Hand'])
    await rail.getByRole('button', { name: 'Add debug' }).hover()
    await expect(page.getByRole('tooltip').filter({ hasText: 'Add debug' })).toBeVisible()
    await page.keyboard.press('d')
    await expect(page.locator('[data-card-id]')).toHaveCount(7)
    await page.keyboard.press('h')
    await expect(rail.getByRole('button', { name: 'Hand' })).toHaveAttribute('aria-pressed', 'true')
    await page.screenshot(shot('board-populated'))
  })

  test('selection toolbar: single and multi, duplicate and delete', async ({ page }) => {
    await page.locator('[data-card-id]').first().click()
    const bar = page.getByTestId('selection-toolbar')
    await expect(bar).toBeVisible()
    await page.screenshot(shot('board-card-selected'))
    await bar.getByRole('button', { name: 'Duplicate' }).click()
    await expect(page.locator('[data-card-id]')).toHaveCount(7)
    await page.keyboard.press('Control+a')
    await expect(bar).toContainText('7 cards')
    await bar.getByRole('button', { name: 'Delete' }).click()
    await expect(page.locator('[data-card-id]')).toHaveCount(0)
    await expect(page.getByText('This board is empty')).toBeVisible()
    await page.screenshot(shot('board-empty'))
  })

  test('arrow keys nudge 8 px, shift 80 px', async ({ page }) => {
    const c = page.locator('[data-card-id]').first()
    await c.click()
    const x0 = Number(await c.getAttribute('data-x'))
    await page.keyboard.press('ArrowRight')
    expect(Number(await c.getAttribute('data-x'))).toBe(x0 + 8)
    await page.keyboard.press('Shift+ArrowRight')
    expect(Number(await c.getAttribute('data-x'))).toBe(x0 + 88)
  })

  test('snap guides show while dragging next to an aligned card', async ({ page }) => {
    const a = page.locator('[data-card-id]').nth(0)
    const b = page.locator('[data-card-id]').nth(3)
    const bx = Number(await b.getAttribute('data-x'))
    const ab = (await a.boundingBox())!
    const bb = (await b.boundingBox())!
    // Drag card 0 so its left edge lands ~3 px from card 3's left edge.
    await page.mouse.move(ab.x + 20, ab.y + 20)
    await page.mouse.down()
    await page.mouse.move(ab.x + 20 + (bb.x - ab.x) + 3, ab.y + 20 + 300, { steps: 6 })
    await expect(page.getByTestId('snap-guide').first()).toBeVisible()
    await page.screenshot(shot('board-drag-snap-guides'))
    await page.mouse.up()
    expect(Number(await a.getAttribute('data-x'))).toBe(bx)
    await expect(page.getByTestId('snap-guide')).toHaveCount(0)
  })

  test('ghost card follows a tool drag', async ({ page }) => {
    const btn = page.getByRole('button', { name: 'Add debug' })
    const canvas = page.getByTestId('canvas')
    await btn.dragTo(canvas, { targetPosition: { x: 600, y: 500 } })
    await expect(page.locator('[data-card-id]')).toHaveCount(7)
    await expect(page.getByTestId('ghost-card')).toHaveCount(0)
  })

  test('zoom menu: levels, check mark, fit', async ({ page }) => {
    await page.getByTestId('zoom-level').click()
    await page.getByRole('menuitem', { name: '50%' }).click()
    await expect(page.getByTestId('zoom-level')).toHaveText('50%')
    await page.getByTestId('zoom-level').click()
    await expect(page.getByRole('menuitem', { name: '50%' })).toContainText('✓')
    await page.getByRole('menuitem', { name: /Fit to content/ }).click()
    await expect(page.getByTestId('zoom-level')).toHaveText(/\d+%/)
  })

  test('context menus: card and canvas', async ({ page }) => {
    await page.locator('[data-card-id]').first().click({ button: 'right' })
    await expect(page.getByRole('menuitem', { name: /Bring to front/ })).toBeVisible()
    await page.screenshot(shot('menu-card'))
    await page.keyboard.press('Escape')
    await page.getByTestId('canvas').click({ button: 'right', position: { x: 900, y: 600 } })
    await expect(page.getByRole('menuitem', { name: /Add debug here/ })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: /Select all/ })).toBeVisible()
  })

  test('marquee uses primary colour', async ({ page }) => {
    const canvas = (await page.getByTestId('canvas').boundingBox())!
    await page.mouse.move(canvas.x + 150, canvas.y + 60)
    await page.mouse.down()
    await page.mouse.move(canvas.x + 560, canvas.y + 230, { steps: 6 })
    await expect(page.getByTestId('marquee')).toHaveCSS('border-top-color', 'rgb(124, 58, 237)')
    await page.screenshot(shot('board-marquee'))
    await page.mouse.up()
  })
})

test('404 page', async ({ page }) => {
  await page.goto('/no/such/page')
  await expect(page.getByRole('heading', { name: 'We can’t find this board' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Go to Home' })).toHaveCSS('background-color', 'rgb(124, 58, 237)')
  await page.screenshot(shot('not-found'))
})

test('not a member page', async ({ page }) => {
  await page.goto('/dev/not-member')
  await expect(page.getByRole('heading', { name: /doesn’t have access yet/ })).toBeVisible()
  await page.screenshot(shot('not-a-member'))
})

test('board page: top bar, breadcrumb rename, empty state', async ({ page }) => {
  await page.goto('/dev/board/demo')
  await expect(page.getByText('This board is empty')).toBeVisible()
  await expect(page.getByTestId('save-status')).toHaveText('Saved')
  await expect(page.getByRole('button', { name: /Search/ })).toContainText('⌘K')
  await page.getByRole('button', { name: 'Untitled board' }).click()
  await page.getByLabel('Board title').fill('Spring campaign')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Spring campaign' })).toBeVisible()
  await page.getByRole('button', { name: 'Spring campaign' }).click()
  await page.getByLabel('Board title').fill('Nope')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Spring campaign' })).toBeVisible()
  await page.getByRole('button', { name: 'Account' }).click()
  await expect(page.getByRole('menuitem', { name: 'Sign out' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.screenshot({ path: 'test-results/d1/board-top-bar.png' })
})
