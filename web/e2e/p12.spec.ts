import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const violations = async (page: Page) => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  return r.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)
}

test.describe('a11y (axe, NFR-4 / NFR-8)', () => {
  test('sign in', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    expect(await violations(page)).toEqual([])
  })
  test('board with cards', async ({ page }) => {
    await page.goto('/dev/board/home')
    await page.getByRole('button', { name: 'Dismiss' }).click()
    await page.keyboard.press('n')
    await page.keyboard.press('t')
    expect(await violations(page)).toEqual([])
  })
  test('trash and tasks', async ({ page }) => {
    await page.goto('/dev/trash')
    await expect(page.getByRole('heading', { name: 'Trash', exact: true })).toBeVisible()
    expect(await violations(page)).toEqual([])
    await page.goto('/dev/tasks')
    expect(await violations(page)).toEqual([])
  })
  test('shortcuts sheet', async ({ page }) => {
    await page.goto('/dev/board/home')
    await expect(page.getByTestId('canvas')).toBeVisible()
    await page.keyboard.press('?')
    await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible()
    await page.waitForTimeout(400) // menu-in animation would skew contrast
    expect(await violations(page)).toEqual([])
  })
})

test.describe('shortcuts sheet and account menu', () => {
  test('? opens the sheet with FR-50 keys, Esc closes; account menu opens it too', async ({ page }) => {
    await page.goto('/dev/board/home')
    await expect(page.getByTestId('canvas')).toBeVisible()
    await page.keyboard.press('?')
    const sheet = page.getByRole('dialog', { name: 'Keyboard shortcuts' })
    await expect(sheet).toBeVisible()
    for (const label of ['Add note / to-do / column / board', 'Move selection', 'Fit to content', 'Show this sheet', 'Heading']) await expect(sheet.getByText(label)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)

    await page.getByRole('button', { name: 'Account' }).click()
    await expect(page.getByRole('menuitem', { name: /Trash/ })).toBeVisible()
    await page.getByRole('menuitem', { name: /Keyboard shortcuts/ }).click()
    await expect(sheet).toBeVisible()
  })

  test('? typed in a text field does not open the sheet', async ({ page }) => {
    await page.goto('/dev/board/home')
    await page.getByRole('button', { name: /Search/ }).click()
    await page.getByRole('combobox').or(page.getByRole('searchbox')).or(page.locator('input')).first().fill('?')
    await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toHaveCount(0)
  })

  test('board menu opens while a card is selected', async ({ page }) => {
    await page.goto('/dev/board/home')
    await page.getByRole('button', { name: 'Dismiss' }).click()
    await page.keyboard.press('n')
    await expect(page.locator('[data-card-id][data-selected="true"], [data-card-id]').first()).toBeVisible()
    await page.getByRole('button', { name: 'Board menu' }).click()
    await expect(page.getByRole('menu')).toBeVisible()
  })
})

test.describe('phone (FR-54, NFR-8)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('read-only board: compact header, no tool rail, 44 px targets', async ({ page }) => {
    await page.goto('/dev/board/home')
    await expect(page.getByTestId('canvas')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Search' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Select' })).toHaveCount(0)
    for (const name of ['Search', 'Account', 'Zoom in', 'Zoom out']) {
      const b = (await page.getByRole('button', { name }).boundingBox())!
      expect(b.width, name).toBeGreaterThanOrEqual(43.5)
      expect(b.height, name).toBeGreaterThanOrEqual(43.5)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })

  test('sign in: 16 px inputs, 44 px buttons, no horizontal scroll', async ({ page }) => {
    await page.goto('/login')
    for (const label of ['Email', 'Password']) {
      const f = page.getByLabel(label)
      expect(await f.evaluate((e) => getComputedStyle(e).fontSize)).toBe('16px')
      expect((await f.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    }
    for (const name of ['Sign in', /magic link/]) expect((await page.getByRole('button', { name }).boundingBox())!.height).toBeGreaterThanOrEqual(44)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })

  test('shared board: logo only, no horizontal scroll', async ({ page }) => {
    await page.goto('/s/demo')
    await expect(page.getByTestId('shared-board')).toBeVisible()
    await expect(page.getByTestId('view-only-pill')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })
})

test.describe('laptop 1280 x 800', () => {
  test.use({ viewport: { width: 1280, height: 800 } })
  test('top bar and tool rail fit without scrolling', async ({ page }) => {
    await page.goto('/dev/board/home')
    await expect(page.getByTestId('canvas')).toBeVisible()
    const header = page.locator('header').first()
    expect(await header.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true)
    const trash = (await page.getByRole('link', { name: 'Trash' }).or(page.getByRole('button', { name: 'Trash' })).first().boundingBox())!
    expect(trash.y + trash.height).toBeLessThanOrEqual(800)
    for (const name of ['Search', 'Tasks', 'Account']) await expect(page.getByRole('button', { name }).first()).toBeInViewport()
  })
})

test('viewer shows no edit affordances', async ({ page }) => {
  await page.goto('/s/demo')
  await expect(page.getByTestId('shared-board')).toBeVisible()
  await expect(page.getByText('+ Add item')).toHaveCount(0)
  await expect(page.getByText('Add an item…')).toHaveCount(0)
  await expect(page.getByText('Drag cards here to stack them')).toHaveCount(0)
})

test('PWA: manifest and service worker are served, shell icons exist', async ({ request }) => {
  const m = await (await request.get('/manifest.webmanifest')).json()
  expect(m.name).toBe('Mosaic')
  expect(m.display).toBe('standalone')
  for (const i of m.icons) expect((await request.get(i.src)).ok(), i.src).toBe(true)
  const sw = await request.get('/sw.js')
  expect(sw.ok()).toBe(true)
  expect(await sw.text()).toContain('url.origin !== self.location.origin') // cross-origin (Supabase) is never cached
})
