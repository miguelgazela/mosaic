import { expect, test, type Page } from '@playwright/test'

// P9: share dialog on the auth-free dev board (in-memory share repo) and the signed-out viewer (/s/demo is a dev stand-in
// for the milanote-share function).

const canvasBox = async (page: Page) => (await page.getByTestId('canvas').boundingBox())!

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
})

test('share dialog: empty state, create copies the link, revoke asks first', async ({ page }) => {
  await page.goto('/dev/board/p9-share')
  await page.getByRole('button', { name: 'Share', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByTestId('share-empty')).toBeVisible()

  await expect(dialog.getByRole('switch')).toBeChecked() // matches the DB default (include sub-boards)
  await dialog.getByRole('button', { name: 'Create link' }).click()
  await expect(dialog.getByTestId('share-link')).toHaveCount(1)
  await expect(dialog.getByText('Copied')).toBeVisible()
  await expect(dialog.getByText('includes sub-boards')).toBeVisible()
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toMatch(/\/s\/dev[a-z0-9]+$/)

  await dialog.getByRole('button', { name: 'Create link' }).click()
  await expect(dialog.getByTestId('share-link')).toHaveCount(2)

  await dialog.getByRole('button', { name: 'Revoke' }).first().click()
  await expect(page.getByRole('dialog', { name: 'Revoke this link?' })).toBeVisible()
  await page.keyboard.press('Escape') // closes only the confirm
  await expect(page.getByRole('dialog', { name: 'Revoke this link?' })).toHaveCount(0)
  await expect(dialog).toBeVisible()
  await expect(dialog.getByTestId('share-link')).toHaveCount(2)

  await dialog.getByRole('button', { name: 'Revoke' }).first().click()
  await page.getByRole('button', { name: 'Revoke link' }).click()
  await expect(dialog.getByTestId('share-link')).toHaveCount(1)
})

test('board menu has Share…', async ({ page }) => {
  await page.goto('/dev/board/p9-menu')
  await page.getByRole('button', { name: 'Board menu' }).click()
  await page.getByRole('menuitem', { name: /Share/ }).click()
  await expect(page.getByRole('dialog', { name: /Share/ })).toBeVisible()
})

test('read-only board: chip, pill, no tool rail, nothing edits', async ({ page }) => {
  await page.goto('/dev/board/x?view=1')
  await expect(page.getByTestId('canvas')).toBeVisible()
  await expect(page.getByTestId('view-only-chip')).toBeVisible()
  await expect(page.getByTestId('view-only-pill')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Tools' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Share', exact: true })).toHaveCount(0)
  const c = await canvasBox(page)
  await page.mouse.dblclick(c.x + 300, c.y + 300)
  await page.keyboard.press('n')
  await page.keyboard.press('Control+v')
  await expect(page.getByTestId('note-card')).toHaveCount(0)
  expect(await page.evaluate(() => Object.keys((window as unknown as { __board: { getState(): { elements: object } } }).__board.getState().elements).length)).toBe(0)
})

test('viewer: signed-out visitor sees the board read-only; sub-board opens', async ({ page }) => {
  await page.goto('/s/demo')
  await expect(page.getByText('Shared by Miguel Oliveira, view only')).toBeVisible()
  await expect(page.getByText('Launch the spring range')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Tools' })).toHaveCount(0)

  // editing attempts change nothing
  await page.getByText('Launch the spring range').dblclick()
  await expect(page.getByRole('textbox', { name: 'Note text' })).toHaveCount(0)
  await page.keyboard.press('Delete')
  await expect(page.getByText('Launch the spring range')).toBeVisible()

  await page.getByRole('link', { name: 'Open board Moodboard' }).click()
  await expect(page).toHaveURL(/\/s\/demo\/b\/demo-mood$/)
  await expect(page.getByText('Keep shadows soft')).toBeVisible()
  await page.getByRole('link', { name: 'Back to Spring campaign' }).click()
  await expect(page).toHaveURL(/\/s\/demo$/)
})

test('viewer: sub-boards off → board cards locked and the sub-board address is refused', async ({ page }) => {
  await page.goto('/s/demo-flat')
  await expect(page.getByText('Not shared').first()).toBeVisible()
  await page.getByTestId('board-card').first().click()
  await expect(page).toHaveURL(/\/s\/demo-flat$/)
  await page.goto('/s/demo-flat/b/demo-mood')
  await expect(page.getByText('This link doesn’t work any more')).toBeVisible()
})

test('viewer: revoked or unknown token shows the revoked screen', async ({ page }) => {
  await page.goto('/s/demo-revoked')
  await expect(page.getByText('This link doesn’t work any more')).toBeVisible()
})

test('viewer against a stubbed function: sends token, 404 → revoked screen', async ({ page }) => {
  let body = ''
  await page.route('**/functions/v1/milanote-share', async (route) => {
    body = route.request().postData() ?? ''
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{"status":"not_found"}' })
  })
  await page.goto('/s/' + 'f'.repeat(48))
  await expect(page.getByText('This link doesn’t work any more')).toBeVisible()
  expect(JSON.parse(body).token).toBe('f'.repeat(48))
})
