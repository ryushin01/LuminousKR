import { expect, openPage, test } from './fixtures.ts'

// 다른 시험은 서비스 워커를 막아 두고(요청 가로채기가 영향을 받지 않게), 여기서만 켭니다.
test.use({ serviceWorkers: 'allow' })

// 연결이 없으면 매니페스트·아이콘 같은 비필수 요청은 실패하므로 콘솔 오류는 보지 않고, 화면이 열리는지만 봅니다.
test('한 번 연 뒤에는 연결이 끊겨도 화면이 열리고, 다른 화면으로 옮기고 글꼴도 만들 수 있습니다', async ({
  context,
  page,
}) => {
  // 11,172자 글꼴을 한 번 만듭니다(CI의 WebKit에서는 십수 초).
  test.slow()
  await openPage(page, '/')
  // 서비스 워커가 미리 받기를 마치고 이 페이지를 맡을 때까지 기다립니다.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true)

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: /11,172자가 빛납니다/ })).toBeVisible()

  // 화면 조각은 캐시에서 받습니다.
  await page.getByRole('button', { name: '전체 메뉴 열기' }).click()
  await page
    .getByRole('dialog')
    .getByRole('link', { name: /작업실/ })
    .click()
  await expect(page.getByRole('application', { name: /그리기 판/ })).toBeVisible()

  // 주소로 바로 들어와도 열립니다(화면별 HTML).
  await page.goto('/guide')
  await expect(page.getByRole('heading', { level: 1, name: '조합의 원리' })).toBeVisible()

  // 작업 스레드와 그 모듈도 미리 받아 두어, 연결이 끊겨도 OTF·WOFF를 만듭니다(WOFF2 압축기는 쓸 때 저장).
  await page.goto('/export')
  await page.getByRole('checkbox', { name: /WOFF2/ }).uncheck()
  await page.getByRole('button', { name: '글꼴 파일 만들기' }).click()
  await expect(page.getByRole('button', { name: /WOFF 받기/ })).toBeVisible({ timeout: 90_000 })
  await context.setOffline(false)
})

test('저장 공간이 모자라 캐시에 넣지 못해도, 네트워크에서 받은 응답은 그대로 씁니다', async ({
  context,
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', '서비스 워커 안에서 코드를 돌리는 것은 크로미움만 됨')
  await openPage(page, '/')
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true)
  const [worker] = context.serviceWorkers()
  await worker!.evaluate(() => {
    Cache.prototype.put = () => Promise.reject(new DOMException('가득 참', 'QuotaExceededError'))
  })
  // 아직 캐시에 없는 자산(나머지 글자 조각)을 받습니다. 조각 CSS는 페이지를 다 연 뒤 한가할 때 붙습니다.
  await page.waitForSelector('link[href*="luminous-sans-rest"]', { state: 'attached' })
  const status = await page.evaluate(async () => {
    const link = document.querySelector<HTMLLinkElement>('link[href*="luminous-sans-rest"]')!
    const css = await (await fetch(link.href)).text()
    const slice = /url\(['"]?([^'")]+\.woff2)/.exec(css)![1]!
    const response = await fetch(new URL(slice, link.href))
    return response.status
  })
  expect(status).toBe(200)
})
