import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 900 } })

// Empty canvas corner (right of the tool rail, below the cards): a real pointer-down that leaves edit mode and deselects.
const clickEmptyCanvas = async (page: Page) => {
  const box = (await page.getByTestId('canvas').boundingBox())!
  await page.mouse.click(box.x + box.width - 40, box.y + box.height - 160)
}
const shot = (name: string) => ({ path: `test-results/p6/${name}.png` })
const pad = (n: number) => String(n).padStart(2, '0')
const day = (offset: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

test.describe('to-do card', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dev/canvas?cards=1')
    await expect(page.locator('[data-card-id]')).toHaveCount(1)
  })

  test('T adds a card; add, check, date, hide completed, undo', async ({ page }) => {
    const card = page.getByTestId('todo-card')
    // The key can land before the shortcut listener is attached (seen once in a loaded full run): retry until the card exists.
    await expect(async () => {
      if ((await card.count()) === 0) await page.keyboard.press('t')
      await expect(card).toBeVisible({ timeout: 500 })
    }).toPass({ timeout: 10_000 })
    await card.getByRole('button', { name: 'Add an item…' }).click()
    await expect(card.getByLabel('To-do item')).toBeFocused()
    await page.keyboard.type('Book the studio')
    await page.keyboard.press('Enter')
    await expect(card.getByLabel('To-do item').nth(1)).toBeFocused()
    await page.keyboard.type('Order props')
    await page.keyboard.press('Escape')
    await expect(card.getByLabel('To-do item')).toHaveCount(2)
    await expect(card.getByTestId('todo-count')).toHaveText('0/2')

    await card.getByRole('checkbox', { name: /Book the studio/ }).check()
    await expect(card.getByTestId('todo-count')).toHaveText('1/2')
    await expect(card.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1')

    // due date: picker -> Today chip (icon + word)
    const row = card.locator('[data-todo-row]').nth(1)
    await row.hover()
    await row.getByRole('button', { name: 'Set due date' }).click()
    await page.getByRole('button', { name: 'Today', exact: true }).click()
    await clickEmptyCanvas(page) // leave edit mode: row tools give way to the chip
    await expect(row.getByTestId('due-chip')).toHaveText('Today')
    await expect(row.getByTestId('due-chip')).toHaveAttribute('data-due-kind', 'today')
    await page.screenshot(shot('todo-card'))

    // hide completed, then undo it (the button shows while the card is selected)
    await card.click({ position: { x: 150, y: 8 } })
    await card.getByRole('button', { name: 'Hide completed' }).click()
    await expect(card.getByText('1 completed hidden.')).toBeVisible()
    await expect(card.getByLabel('To-do item')).toHaveCount(1)
    await clickEmptyCanvas(page)
    await page.keyboard.press('Control+z')
    await expect(card.getByLabel('To-do item')).toHaveCount(2)
  })

  test('items reorder with Alt+Arrow', async ({ page }) => {
    await page.getByRole('navigation', { name: 'Tools' }).getByRole('button', { name: 'Add to-do' }).click()
    const card = page.getByTestId('todo-card')
    await card.getByRole('button', { name: 'Add an item…' }).click()
    await expect(card.getByLabel('To-do item')).toBeFocused()
    await page.keyboard.type('one')
    await page.keyboard.press('Enter')
    await expect(card.getByLabel('To-do item').nth(1)).toBeFocused()
    await page.keyboard.type('two')
    await page.keyboard.press('Alt+ArrowUp')
    await expect(card.getByLabel('To-do item').first()).toHaveValue('two')
  })

  test('?card= pans to the card and flashes it', async ({ page }) => {
    const id = (await page.locator('[data-card-id]').first().getAttribute('data-card-id'))!
    await page.evaluate((cardId) => {
      history.pushState({}, '', `/dev/canvas?cards=1&card=${cardId}`)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, id)
    const card = page.locator(`[data-card-id="${id}"]`)
    await expect(card).toHaveAttribute('data-flash', 'true')
    const c = (await page.getByTestId('canvas').boundingBox())!
    const b = (await card.boundingBox())!
    expect(Math.abs(b.x + b.width / 2 - (c.x + c.width / 2))).toBeLessThan(4)
    expect(Math.abs(b.y + b.height / 2 - (c.y + c.height / 2))).toBeLessThan(4)
    await expect(page).not.toHaveURL(/card=/)
    await expect(card).not.toHaveAttribute('data-flash', 'true', { timeout: 3000 })
  })
})

const task = (o: Record<string, unknown>) => ({
  element_id: 'e1', board_id: 'b1', board_path: [{ id: 'b1', title: 'Spring campaign', icon: null }], card_title: 'Before the shoot',
  item_id: 'i1', item_text: 'Order props', done: false, due: null, item_pos: 1, ...o,
})

async function mockTasks(page: Page, rows: unknown[]) {
  const done: unknown[] = []
  // Stateful like the server: set_task_done changes what the next tasks() returns.
  await page.route('**/rest/v1/rpc/tasks*', (r) => r.fulfill({ json: rows }))
  await page.route('**/rest/v1/rpc/set_task_done*', (r) => {
    const b = r.request().postDataJSON() as { p_item: string; p_done: boolean }
    done.push(b)
    for (const row of rows as { item_id: string; done: boolean }[]) if (row.item_id === b.p_item) row.done = b.p_done
    return r.fulfill({ status: 204 })
  })
  return done
}

test.describe('tasks page', () => {
  test('groups by due date and checks an item from the list', async ({ page }) => {
    const calls = await mockTasks(page, [
      task({ item_id: 'a', item_text: 'Order props', due: day(-3) }),
      task({ item_id: 'b', item_text: 'Colour grade hero', due: day(0), card_title: 'Post-production' }),
      task({ item_id: 'c', item_text: 'Print the shot list', due: day(5) }),
      task({ item_id: 'd', item_text: 'Review brand fonts', card_title: 'This week' }),
      task({ item_id: 'e', item_text: 'Already done', done: true, due: day(2) }),
    ])
    await page.goto('/dev/tasks')
    for (const g of ['overdue', 'today', 'upcoming', 'none']) await expect(page.getByTestId(`group-${g}`)).toBeVisible()
    await expect(page.getByText('Already done')).toHaveCount(0)
    await page.screenshot(shot('tasks-populated'))

    await page.getByRole('checkbox', { name: /Order props/ }).click()
    await expect.poll(() => calls).toEqual([{ p_element: 'e1', p_item: 'a', p_done: true }])
    // completed items leave the list unless "Show completed" is on
    await expect(page.getByTestId('group-overdue')).toHaveCount(0)
    await page.getByRole('switch', { name: 'Show completed' }).click()
    await expect(page.getByText('Already done')).toBeVisible()
  })

  test('row links to the card on its board', async ({ page }) => {
    await mockTasks(page, [task({ item_id: 'a', due: day(1) })])
    await page.goto('/dev/tasks')
    await expect(page.getByRole('link', { name: /Order props/ })).toHaveAttribute('href', '/b/b1?card=e1')
  })

  test('empty state', async ({ page }) => {
    await mockTasks(page, [])
    await page.goto('/dev/tasks')
    await expect(page.getByTestId('tasks-empty')).toContainText('No tasks with due dates')
    await page.screenshot(shot('tasks-empty'))
  })
})
