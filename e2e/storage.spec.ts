import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { expect, openPage, test, setSlider } from './fixtures.ts'

const PROJECT_KEY = 'luminous-kr:project:v1'

/**
 * 저장된 프로젝트의 ㄱ 초성 획 수와 굵기. 프로젝트가 아닌 원문(읽지 못하는 형식 등)이면 null이라,
 * expect.poll이 예외로 멈추지 않고 저장(잠금을 받은 뒤 비동기로 씀)을 기다립니다.
 */
const saved = (page: Page) =>
  page.evaluate((key) => {
    const project = JSON.parse(localStorage.getItem(key) ?? 'null') as {
      jamo?: { L0?: { base?: { strokes: unknown[] } } }
      style?: { weight: number }
    } | null
    return project?.jamo && project.style
      ? { L0: project.jamo.L0?.base?.strokes.length, weight: project.style.weight }
      : null
  }, PROJECT_KEY)

/** 보관 열쇠들(원문마다 하나)에 있는 원문 (보관한 차례대로) */
const keptTexts = (page: Page) =>
  page.evaluate((key) => {
    const prefix = `${key}:unreadable:`
    return Object.keys(localStorage)
      .filter((name) => name.startsWith(prefix))
      .sort()
      .map((name) => localStorage.getItem(name))
  }, PROJECT_KEY)

/** 그리기 판에서 키보드로 ㄱ에 짧은 획 하나를 더합니다. */
async function drawStroke(page: Page) {
  await page.getByRole('application').focus()
  for (const key of ['ArrowLeft', 'Space', 'ArrowDown', 'Space', 'Enter']) {
    await page.keyboard.press(key)
  }
}

test('여러 탭: 한 탭에서 그린 획을 다른 탭이 받아 맞추고, 그 탭의 저장이 덮어쓰지 않습니다', async ({
  context,
  page,
  consoleErrors,
}) => {
  await openPage(page, '/studio')
  const other = await context.newPage()
  await openPage(other, '/preview')

  await drawStroke(page)
  await expect.poll(() => saved(page)).toEqual({ L0: 2, weight: 76 })
  await expect(
    other.getByRole('status').filter({ hasText: '다른 탭에서 바뀐 작업을 불러왔습니다' }),
  ).toBeVisible()

  // 미리보기 탭에서 굵기를 바꿔도 작업실 탭에서 그린 획이 남습니다.
  await setSlider(other.getByRole('slider', { name: '굵기' }), 120)
  await expect.poll(() => saved(other)).toEqual({ L0: 2, weight: 120 })
  // 작업실 탭도 바뀐 굵기를 받습니다.
  await expect(page.getByRole('slider', { name: '굵기' })).toHaveAttribute('aria-valuenow', '120')
  await page.reload()
  await expect(page.getByRole('slider', { name: '굵기' })).toHaveAttribute('aria-valuenow', '120')
  expect(await saved(page)).toEqual({ L0: 2, weight: 120 })
  await other.close()
  expect(consoleErrors).toEqual([])
})

test('자동 저장에 실패하면 원인과 할 일을 알립니다', async ({ page }) => {
  await page.addInitScript((key) => {
    const setItem = Storage.prototype.setItem
    Storage.prototype.setItem = function (name: string, value: string) {
      if (name === key) throw new DOMException('가득 참', 'QuotaExceededError')
      return setItem.call(this, name, value)
    }
  }, PROJECT_KEY)
  await openPage(page, '/studio')
  await setSlider(page.getByRole('slider', { name: '굵기' }), 120)
  const alert = page.getByRole('alert').filter({ hasText: '자동 저장하지 못했습니다' })
  // 0.4초 뒤 저장을 시도해야 나타나므로, 바쁜 기기에서도 넉넉히 기다립니다.
  await expect(alert).toBeVisible({ timeout: 15_000 })
  await expect(alert).toContainText('프로젝트 파일(.json)로 저장해 두세요')
})

test('읽지 못한 저장은 지우지 않고 보관해, 받거나 지울 수 있습니다', async ({ page }) => {
  const broken = JSON.stringify({ format: 'luminous-kr', version: 99, note: '나중 판 형식' })
  await page.addInitScript(
    ({ key, text }) => {
      if (sessionStorage.getItem('seeded')) return
      localStorage.setItem(key, text)
      sessionStorage.setItem('seeded', '1')
    },
    { key: PROJECT_KEY, text: broken },
  )
  await openPage(page, '/studio')
  await expect(page.getByRole('alert').filter({ hasText: '따로 보관했으니' })).toBeVisible()

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '보관한 작업 받기' }).click(),
  ])
  expect(readFileSync((await download.path())!, 'utf8')).toBe(broken)

  // 새로 고쳐도 보관한 작업은 남아 있고, 지우면 사라집니다.
  await page.reload()
  await expect(page.getByRole('button', { name: '보관한 작업 받기' })).toBeVisible()
  await page.getByRole('button', { name: '보관한 작업 지우기' }).click()
  await expect(page.getByRole('button', { name: '보관한 작업 받기' })).toHaveCount(0)
  expect(await keptTexts(page)).toEqual([])
})

