import { readFileSync } from 'node:fs'
import { parse } from 'opentype.js/dist/opentype.mjs'
import { expect, openPage, test } from './fixtures.ts'

test('11,172자 글꼴을 만들고 OTF·WOFF·WOFF2 파일을 받습니다 (두 번 눌러도 한 번만)', async ({
  page,
  consoleErrors,
}) => {
  await openPage(page, '/export')
  const submit = page.getByRole('button', { name: '글꼴 파일 만들기' })
  // 키보드로 두 번 눌러도 한 번만 만들고, 만드는 동안 버튼이 초점을 잃지 않습니다(disabled 대신 aria-disabled).
  // (마우스로는 Safari가 누른 버튼에 초점을 주지 않으므로 키보드로 봅니다. 두 번 눌러도 한 번만은 단위 시험에도 있음)
  await submit.focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: '만드는 중…' })).toBeFocused()
  const otfButton = page.getByRole('button', { name: /OTF 받기/ })
  await expect(otfButton).toBeVisible({ timeout: 60_000 })
  // .notdef·빈칸 2 + 영문·숫자·문장부호 94 + 낱자 51 + 음절 11,172
  await expect(page.getByRole('status').filter({ hasText: '글리프 11,319개' })).toBeVisible()

  const [otf] = await Promise.all([page.waitForEvent('download'), otfButton.click()])
  const otfBytes = readFileSync((await otf.path())!)
  expect(otf.suggestedFilename()).toBe('Luminous-Modular-Regular.otf')
  expect(otfBytes.subarray(0, 4).toString('latin1')).toBe('OTTO')
  // 11,319글리프 전체(미리보기용 작은 글꼴이 아님)이면서, 되풀이되는 윤곽을 서브루틴으로 옮겨 1 MB 아래
  // (옮기지 않으면 3.8 MB)
  expect(otfBytes.length).toBeGreaterThan(400_000)
  expect(otfBytes.length).toBeLessThan(1_000_000)
  // 영문은 글자마다 너비가 다르고, 한글은 1000입니다.
  const font = parse(
    otfBytes.buffer.slice(otfBytes.byteOffset, otfBytes.byteOffset + otfBytes.length),
  )
  expect(font.charToGlyph('A').name).toBe('uni0041')
  expect(font.charToGlyph('i').advanceWidth).toBeLessThan(font.charToGlyph('W').advanceWidth)
  expect(font.charToGlyph('가').advanceWidth).toBe(1000)

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

test('영문·숫자·문장부호를 끄면 한글만 넣은 글꼴을 만듭니다', async ({ page }) => {
  await openPage(page, '/export')
  await page.getByRole('checkbox', { name: /영문·숫자·문장부호 94자/ }).uncheck()
  await page.getByRole('button', { name: '글꼴 파일 만들기' }).click()
  await expect(page.getByRole('status').filter({ hasText: '글리프 11,225개' })).toBeVisible({
    timeout: 60_000,
  })
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
