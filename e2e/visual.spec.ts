import { type Page, expect, test } from '@playwright/test'
import { ROUTES, openPage } from './fixtures.ts'

/**
 * 시각 회귀: 주요 화면(넓은·좁은 화면)과 Storybook 스토리를 기준 그림과 비교합니다.
 * 기준 그림은 Linux CI(ubuntu-latest, 크로미움)에서 만든 것이라(글꼴 렌더링이 OS마다 다름) Linux에서만 돕니다.
 * 기준 그림 다시 만들기: CI가 실패하면 올린 리포트(playwright-report)의 실제 그림을 확인하고,
 * Linux에서 `pnpm exec playwright test e2e/visual.spec.ts --project=chromium --update-snapshots`.
 * WebGL 배경은 visual.css로 숨기고, 판 번호(vX.Y.Z)는 가립니다.
 */
test.skip(
  process.platform !== 'linux' && !process.env.VISUAL,
  '기준 그림은 Linux CI 결과라 Linux에서만 비교합니다',
)
test.skip(({ browserName }) => browserName !== 'chromium', '시각 비교는 크로미움으로만 합니다')

const STYLE = 'e2e/visual.css'
const versionMask = (page: Page) => [page.getByText(/v\d+\.\d+\.\d+/)]

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  // 워커가 그린 글리프까지 나온 뒤에 찍습니다.
  await page.waitForTimeout(800)
}

for (const [label, viewport] of [
  ['desktop', { width: 1280, height: 800 }],
  ['mobile', { width: 390, height: 844 }],
] as const) {
  test.describe(`화면(${label})`, () => {
    test.use({ viewport })
    for (const route of ROUTES) {
      test(`${route.title}`, async ({ page }) => {
        await openPage(page, route.path)
        await settle(page)
        await expect(page).toHaveScreenshot(
          `${label}-${route.path === '/' ? 'home' : route.path.slice(1)}.png`,
          {
            mask: versionMask(page),
            stylePath: STYLE,
          },
        )
      })
    }
  })
}

type StoryIndex = { entries: Record<string, { id: string; type: string }> }

test('Storybook 스토리', async ({ page, request }) => {
  test.setTimeout(240_000)
  const index = (await (await request.get('/storybook/index.json')).json()) as StoryIndex
  const stories = Object.values(index.entries).filter((entry) => entry.type === 'story')
  for (const story of stories) {
    await test.step(story.id, async () => {
      await page.goto(`/storybook/iframe.html?id=${story.id}&viewMode=story`)
      const root = page.locator('#storybook-root')
      await root.locator('> *').first().waitFor({ state: 'attached' })
      await settle(page)
      await expect.soft(root).toHaveScreenshot(`story-${story.id}.png`, {
        mask: versionMask(page),
        stylePath: STYLE,
      })
    })
  }
})