test('바꾸고 바로 탭을 닫아도 마지막 변경이 저장됩니다', async ({ context, page }) => {
  await openPage(page, '/studio')
  await setSlider(page.getByRole('slider', { name: '굵기' }), 133)
  await page.close({ runBeforeUnload: true })
  const next = await context.newPage()
  await openPage(next, '/studio')
  await expect(next.getByRole('slider', { name: '굵기' })).toHaveAttribute('aria-valuenow', '133')
})

test('읽지 못한 저장을 보관할 공간이 없으면, 받아 두고 버리기 전까지 자동 저장이 덮어쓰지 않습니다', async ({
  page,
}) => {
  const broken = '{"format":"luminous-kr","version":99}'
  await page.addInitScript(
    ({ key, text }) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem(key, text)
        sessionStorage.setItem('seeded', '1')
      }
      // 보관 열쇠에 쓸 공간이 없는 상황
      const setItem = Storage.prototype.setItem
      Storage.prototype.setItem = function (name: string, value: string) {
        if (name.startsWith(`${key}:unreadable:`)) {
          throw new DOMException('가득 참', 'QuotaExceededError')
        }
        return setItem.call(this, name, value)
      }
    },
    { key: PROJECT_KEY, text: broken },
  )
  await openPage(page, '/studio')
  await expect(page.getByRole('alert').filter({ hasText: '자동 저장을 멈췄습니다' })).toBeVisible()
  await setSlider(page.getByRole('slider', { name: '굵기' }), 120)
  await page.waitForTimeout(700)
  expect(await page.evaluate((key) => localStorage.getItem(key), PROJECT_KEY)).toBe(broken)

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '원래 작업 받기' }).click(),
  ])
  expect(readFileSync((await download.path())!, 'utf8')).toBe(broken)
  // 받기만으로는 놓지 않습니다(브라우저가 내려받기를 막아도 알 수 없음). 버려야 멈춰 있던 변경을 씁니다.
  await page.waitForTimeout(500)
  expect(await page.evaluate((key) => localStorage.getItem(key), PROJECT_KEY)).toBe(broken)
  await page.getByRole('button', { name: '원래 작업 버리기' }).click()
  await expect.poll(() => saved(page)).toMatchObject({ weight: 120 })
  await expect(page.getByRole('button', { name: '원래 작업 받기' })).toHaveCount(0)
})

test('다른 탭이 읽지 못하는 형식(더 새 버전)으로 저장하면, 이 탭은 덮어쓰지 않도록 자동 저장을 멈춥니다', async ({
  context,
  page,
}) => {
  // 전에 읽지 못해 보관해 둔 원문이 이미 있는 상황
  const kept = '{"format":"luminous-kr","version":5,"note":"전에 보관한 작업"}'
  await page.addInitScript(
    ({ key, text }) => {
      if (sessionStorage.getItem('seeded')) return
      localStorage.setItem(`${key}:unreadable:0000000001-seed`, text)
      sessionStorage.setItem('seeded', '1')
    },
    { key: PROJECT_KEY, text: kept },
  )
  await openPage(page, '/studio')
  const newer = '{"format":"luminous-kr","version":3,"note":"더 새 버전"}'
  const other = await context.newPage()
  await other.goto('about:blank')
  await other.goto(page.url().replace(/\/studio.*$/, '/no-such-page'))
  await other.evaluate(({ key, text }) => localStorage.setItem(key, text), {
    key: PROJECT_KEY,
    text: newer,
  })
  await expect(
    page.getByRole('alert').filter({ hasText: '이 탭의 자동 저장을 멈췄습니다' }),
  ).toBeVisible()
  await setSlider(page.getByRole('slider', { name: '굵기' }), 120)
  await page.waitForTimeout(700)
  expect(await page.evaluate((key) => localStorage.getItem(key), PROJECT_KEY)).toBe(newer)
  await other.close()

  // 새로 고쳐도(이 빌드는 그 형식을 읽지 못함) 전에 보관한 원문은 덮이지 않고 둘 다 남습니다.
  await page.getByRole('button', { name: '새로 고침' }).click()
  // 원문이 둘이라 하나씩 받습니다(한 번에 여러 파일을 받으면 브라우저가 막을 수 있음).
  await expect(page.getByRole('button', { name: '보관한 작업 1 받기' })).toBeVisible()
  await expect(page.getByRole('button', { name: '보관한 작업 2 받기' })).toBeVisible()
  expect(await keptTexts(page)).toEqual([kept, newer])
})
