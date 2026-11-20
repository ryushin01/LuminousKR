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

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`가로 ${viewport.width}px: 첫 로딩의 레이아웃 이동(CLS)이 0.02 미만입니다`, async ({
    page,
    browserName,
  }) => {
    // layout-shift 항목은 크로미움만 줍니다(WebKit에서는 늘 0이라 확인이 되지 않음).
    test.skip(browserName !== 'chromium', 'layout-shift는 크로미움만 잼')
    await page.setViewportSize(viewport)
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: number }
      w.__cls = 0
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as (PerformanceEntry & {
          value: number
          hadRecentInput: boolean
        })[]) {
          if (!entry.hadRecentInput) w.__cls += entry.value
        }
      }).observe({ type: 'layout-shift', buffered: true })
    })
    for (const path of ['/', '/studio', '/preview', '/guide']) {
      await openPage(page, path)
      await page.waitForTimeout(800)
      const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls)
      expect(cls, `${path} CLS`).toBeLessThan(0.02)
    }
  })
}

test('화면 주소로 바로 들어오면 그 화면 조각을 HTML에서 미리 받습니다', async ({ request }) => {
  // GitHub Pages는 /studio를 /studio/로 옮겨 studio/index.html을 줍니다.
  for (const [path, chunk] of [
    ['/studio/', 'studio-'],
    ['/export/', 'export-'],
    ['/', 'home-'],
  ] as const) {
    const html = await (await request.get(path)).text()
    expect(html, path).toMatch(new RegExp(`<link rel="modulepreload"[^>]*assets/${chunk}`))
    // 첫 화면 글꼴(제목·본문·머리글 한글, 영문)도 CSS를 기다리지 않고 바로 받습니다.
    for (const font of [
      'luminous-sans-400-ui-',
      'luminous-sans-600-ui-',
      'luminous-sans-700-ui-',
      'syne-latin-wght-normal-',
    ]) {
      expect(html, `${path} ${font}`).toMatch(
        new RegExp(
          `<link rel="preload" as="font" type="font/woff2" crossorigin href="[^"]*assets/${font}`,
        ),
      )
    }
  }
})
