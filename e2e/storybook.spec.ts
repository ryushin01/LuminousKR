import AxeBuilder from '@axe-core/playwright'
import { expect, test } from './fixtures.ts'

type StoryIndex = {
  entries: Record<string, { id: string; type: string; title: string; name: string }>
}

test('Storybook의 모든 스토리가 오류 없이 그려지고 axe 위반이 없습니다', async ({
  page,
  request,
}) => {
  test.setTimeout(180_000)
  const response = await request.get('/storybook/index.json')
  expect(response.ok(), 'Storybook 빌드(dist/storybook)가 있어야 합니다').toBe(true)
  const index = (await response.json()) as StoryIndex
  const stories = Object.values(index.entries).filter((entry) => entry.type === 'story')
  expect(stories.length).toBeGreaterThan(20)
  const problems: string[] = []
  for (const story of stories) {
    await page.goto(`/storybook/iframe.html?id=${story.id}&viewMode=story`)
    await page.locator('#storybook-root > *').first().waitFor({ state: 'attached' })
    await page.waitForTimeout(150)
    const results = await new AxeBuilder({ page })
      .include('#storybook-root')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze()
    for (const v of results.violations) problems.push(`${story.title} / ${story.name}: ${v.id}`)
  }
  expect(problems).toEqual([])
})
