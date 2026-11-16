import { expect, openPage, test } from './fixtures.ts'

test.beforeEach(async ({ page }) => {
  await openPage(page, '/studio')
  await page.getByRole('button', { name: '빈 글꼴로 시작' }).click()
})

test('키보드만으로 획을 그립니다 (화살표·스페이스·Enter)', async ({ page, consoleErrors }) => {
  const canvas = page.getByRole('application', { name: 'ㄱ 초성 그리기 판' })
  await canvas.focus()
  await page.keyboard.press('Space')
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Space')
  await page.keyboard.press('Shift+ArrowDown')
  await page.keyboard.press('Space')
  await page.keyboard.press('Enter')
  const list = page
    .getByRole('region', { name: '획 목록' })
    .or(page.locator('section', { hasText: '획 목록' }))
  await expect(list.getByText('직선, 점 3개')).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: '획을 마쳤습니다' })).toBeVisible()
  expect(consoleErrors).toEqual([])
})

test('포인터로 점을 찍고 두 번 눌러 마치고, Ctrl+Z로 되돌립니다', async ({ page }) => {
  const svg = page.getByRole('application', { name: 'ㄱ 초성 그리기 판' }).locator('svg')
  await svg.scrollIntoViewIfNeeded()
  const box = (await svg.boundingBox())!
  const at = (x: number, y: number) => ({ x: box.x + box.width * x, y: box.y + box.height * y })
  await page.mouse.click(at(0.2, 0.3).x, at(0.2, 0.3).y)
  await page.mouse.click(at(0.45, 0.3).x, at(0.45, 0.3).y)
  await page.mouse.dblclick(at(0.45, 0.7).x, at(0.45, 0.7).y)
  await expect(page.getByText('직선, 점 3개')).toBeVisible()
  await page.keyboard.press('ControlOrMeta+z')
  await expect(page.getByText('직접 그린 획이 없습니다.')).toBeVisible()
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(page.getByText('직선, 점 3개')).toBeVisible()
})

test('자동으로 만드는 자모(ㄲ)는 "직접 그리기"로 가져와 고칩니다', async ({ page }) => {
  await page.getByRole('button', { name: '기본 글꼴로' }).click()
  await page.getByRole('radio', { name: /^ㄲ/ }).check()
  await expect(page.getByText(/자동으로 만들어집니다/)).toBeVisible()
  await page.getByRole('button', { name: '직접 그리기' }).click()
  await expect(page.getByRole('button', { name: '자동으로 되돌리기' })).toBeVisible()
  await expect(page.getByRole('radio', { name: /^ㄲ/ })).toHaveAccessibleName(/직접/)
})

test('작업은 브라우저에 저장되어 새로 고쳐도 남습니다', async ({ page }) => {
  const canvas = page.getByRole('application', { name: 'ㄱ 초성 그리기 판' })
  await canvas.focus()
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Space')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(600)
  await page.reload()
  await expect(page.getByText('직선, 점 2개')).toBeVisible()
})

test('포인터로 점을 찍으면 판에 초점이 가서, 이어서 Enter로 획을 마칩니다', async ({ page }) => {
  const canvas = page.getByRole('application', { name: 'ㄱ 초성 그리기 판' })
  const svg = canvas.locator('svg')
  await svg.scrollIntoViewIfNeeded()
  const box = (await svg.boundingBox())!
  await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.3)
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.3)
  await expect(canvas).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByText('직선, 점 2개')).toBeVisible()
})

test('도구·격자 같은 입력에 초점이 있어도 Ctrl+Z로 되돌립니다', async ({ page }) => {
  const canvas = page.getByRole('application', { name: 'ㄱ 초성 그리기 판' })
  await canvas.focus()
  for (const key of ['Space', 'ArrowRight', 'Space', 'Enter']) await page.keyboard.press(key)
  await expect(page.getByText('직선, 점 2개')).toBeVisible()
  // 도구를 고르면 초점이 라디오에 남습니다.
  await page.getByRole('radio', { name: '곡선' }).check()
  await expect(page.getByRole('radio', { name: '곡선' })).toBeFocused()
  await page.keyboard.press('ControlOrMeta+z')
  await expect(page.getByText('직접 그린 획이 없습니다.')).toBeVisible()
  await page.getByRole('checkbox', { name: '격자에 맞추기' }).focus()
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(page.getByText('직선, 점 2개')).toBeVisible()
})

test('작업실 주소로 자모·배치를 열고, 고르면 주소가 바뀌어 새로 고쳐도 이어집니다', async ({
  page,
}) => {
  await openPage(page, '/studio?jamo=V8')
  await expect(page.getByRole('application', { name: 'ㅗ 중성 그리기 판' })).toBeVisible()
  await page.getByRole('tab', { name: /초성/ }).click()
  await page.getByRole('radio', { name: /^ㄴ/ }).check()
  await expect(page).toHaveURL(/\/studio\?jamo=L2$/)
  await page.getByRole('radio', { name: /각 모양/ }).check()
  await expect(page).toHaveURL(/\/studio\?jamo=L2&layout=D$/)
  await page.reload()
  await expect(page.getByRole('application', { name: 'ㄴ 초성 그리기 판' })).toBeVisible()
  await expect(page.getByRole('radio', { name: /각 모양/ })).toBeChecked()
  // 잘못된 값은 ㄱ 초성·기본 배치로
  await openPage(page, '/studio?jamo=Z9&layout=Q')
  await expect(page.getByRole('application', { name: 'ㄱ 초성 그리기 판' })).toBeVisible()
})
