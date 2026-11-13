import AxeBuilder from '@axe-core/playwright'
import { ROUTES, expect, openPage, test } from './fixtures.ts'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

for (const route of ROUTES) {
  test(`${route.title}: axe 위반 없음, 언어·제목·h1`, async ({ page, consoleErrors }) => {
    await openPage(page, route.path)
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko')
    await expect(page).toHaveTitle(new RegExp(route.title))
    await expect(page.locator('h1')).toHaveCount(1)
    // 워커가 그린 글리프까지 나온 뒤에 검사합니다.
    await page.waitForTimeout(600)
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
    expect(
      results.violations.map(
        (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
      ),
    ).toEqual([])
    expect(consoleErrors).toEqual([])
  })
}

test('본문 바로가기는 첫 Tab에 나타나고 누르면 본문으로 초점이 옮겨 갑니다', async ({ page }) => {
  await openPage(page, '/guide')
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: '본문 바로가기' })
  await expect(skip).toBeFocused()
  await expect(skip).toBeInViewport()
  await page.keyboard.press('Enter')
  await expect(page.locator('main#main')).toBeFocused()
})

test('배경 움직임 멈추기·재생 버튼 (동작 줄이기 설정이면 처음부터 멈춤)', async ({ page }) => {
  await openPage(page, '/')
  const play = page.getByRole('button', { name: '배경 움직임 재생' })
  await expect(play).toBeVisible()
  await play.click()
  await expect(page.getByRole('button', { name: '배경 움직임 멈추기' })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('luminous-kr:motion-paused'))).toBe('false')
})
