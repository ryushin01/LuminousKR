import { ROUTES, expect, openPage, test } from './fixtures.ts'

const WIDTHS = [320, 390, 768, 1024, 1440]

for (const width of WIDTHS) {
  test(`가로 ${width}px: 모든 화면에 가로 넘침이 없습니다`, async ({ page, consoleErrors }) => {
    await page.setViewportSize({ width, height: 900 })
    for (const route of ROUTES) {
      await openPage(page, route.path)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      )
      expect(overflow, `${route.path} 가로 넘침(px)`).toBeLessThanOrEqual(0)
    }
    expect(consoleErrors).toEqual([])
  })
}
