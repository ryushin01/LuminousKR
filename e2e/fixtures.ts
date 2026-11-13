import { type Page, expect, test as base } from '@playwright/test'

/** 화면 낭독기·키보드 검사에 무관한 소프트웨어 WebGL 성능 경고 */
const IGNORED_CONSOLE = [/GPU stall due to ReadPixels/, /GL Driver Message/]

/** 콘솔 오류가 없어야 하는 테스트 */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = []
    page.on('console', (message) => {
      if (message.type() !== 'error') return
      if (IGNORED_CONSOLE.some((pattern) => pattern.test(message.text()))) return
      errors.push(message.text())
    })
    page.on('pageerror', (error) => errors.push(error.message))
    await use(errors)
    expect(errors, '콘솔 오류').toEqual([])
  },
})

export { expect }

/** 화면이 그려질 때까지 기다립니다 (지연 로딩 화면의 h1). */
export async function openPage(page: Page, path: string): Promise<void> {
  await page.goto(path)
  await expect(page.locator('main h1')).toBeVisible()
}

export const ROUTES = [
  { path: '/', title: '한글 모듈 글꼴 조합기' },
  { path: '/studio', title: '작업실' },
  { path: '/preview', title: '미리보기' },
  { path: '/export', title: '내보내기' },
  { path: '/guide', title: '안내' },
  { path: '/no-such-page', title: '없는 화면' },
] as const
