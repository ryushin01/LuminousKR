import AxeBuilder from '@axe-core/playwright'
import { ROUTES, axeViolations, expect, openPage, test } from './fixtures.ts'

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

test('작업실 영문 글자 화면: axe 위반 없음', async ({ page, consoleErrors }) => {
  await openPage(page, '/studio?char=g')
  await expect(page.getByRole('application', { name: '소문자 g 그리기 판' })).toBeVisible()
  await page.waitForTimeout(600)
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([])
  expect(consoleErrors).toEqual([])
})

test('본문 바로가기는 첫 Tab에 나타나고 누르면 본문으로 초점이 옮겨 갑니다', async ({
  page,
  browserName,
}) => {
  // Safari(WebKit)는 설정 없이는 Tab으로 링크에 초점을 주지 않습니다(Option+Tab). 크로미움에서 봅니다.
  test.skip(browserName === 'webkit', 'Safari는 설정 없이 Tab으로 링크에 가지 않음')
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

test('Ark UI 조작 부품(슬라이더·세그먼트·탭): 레이블, 키보드, 초점 표시, 24px 이상 조작 크기', async ({
  page,
  consoleErrors,
}) => {
  await openPage(page, '/studio')
  // 슬라이더: 레이블로 찾고, Tab으로 손잡이에 가면 초점 외곽선이 보이며 화살표로 값이 바뀝니다.
  const weight = page.getByRole('slider', { name: '굵기' })
  await expect(weight).toHaveAttribute('aria-valuetext', '76 단위')
  await weight.focus()
  await page.keyboard.press('ArrowRight')
  await expect(weight).toHaveAttribute('aria-valuenow', '77')
  await expect(weight).toHaveAttribute('aria-valuetext', '77 단위')
  await page.keyboard.press('ArrowLeft')
  await expect(weight).toHaveAttribute('aria-valuenow', '76')
  expect(await weight.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid')
  // 손잡이의 누르는 자리(::before)는 24×24px 이상입니다.
  const hit = await weight.evaluate((el) => {
    const style = getComputedStyle(el, '::before')
    const box = el.getBoundingClientRect()
    const inset = -parseFloat(style.top)
    return { width: box.width + inset * 2, height: box.height + inset * 2 }
  })
  expect(hit.width).toBeGreaterThanOrEqual(24)
  expect(hit.height).toBeGreaterThanOrEqual(24)

  // 세그먼트: 이름 붙은 라디오 묶음이고 화살표로 고르며, 초점이 간 항목에 외곽선이 보입니다.
  const caps = page.getByRole('radiogroup', { name: '획 끝 모양' })
  await caps.getByRole('radio', { name: '둥근 끝' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(caps.getByRole('radio', { name: '각진 끝' })).toBeChecked()
  await expect(caps.getByRole('radio', { name: '각진 끝' })).toBeFocused()
  const face = caps.locator('[data-part="item"][data-state="checked"] [data-part="item-text"]')
  expect(await face.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid')
  const size = await face.boundingBox()
  expect(size!.height).toBeGreaterThanOrEqual(24)

  // 탭: 화살표로 옮기면 바로 골라지고 그 패널이 보입니다(자동 활성화).
  const role = page.getByRole('tablist', { name: '자모·글자 갈래' })
  await role.getByRole('tab', { name: /초성/ }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(role.getByRole('tab', { name: /중성/ })).toBeFocused()
  await expect(role.getByRole('tab', { name: /중성/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tabpanel', { name: /중성/ })).toBeVisible()
  await page.keyboard.press('End')
  await expect(role.getByRole('tab', { name: /숫자·기호/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page.keyboard.press('Home')
  await expect(role.getByRole('tab', { name: /초성/ })).toHaveAttribute('aria-selected', 'true')

  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
  expect(results.violations.map((v) => v.id)).toEqual([])
  expect(consoleErrors).toEqual([])
})

test.describe('상태별 axe 위반 없음', () => {
  test('전체 메뉴를 연 상태', async ({ page, consoleErrors }) => {
    await openPage(page, '/')
    await page.getByRole('button', { name: '전체 메뉴 열기' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    expect(await axeViolations(page)).toEqual([])
    expect(consoleErrors).toEqual([])
  })

  test('내보내기: 입력 오류(글꼴 이름 비움)와 빈 자모 안내', async ({ page, consoleErrors }) => {
    await openPage(page, '/studio')
    await page.getByRole('button', { name: '빈 글꼴로 시작' }).click()
    await openPage(page, '/export')
    await expect(page.getByText(/획이 없는 자모가 24개 있어/)).toBeVisible()
    const family = page.getByRole('textbox', { name: /글꼴 이름 \(영문\)/ })
    await family.fill('')
    await page.getByRole('button', { name: '글꼴 파일 만들기' }).click()
    await expect(family).toHaveAttribute('aria-invalid', 'true')
    expect(await axeViolations(page)).toEqual([])
    expect(consoleErrors).toEqual([])
  })

  test('작업실: 빈 글꼴에서 획을 그리는 중', async ({ page, consoleErrors }) => {
    await openPage(page, '/studio')
    await page.getByRole('button', { name: '빈 글꼴로 시작' }).click()
    const canvas = page.getByRole('application', { name: 'ㄱ 초성 그리기 판' })
    await canvas.focus()
    await page.keyboard.press('Space')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Space')
    expect(await axeViolations(page)).toEqual([])
    expect(consoleErrors).toEqual([])
  })
})
