import { type Locator, type Page, expect, test as base } from '@playwright/test'

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
  { path: '/import', title: '가져오기' },
  { path: '/preview', title: '미리보기' },
  { path: '/export', title: '내보내기' },
  { path: '/guide', title: '안내' },
  { path: '/no-such-page', title: '없는 화면' },
] as const

/**
 * 슬라이더(Ark UI, role="slider")를 키보드로 값에 맞춥니다. 네이티브 range가 아니라 fill()을 쓸 수 없어
 * Home으로 가장 작은 값에 간 뒤 PageUp(한 칸의 10배)과 오른쪽 화살표로 올립니다.
 */
export async function setSlider(slider: Locator, value: number, step = 1): Promise<void> {
  const min = Number(await slider.getAttribute('aria-valuemin'))
  await slider.focus()
  await slider.press('Home')
  const large = step * 10
  const pages = Math.floor((value - min) / large)
  for (let i = 0; i < pages; i++) await slider.press('PageUp')
  const rest = Math.round((value - min - pages * large) / step)
  for (let i = 0; i < rest; i++) await slider.press('ArrowRight')
  await expect(slider).toHaveAttribute('aria-valuenow', String(value))
}
