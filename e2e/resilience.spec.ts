import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { openPage } from './fixtures.ts'

// 이 파일의 시험은 일부러 파일 받기를 실패시키므로 콘솔 오류 검사(fixtures의 consoleErrors)를 쓰지 않습니다.

test('배포 뒤처럼 화면 조각을 받지 못하면 오류 화면과 새로 고침 안내를 보이고, 새로 고치면 열립니다', async ({
  page,
}) => {
  await openPage(page, '/')
  const chunk = /\/assets\/studio-[^/]+\.js$/
  await page.route(chunk, (route) => route.fulfill({ status: 404, body: 'Not Found' }))
  await page.getByRole('link', { name: /작업실 열기/ }).click()

  await expect(
    page.getByRole('heading', { level: 1, name: '화면을 불러오지 못했습니다' }),
  ).toBeVisible()
  await expect(
    page.getByRole('alert').filter({ hasText: '앱 파일을 받지 못했습니다' }),
  ).toBeVisible()

  await page.unroute(chunk)
  await page.getByRole('button', { name: '새로 고침' }).first().click()
  await expect(
    page.getByRole('heading', { level: 1, name: '자모의 뼈대를 그립니다' }),
  ).toBeVisible()
  await expect(
    page.getByRole('alert').filter({ hasText: '앱 파일을 받지 못했습니다' }),
  ).toHaveCount(0)
})

test('내보내기에서 작업 스레드를 받지 못하면 다시 누르라는 대신 새로 고침을 안내합니다', async ({
  page,
}) => {
  await openPage(page, '/export')
  await page.route(/engine\.worker-[^/]+\.js$/, (route) =>
    route.fulfill({ status: 404, body: 'Not Found' }),
  )
  await page.getByRole('button', { name: /글꼴 파일 만들기/ }).click()
  await expect(
    page.getByRole('alert').filter({ hasText: '작업 스레드를 불러오지 못했습니다' }),
  ).toBeVisible()
  await expect(
    page.getByRole('alert').filter({ hasText: '앱 파일을 받지 못했습니다' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: '새로 고침' })).toBeVisible()
})

test('되돌리기 단축키는 작업실 밖(미리보기의 획 스타일)에서도 듣습니다', async ({ page }) => {
  await openPage(page, '/preview')
  const weight = page.getByRole('slider', { name: '굵기' })
  await expect(weight).toHaveValue('76')
  await weight.fill('140')
  await expect(weight).toHaveValue('140')
  await page.keyboard.press('ControlOrMeta+z')
  await expect(weight).toHaveValue('76')
})

test('자동 저장하지 못한 변경이 있으면 새로 고치지 않고 알리며, 버리고 새로 고칠 수 있습니다', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const setItem = Storage.prototype.setItem
    Storage.prototype.setItem = function (name: string, value: string) {
      if (name === 'luminous-kr:project:v1' && sessionStorage.getItem('full')) {
        throw new DOMException('가득 참', 'QuotaExceededError')
      }
      return setItem.call(this, name, value)
    }
  })
  await openPage(page, '/preview')
  await page.evaluate(() => sessionStorage.setItem('full', '1'))
  await page.getByRole('slider', { name: '굵기' }).fill('140')
  const chunk = /\/assets\/guide-[^/]+\.js$/
  await page.route(chunk, (route) => route.fulfill({ status: 404, body: 'Not Found' }))
  await page.getByRole('button', { name: '전체 메뉴 열기' }).click()
  await page
    .getByRole('dialog')
    .getByRole('link', { name: /06 안내/ })
    .click()
  await expect(
    page.getByRole('heading', { level: 1, name: '화면을 불러오지 못했습니다' }),
  ).toBeVisible()

  await page.getByRole('main').getByRole('button', { name: '새로 고침' }).click()
  await expect(
    page.getByRole('main').getByRole('alert').filter({ hasText: '자동 저장하지 못한 변경이 있어' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { level: 1, name: '화면을 불러오지 못했습니다' }),
  ).toBeVisible()

  // 저장 공간은 계속 가득 찬 채로 버립니다(버리기가 저장을 거쳐 새로 고치는 것이 아님을 확인).
  await page.unroute(chunk)
  await page.getByRole('main').getByRole('button', { name: '변경을 버리고 새로 고침' }).click()
  await expect(page.getByRole('heading', { level: 1, name: '조합의 원리' })).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('full'))).toBe('1')
})

test('이 탭에만 남은 원래 작업(읽지 못하고 보관하지 못한 저장)이 있으면 새로 고치지 않고 알립니다', async ({
  context,
  page,
}) => {
  const key = 'luminous-kr:project:v1'
  // 다른 탭이 덮어쓸, 읽을 수 있는 작업을 먼저 만듭니다.
  const seed = await context.newPage()
  await openPage(seed, '/preview')
  await seed.getByRole('slider', { name: '굵기' }).fill('130')
  await expect.poll(() => seed.evaluate((name) => localStorage.getItem(name), key)).not.toBeNull()
  const readable = (await seed.evaluate((name) => localStorage.getItem(name), key))!
  await seed.close()

  // 열지 못하는 저장 + 그것을 따로 보관할 공간이 없는 상황 → 원래 자리를 지키려고 자동 저장을 멈춤
  const broken = '{"format":"luminous-kr","version":99}'
  await page.addInitScript(
    ({ name, text }) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem(name, text)
        sessionStorage.setItem('seeded', '1')
      }
      const setItem = Storage.prototype.setItem
      Storage.prototype.setItem = function (item: string, value: string) {
        if (item.startsWith(`${name}:unreadable:`)) {
          throw new DOMException('가득 참', 'QuotaExceededError')
        }
        return setItem.call(this, item, value)
      }
    },
    { name: key, text: broken },
  )
  await openPage(page, '/preview')
  await expect(page.getByRole('alert').filter({ hasText: '자동 저장을 멈췄습니다' })).toBeVisible()

  // 다른 탭(앱을 열지 않은 같은 출처 문서)이 읽을 수 있는 작업으로 덮어써, 원래 작업은 이 탭에만 남습니다.
  const other = await context.newPage()
  await other.goto(new URL('favicon.svg', page.url()).href)
  await other.evaluate(({ name, text }) => localStorage.setItem(name, text), {
    name: key,
    text: readable,
  })
  await other.close()
  await expect(page.getByRole('alert').filter({ hasText: '이 탭을 닫으면 사라지니' })).toBeVisible()

  const chunk = /\/assets\/guide-[^/]+\.js$/
  await page.route(chunk, (route) => route.fulfill({ status: 404, body: 'Not Found' }))
  await page.getByRole('button', { name: '전체 메뉴 열기' }).click()
  await page
    .getByRole('dialog')
    .getByRole('link', { name: /06 안내/ })
    .click()
  await expect(
    page.getByRole('heading', { level: 1, name: '화면을 불러오지 못했습니다' }),
  ).toBeVisible()
  await page.getByRole('main').getByRole('button', { name: '새로 고침' }).click()
  await expect(
    page.getByRole('main').getByRole('alert').filter({ hasText: '이 탭에만 남은 원래 작업' }),
  ).toBeVisible()

  // 받아 둘 수 있고, 받은 뒤 버리고 새로 고칩니다.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '원래 작업 받기' }).click(),
  ])
  expect(readFileSync((await download.path())!, 'utf8')).toBe(broken)
  await page.unroute(chunk)
  await page.getByRole('main').getByRole('button', { name: '원래 작업을 버리고 새로 고침' }).click()
  await expect(page.getByRole('heading', { level: 1, name: '조합의 원리' })).toBeVisible()
})
