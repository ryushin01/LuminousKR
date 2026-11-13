import { readFileSync } from 'node:fs'
import { expect, openPage, test } from './fixtures.ts'

test('11,172자 글꼴을 만들고 OTF·WOFF 파일을 받습니다 (두 번 눌러도 한 번만)', async ({
  page,
  consoleErrors,
}) => {
  await openPage(page, '/export')
  const submit = page.getByRole('button', { name: '글꼴 파일 만들기' })
  await submit.dblclick()
  // 만드는 동안 버튼이 초점을 잃지 않습니다 (disabled 대신 aria-disabled).
  await expect(page.getByRole('button', { name: '만드는 중…' })).toBeFocused()
  const otfButton = page.getByRole('button', { name: /OTF 받기/ })
  await expect(otfButton).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('status').filter({ hasText: '글리프 11,225개' })).toBeVisible()

  const [otf] = await Promise.all([page.waitForEvent('download'), otfButton.click()])
  const otfBytes = readFileSync((await otf.path())!)
  expect(otf.suggestedFilename()).toBe('Luminous-Modular-Regular.otf')
  expect(otfBytes.subarray(0, 4).toString('latin1')).toBe('OTTO')
  expect(otfBytes.length).toBeGreaterThan(2_000_000)

  const [woff] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /WOFF 받기/ }).click(),
  ])
  const woffBytes = readFileSync((await woff.path())!)
  expect(woffBytes.subarray(0, 4).toString('latin1')).toBe('wOFF')
  expect(woffBytes.length).toBeLessThan(otfBytes.length)

  await expect(
    page.getByText('방금 만든 글꼴 파일을 이 화면에 등록해 그린 글입니다.'),
  ).toBeVisible()
  expect(consoleErrors).toEqual([])
})

test('글꼴 이름을 비우고 만들면 원인을 알리고 그 칸으로 초점을 옮깁니다', async ({ page }) => {
  await openPage(page, '/export')
  const family = page.getByRole('textbox', { name: /글꼴 이름 \(영문\)/ })
  await family.fill('')
  await page.getByRole('button', { name: '글꼴 파일 만들기' }).click()
  await expect(family).toBeFocused()
  await expect(family).toHaveAttribute('aria-invalid', 'true')
  await expect(family).toHaveAccessibleDescription(/입력해 주세요/)
})
