import { expect, test, type Page } from '@playwright/test'

// P2 against live Supabase. Needs a member account: E2E_EMAIL=… E2E_PASSWORD=… npx playwright test sync
const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD
test.skip(!email || !password, 'set E2E_EMAIL and E2E_PASSWORD (a milanote member) to run sync tests')

async function signIn(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email!)
  await page.getByLabel('Password').fill(password!)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/b\//)
  await expect(page.getByTestId('canvas')).toBeVisible()
}

const saved = (page: Page) => expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'saved', { timeout: 10_000 })

async function addCard(page: Page): Promise<string> {
  const before = new Set(await page.locator('[data-card-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-card-id'))))
  await page.getByTestId('canvas').click({ position: { x: 600, y: 120 } })
  await page.keyboard.press('n')
  await page.keyboard.type('sync test note')
  await page.keyboard.press('Escape')
  const ids = await page.locator('[data-card-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-card-id')!))
  const id = ids.find((i) => !before.has(i))
  expect(id).toBeTruthy()
  return id!
}

async function removeCard(page: Page, id: string) {
  await page.locator(`[data-card-id="${id}"]`).click()
  await page.keyboard.press('Delete')
  await expect(page.locator(`[data-card-id="${id}"]`)).toHaveCount(0)
  await saved(page)
}

test('edit survives reload', async ({ page }) => {
  await signIn(page)
  const id = await addCard(page)
  await saved(page)
  await page.reload()
  await expect(page.locator(`[data-card-id="${id}"]`)).toBeVisible()
  await removeCard(page, id)
})

test('two tabs mirror each other', async ({ context }) => {
  const a = await context.newPage()
  await signIn(a)
  const b = await context.newPage()
  await b.goto(a.url())
  await expect(b.getByTestId('canvas')).toBeVisible()

  const id = await addCard(a)
  const inB = b.locator(`[data-card-id="${id}"]`)
  await expect(inB).toBeVisible({ timeout: 3_000 })

  // Move in A (keyboard nudge, 80 px), B follows.
  const x = Number(await inB.getAttribute('data-x'))
  await a.keyboard.press('Shift+ArrowRight')
  await expect(inB).toHaveAttribute('data-x', String(x + 80), { timeout: 3_000 })

  // Delete in B, A follows.
  await removeCard(b, id)
  await expect(a.locator(`[data-card-id="${id}"]`)).toHaveCount(0, { timeout: 3_000 })
})
