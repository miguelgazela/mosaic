import { expect, test, type Page } from '@playwright/test'

// P5: link cards on the auth-free dev board, with the unfurl endpoint mocked.

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' }

async function mockUnfurl(page: Page, handler: (url: string) => { status?: number; body: unknown } | 'hang') {
  const calls: string[] = []
  await page.route('**/functions/v1/milanote-unfurl', async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    const url = route.request().postDataJSON().url as string
    calls.push(url)
    const r = handler(url)
    if (r === 'hang') return
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

test('pasting a URL makes a link card with a full preview, not a note', async ({ page }) => {
  const calls = await mockUnfurl(page, () => ({
    body: { title: 'Lighting a small product studio', description: 'Three set-ups that work.', favicon: 'https://example.com/f.png' },
  }))
  await page.goto('/dev/board/p5-paste')
  await expect(page.getByTestId('canvas')).toBeVisible()
  await paste(page, 'https://example.com/studio')
  const card = page.getByTestId('link-card')
  await expect(card).toHaveAttribute('data-state', 'text')
  await expect(card).toContainText('Lighting a small product studio')
  await expect(card).toContainText('example.com')
  await expect(page.getByTestId('note-card')).toHaveCount(0)
  expect(calls).toEqual(['https://example.com/studio'])

  // Plain text still becomes a note.
  await paste(page, 'just some words')
  await expect(page.getByTestId('link-card')).toHaveCount(1)
})

test('loading skeleton, then failed state shows a clickable plain URL', async ({ page }) => {
  await mockUnfurl(page, () => ({ status: 502, body: { error: 'upstream' } }))
  await page.goto('/dev/board/p5-fail')
  await expect(page.getByTestId('canvas')).toBeVisible()
  await paste(page, 'https://example.net/brief/v2')
  const card = page.getByTestId('link-card')
  await expect(card).toHaveAttribute('data-state', 'failed')
  const a = card.getByRole('link')
  await expect(a).toHaveText('example.net/brief/v2')
  await expect(a).toHaveAttribute('href', 'https://example.net/brief/v2')
})

test('loading state while the function is slow', async ({ page }) => {
  await mockUnfurl(page, () => 'hang')
  await page.goto('/dev/board/p5-load')
  await expect(page.getByTestId('canvas')).toBeVisible()
  await paste(page, 'https://example.net/slow')
  const card = page.getByTestId('link-card')
  await expect(card).toHaveAttribute('data-state', 'loading')
  await expect(card.getByRole('status')).toBeVisible()
  await expect(card).toContainText('example.net')
})

test('video card: play button swaps in the provider player', async ({ page }) => {
  await mockUnfurl(page, () => ({
    body: { title: 'Behind the scenes', embed: { provider: 'youtube', id: 'dQw4w9WgXcQ' }, duration: 252 },
  }))
  await page.goto('/dev/board/p5-video')
  await expect(page.getByTestId('canvas')).toBeVisible()
  await paste(page, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  const card = page.getByTestId('link-card')
  await expect(card).toHaveAttribute('data-state', 'video')
  await expect(card).toContainText('4:12')
  await page.getByRole('button', { name: /Play Behind the scenes/ }).click()
  await expect(card.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/)
})

test('tool rail Link: type a URL, then edit it', async ({ page }) => {
  const calls = await mockUnfurl(page, (u) => ({ body: { title: u.includes('two') ? 'Second' : 'First' } }))
  await page.goto('/dev/board/p5-edit')
  await page.getByRole('button', { name: 'Add link' }).click()
  const input = page.getByRole('textbox', { name: 'Link URL' })
  await expect(input).toBeFocused()
  await input.fill('not a url')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('alert')).toBeVisible()
  await input.fill('one.example.com')
  await page.keyboard.press('Enter')
  const card = page.getByTestId('link-card')
  await expect(card).toContainText('First')

  await card.dblclick()
  await page.getByRole('textbox', { name: 'Link URL' }).fill('https://two.example.com')
  await page.keyboard.press('Enter')
  await expect(card).toContainText('Second')
  expect(calls).toEqual(['https://one.example.com/', 'https://two.example.com/'])
})

test('Escape on a new empty link card removes it', async ({ page }) => {
  await page.goto('/dev/board/p5-empty')
  await page.getByRole('button', { name: 'Add link' }).click()
  await expect(page.getByRole('textbox', { name: 'Link URL' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-card-id]')).toHaveCount(0)
})
