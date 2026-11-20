import { devices } from '@playwright/test'
import { expect, openPage, test } from './fixtures.ts'

// 휴대폰처럼 좁은 화면에서 손가락으로 그립니다(터치 입력).
const { viewport, deviceScaleFactor, isMobile, hasTouch, userAgent } = devices['Pixel 7']
test.use({ viewport, deviceScaleFactor, isMobile, hasTouch, userAgent })

test('손가락으로 점을 찍고, 조금 어긋나게 두 번 톡 쳐도 점을 더하지 않고 획을 마칩니다', async ({
  page,
}) => {
  await openPage(page, '/studio')
  await page.getByRole('button', { name: '빈 글꼴로 시작' }).click()
  // 격자에 맞추면 어긋난 두 톡이 같은 점이 되므로, 끄고 봅니다.
  await page.getByRole('checkbox', { name: '격자에 맞추기' }).uncheck()
  const svg = page.getByRole('application', { name: 'ㄱ 초성 그리기 판' }).locator('svg')
  await svg.scrollIntoViewIfNeeded()
  const box = (await svg.boundingBox())!
  const tap = (x: number, y: number, dx = 0) =>
    page.touchscreen.tap(box.x + box.width * x + dx, box.y + box.height * y)
  await tap(0.2, 0.3)
  await tap(0.45, 0.3)
  await tap(0.45, 0.7)
  await tap(0.45, 0.7, 6) // 손가락이 6px 어긋남
  const list = page.locator('section', { hasText: '획 목록' })
  await expect(list.getByText('직선, 점 3개')).toBeVisible()

  // 마친 뒤에 다시 톡 치면 새 획을 시작합니다.
  await page.waitForTimeout(400)
  await tap(0.7, 0.3)
  await tap(0.7, 0.6)
  await tap(0.7, 0.6, -5)
  await expect(list.getByText('직선, 점 2개')).toBeVisible()
  await expect(list.getByText('직선, 점 3개')).toBeVisible()
})
