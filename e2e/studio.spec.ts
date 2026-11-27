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
  // 도구를 키보드로 고르면 초점이 라디오에 남습니다(Safari는 눌러서 고른 라디오에는 초점을 주지 않음).
  const curve = page.getByRole('radio', { name: '곡선' })
  await curve.focus()
  await page.keyboard.press('Space')
  await expect(curve).toBeChecked()
  await expect(curve).toBeFocused()
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

test('영문·숫자·기호 탭에서 글자를 골라 기본 뼈대를 고치고, 너비를 바꾸고, 되돌립니다', async ({
  page,
  consoleErrors,
}) => {
  await page.getByRole('tab', { name: /영문/ }).click()
  await page.getByRole('radio', { name: /대문자 A/ }).check()
  await expect(page).toHaveURL(/\/studio\?char=A$/)
  await expect(page.getByRole('application', { name: '대문자 A 그리기 판' })).toBeVisible()
  // 기본 뼈대는 바로 고칠 수 없고, '직접 고치기'로 가져온 뒤 고칩니다.
  await page.getByRole('button', { name: '직접 고치기' }).click()
  const list = page.locator('section', { hasText: '획 목록' })
  await expect(list.getByText(/^직선, 점 /)).toHaveCount(2)
  // 너비: 키보드로 한 칸 넓히면 그 글자의 너비(글꼴 단위)가 커집니다.
  const width = page.getByRole('slider', { name: '이 글자의 너비' })
  await expect(width).toHaveAttribute('aria-valuenow', '64')
  const before = Number((await width.getAttribute('aria-valuetext'))!.replace(/\D/g, ''))
  await width.focus()
  await page.keyboard.press('ArrowRight')
  await expect(width).toHaveAttribute('aria-valuenow', '65')
  const after = Number((await width.getAttribute('aria-valuetext'))!.replace(/\D/g, ''))
  expect(after).toBeGreaterThan(before)
  await page.getByRole('button', { name: '기본 뼈대로 되돌리기' }).click()
  await expect(page.getByRole('button', { name: '직접 고치기' })).toBeVisible()
  // 주소로 기호를 엽니다(@ = %40). 그 글자가 든 탭이 골라져 있습니다.
  await openPage(page, '/studio?char=%40')
  await expect(page.getByRole('application', { name: '골뱅이 @ 그리기 판' })).toBeVisible()
  await expect(page.getByRole('tab', { name: /숫자·기호/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.getByRole('radio', { name: /골뱅이 @/ })).toBeChecked()
  // 자모를 고르면 자모 편집으로 돌아가고 주소도 바뀝니다.
  await page.getByRole('tab', { name: /초성/ }).click()
  await page.getByRole('radio', { name: /^ㄴ/ }).check()
  await expect(page).toHaveURL(/\/studio\?jamo=L2$/)
  await expect(page.getByRole('application', { name: 'ㄴ 초성 그리기 판' })).toBeVisible()
  expect(consoleErrors).toEqual([])
})
