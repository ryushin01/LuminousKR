import AxeBuilder from '@axe-core/playwright'
import {
  type BrowserContext,
  type Locator,
  type Page,
  expect,
  test as base,
} from '@playwright/test'

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

const isLocalHost = (hostname: string) => hostname === 'localhost' || hostname === '127.0.0.1'

/**
 * 인터넷이 없는 것처럼 localhost 밖 요청을 모두 끊고, 끊은 주소를 모읍니다(워커가 보낸 요청 포함).
 * 글꼴·워커·WASM·pdf.js 자료가 모두 사이트 안에 있어야 빈 배열로 남습니다.
 */
export async function blockExternal(context: BrowserContext): Promise<string[]> {
  const blocked: string[] = []
  await context.route(
    // blob:·data: 주소(받은 파일·그림)는 인터넷과 무관합니다(WebKit은 이것도 가로채기로 넘김).
    (url) => /^(https?|wss?):$/.test(url.protocol) && !isLocalHost(url.hostname),
    (route) => {
      blocked.push(route.request().url())
      return route.abort('internetdisconnected')
    },
  )
  return blocked
}

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/** 지금 화면 상태의 axe(WCAG 2.2 AA) 위반을 '규칙: 대상' 목록으로 돌려줍니다. */
export async function axeViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
  return results.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  )
}

/**
 * pdf.js가 남기는 경고(자료를 받지 못함 등)를 모읍니다. pdf.js는 경고를 console.log('Warning: …')로 씁니다.
 * 표준 글꼴·WASM 자료 주소를 주지 않았거나 받지 못하면 여기에 남습니다.
 */
export function collectPdfjsWarnings(page: Page): string[] {
  const warnings: string[] = []
  page.on('console', (message) => {
    if (/^Warning: /.test(message.text())) warnings.push(message.text())
  })
  return warnings
}
