import { expect, openPage, test } from './fixtures.ts'

test('전체 메뉴: 대화상자 안에 초점을 가두고, Esc로 닫으면 여는 버튼으로 돌아옵니다', async ({
  page,
}) => {
  await openPage(page, '/')
  const toggle = page.getByRole('button', { name: '전체 메뉴 열기' })
  await toggle.click()
  const dialog = page.getByRole('dialog', { name: '전체 메뉴' })
  await expect(dialog).toBeVisible()
  // 모달 대화상자 밖의 페이지 요소로는 초점이 가지 않습니다 (브라우저 주소창으로 나가는 것은 허용).
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab')
    const onBackground = await page.evaluate(() => {
      const el = document.activeElement
      return Boolean(el && el !== document.body && !el.closest('dialog'))
    })
    expect(onBackground).toBe(false)
  }
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(toggle).toBeFocused()
})

test('메뉴에서 화면을 옮기면 메뉴가 닫히고 새 화면 제목으로 초점이 갑니다', async ({ page }) => {
  await openPage(page, '/')
  await page.getByRole('button', { name: '전체 메뉴 열기' }).click()
  await page.getByRole('dialog').getByRole('link', { name: /안내/ }).click()
  await expect(page).toHaveURL(/\/guide$/)
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByRole('heading', { level: 1, name: '조합의 원리' })).toBeFocused()
  await expect(page).toHaveTitle(/안내/)
})
