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

  await page.unroute(chunk)
  await page.evaluate(() => sessionStorage.removeItem('full'))
  await page.getByRole('main').getByRole('button', { name: '변경을 버리고 새로 고침' }).click()
  await expect(page.getByRole('heading', { level: 1, name: '조합의 원리' })).toBeVisible()
})
