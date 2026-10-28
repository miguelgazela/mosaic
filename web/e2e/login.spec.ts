import { expect, test } from '@playwright/test'

test('unauthenticated visit redirects to login', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})

test.use({ viewport: { width: 1440, height: 900 } })

test('sign in screen matches the design: fields, primary button, magic link', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('Email')).toBeVisible()
  await page.getByLabel('Password').fill('x')
  await expect(page.getByRole('button', { name: 'Sign in' })).toHaveCSS('background-color', 'rgb(124, 58, 237)')
  await expect(page.getByRole('button', { name: /magic link/ })).toBeVisible()
  await expect(page.getByText('Access is by invitation')).toBeVisible()
  await page.screenshot({ path: 'test-results/d1/sign-in.png' })
})
