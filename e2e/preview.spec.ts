import { expect, openPage, test } from './fixtures.ts'

test('입력한 글을 그 글자만 담은 글꼴 파일로 그립니다', async ({ page, consoleErrors }) => {
  await openPage(page, '/preview')
  await expect(page.getByRole('status').filter({ hasText: '글꼴 파일(' })).toBeVisible({
    timeout: 15_000,
  })
  await page.getByRole('textbox', { name: '미리 볼 글' }).fill('빛나는 한글')
  await expect(page.getByRole('status').filter({ hasText: '한글 5자' })).toBeVisible({
    timeout: 15_000,
  })
  expect(consoleErrors).toEqual([])
})

test('초성을 바꿔 588자 표를 봅니다', async ({ page }) => {
  await openPage(page, '/preview')
  await page.getByRole('combobox', { name: '초성' }).selectOption({ label: 'ㅎ (히읗)' })
  const table = page.getByRole('table', { name: /초성 ㅎ 음절 588자/ })
  await expect(table.locator('tbody td')).toHaveCount(588)
  await expect(table.getByText('힣')).toBeAttached()
})
