import { expect, type Page, test } from '@playwright/test'
import { CATALOG } from '../src/catalog'

test.describe('every mockup renders the sample logo the same way', () => {
  test.describe.configure({ mode: 'serial' })
  let page: Page

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(300_000)
    page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })
    await page.goto('/#/test')
    await page.waitForSelector('[data-harness-done=true]', { timeout: 290_000 })
  })

  test.afterAll(() => page.close())

  for (const item of CATALOG) {
    test(item.id, async () => {
      const card = page.locator(`[data-test-item="${item.id}"]`)
      await expect(card.locator('[data-error]')).toHaveCount(0)
      await expect(card.locator('img')).toHaveScreenshot(`${item.id}.png`)
    })
  }
})

test('grid fills thumbnails after loading the sample logo', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /sample/i }).click()
  await expect(page.locator('[data-item]')).toHaveCount(CATALOG.length)
  await expect(page.locator('[data-item="crew-tee"]')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 })
})

test('detail view drags the design and exports a PNG', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /sample/i }).click()
  await page.goto('/#/item/crew-tee')
  const stage = page.getByTestId('detail-stage')
  await expect(stage.locator('canvas')).toBeVisible()
  await page.waitForTimeout(1500)

  const box = (await stage.boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + box.height * 0.45
  await page.mouse.move(x, y)
  await page.mouse.down()
  for (let i = 1; i <= 8; i++) await page.mouse.move(x + 4 * i, y + 3 * i)
  await page.mouse.up()
  await expect(page.getByLabel('Horizontal', { exact: true })).not.toHaveValue('0')

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('detail-download').click()])
  expect(download.suggestedFilename()).toMatch(/crew-tee\.png$/)
})
