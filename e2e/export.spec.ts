import { readFileSync } from 'node:fs'
import { expect, openPage, test } from './fixtures.ts'

test('11,172자 글꼴을 만들고 OTF·WOFF·WOFF2 파일을 받습니다 (두 번 눌러도 한 번만)', async ({
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

  const [woff2] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /WOFF2 받기/ }).click(),
  ])
  expect(woff2.suggestedFilename()).toBe('Luminous-Modular-Regular.woff2')
  const woff2Bytes = readFileSync((await woff2.path())!)
  expect(woff2Bytes.subarray(0, 4).toString('latin1')).toBe('wOF2')
  expect(woff2Bytes.length).toBeLessThan(woffBytes.length)
  // 브라우저의 글꼴 검사기(OTS)가 받아들여야 웹에서 쓸 수 있습니다.
  const loaded = await page.evaluate(async (base64) => {
    const data = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0))
    const face = await new FontFace('woff2 check', data).load()
    return face.status
  }, woff2Bytes.toString('base64'))
  expect(loaded).toBe('loaded')

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

test('만들기 전 확인: 빈 자모를 알리고 그 자모를 연 작업실로 보냅니다', async ({ page }) => {
  await openPage(page, '/export')
  await expect(page.getByText('빈 자모가 없습니다. 11,172자가 모두 그려집니다.')).toBeVisible()

  await openPage(page, '/studio')
  await page.getByRole('button', { name: '빈 글꼴로 시작' }).click()
  await page
    .getByRole('navigation', { name: '주 메뉴' })
    .getByRole('link', { name: '내보내기' })
    .click()
  await expect(page.getByText(/획이 없는 자모가 24개 있어 음절 11,172자에서/)).toBeVisible()
  await page.getByRole('link', { name: /ㅗ 중성 그리기/ }).click()
  await expect(page).toHaveURL(/\/studio\?jamo=V8$/)
  await expect(page.getByRole('application', { name: 'ㅗ 중성 그리기 판' })).toBeVisible()
})

test('굵기를 더 고르면 한 가족(Light·Regular·Bold)을 만들어 ZIP 하나로 받습니다', async ({
  page,
  consoleErrors,
}) => {
  test.slow()
  await openPage(page, '/export')
  await expect(page.getByRole('checkbox', { name: /400 Regular/ })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: /400 Regular/ })).toBeDisabled()
  await page.getByRole('checkbox', { name: /300 Light/ }).check()
  await page.getByRole('checkbox', { name: /700 Bold/ }).check()
  await page.getByRole('button', { name: '글꼴 파일 만들기' }).click()
  const zipButton = page.getByRole('button', { name: /한 가족 ZIP 받기/ })
  await expect(zipButton).toBeVisible({ timeout: 180_000 })
  await expect(page.getByRole('status').filter({ hasText: 'Light·Regular·Bold 3벌' })).toBeVisible()

  const [download] = await Promise.all([page.waitForEvent('download'), zipButton.click()])
  expect(download.suggestedFilename()).toBe('Luminous-Modular-family.zip')
  const zip = readFileSync((await download.path())!)
  // 중앙 디렉터리의 파일 이름을 읽습니다.
  const end = zip.length - 22
  expect(zip.readUInt32LE(end)).toBe(0x06054b50)
  let at = zip.readUInt32LE(end + 16)
  const names: string[] = []
  for (let i = 0; i < zip.readUInt16LE(end + 10); i++) {
    const length = zip.readUInt16LE(at + 28)
    names.push(zip.subarray(at + 46, at + 46 + length).toString('utf8'))
    at += 46 + length
  }
  expect(names).toEqual([
    'LuminousModular-Light.otf',
    'LuminousModular-Light.woff',
    'LuminousModular-Light.woff2',
    'LuminousModular-Regular.otf',
    'LuminousModular-Regular.woff',
    'LuminousModular-Regular.woff2',
    'LuminousModular-Bold.otf',
    'LuminousModular-Bold.woff',
    'LuminousModular-Bold.woff2',
  ])
  expect(consoleErrors).toEqual([])
})
