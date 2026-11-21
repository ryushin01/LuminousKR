import AxeBuilder from '@axe-core/playwright'
import { ROUTES, expect, openPage, test } from './fixtures.ts'

/**
 * 인터넷 없이(localhost 밖 요청을 모두 막고) 처음 연 화면도 모두 뜨는지 봅니다.
 * 글꼴·워커·WASM이 모두 사이트 안에 있어 외부로 나가는 요청이 없어야 합니다.
 * (한 번 연 뒤 연결이 끊긴 경우는 offline.spec.ts가 서비스 워커로 봅니다.)
 */
test.beforeEach(async ({ context }) => {
  await context.route(
    (url) => url.hostname !== 'localhost' && url.hostname !== '127.0.0.1',
    (route) => route.abort('internetdisconnected'),
  )
})

for (const route of ROUTES) {
  test(`${route.title}: 인터넷 없이도 뜨고 외부 요청·axe 위반이 없음`, async ({
    page,
    consoleErrors,
  }) => {
    const external: string[] = []
    page.on('request', (req) => {
      const { hostname } = new URL(req.url())
      if (hostname !== 'localhost' && hostname !== '127.0.0.1' && req.url().startsWith('http'))
        external.push(req.url())
    })
    await openPage(page, route.path)
    await expect(page).toHaveTitle(new RegExp(route.title))
    await page.waitForTimeout(600)
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(
      results.violations.map(
        (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
      ),
    ).toEqual([])
    expect(external, '외부 요청').toEqual([])
    expect(consoleErrors).toEqual([])
  })
}
