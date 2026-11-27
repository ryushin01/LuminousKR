import { readFileSync } from 'node:fs'
import {
  axeViolations,
  blockExternal,
  collectPdfjsWarnings,
  expect,
  openPage,
  test,
} from './fixtures.ts'
import { filledTemplatePhoto, pdfNeedingPdfjsData } from './samples.ts'

/**
 * 인터넷 없이(localhost 밖 요청을 모두 끊고) 처음 연 화면에서 주요 기능을 끝까지 써 봅니다.
 * 화면이 뜨는지만 보는 offline-network.spec.ts와 달리 그리기·파생 규칙·미리보기·내보내기(OTF·WOFF·WOFF2·ZIP)·
 * 손글씨 양식 PDF·사진·PDF 인식을 거쳐, 그 상태마다 외부 요청 0건·axe 위반·콘솔 오류가 없는지 봅니다.
 */
let blocked: string[] = []
test.beforeEach(async ({ context }) => {
  blocked = await blockExternal(context)
})
test.afterEach(() => {
  expect(blocked, '끊긴 외부 요청').toEqual([])
})

test('작업실: 그리기·파생 규칙(자동 자모)·영문 탭', async ({ page, consoleErrors }) => {
  await openPage(page, '/studio')
  await page.getByRole('button', { name: '빈 글꼴로 시작' }).click()
  const canvas = page.getByRole('application', { name: 'ㄱ 초성 그리기 판' })
  await canvas.focus()
  await page.keyboard.press('Space')
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Space')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status').filter({ hasText: '획을 마쳤습니다' })).toBeVisible()
  expect(await axeViolations(page)).toEqual([])

  // 파생 규칙: ㄲ은 ㄱ에서 자동으로 만들어지고, '직접 그리기'로 가져와 고칩니다.
  await page.getByRole('button', { name: '기본 글꼴로' }).click()
  await page.getByRole('radio', { name: /^ㄲ/ }).check()
  await expect(page.getByText(/자동으로 만들어집니다/)).toBeVisible()
  expect(await axeViolations(page)).toEqual([])
  await page.getByRole('button', { name: '직접 그리기' }).click()
  await expect(page.getByRole('button', { name: '자동으로 되돌리기' })).toBeVisible()

  await page.getByRole('tab', { name: /영문/ }).click()
  await page.getByRole('radio', { name: /대문자 A/ }).check()
  await expect(page.getByRole('application', { name: '대문자 A 그리기 판' })).toBeVisible()
  await page.waitForTimeout(600)
  expect(await axeViolations(page)).toEqual([])
  expect(consoleErrors).toEqual([])
})

test('미리보기: 입력한 글을 그리고 588자 표를 봅니다', async ({ page, consoleErrors }) => {
  await openPage(page, '/preview')
  await page.getByRole('textbox', { name: '미리 볼 글' }).fill('빛나는 한글 A1!')
  await expect(page.getByRole('status').filter({ hasText: '글자 8자' })).toBeVisible({
    timeout: 15_000,
  })
  await page.getByRole('combobox', { name: '초성' }).selectOption({ label: 'ㅎ (히읗)' })
  await expect(
    page.getByRole('table', { name: /초성 ㅎ 음절 588자/ }).locator('tbody td'),
  ).toHaveCount(588)
  expect(await axeViolations(page)).toEqual([])
  expect(consoleErrors).toEqual([])
})

test('내보내기: OTF·WOFF·WOFF2를 만들어 받습니다', async ({ page, consoleErrors }) => {
  test.slow()
  await openPage(page, '/export')
  await page.getByRole('button', { name: '글꼴 파일 만들기' }).click()
  const woff2Button = page.getByRole('button', { name: /WOFF2 받기/ })
  await expect(woff2Button).toBeVisible({ timeout: 90_000 })
  for (const [name, magic] of [
    [/OTF 받기/, 'OTTO'],
    [/WOFF 받기/, 'wOFF'],
    [/WOFF2 받기/, 'wOF2'],
  ] as const) {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name }).click(),
    ])
    expect(
      readFileSync((await download.path())!)
        .subarray(0, 4)
        .toString('latin1'),
    ).toBe(magic)
  }
  expect(await axeViolations(page)).toEqual([])
  expect(consoleErrors).toEqual([])
})

test('내보내기: 두 굵기를 한 가족 ZIP으로 받습니다', async ({ page, consoleErrors }) => {
  test.slow()
  await openPage(page, '/export')
  await page.getByRole('checkbox', { name: /700 Bold/ }).check()
  await page.getByRole('button', { name: '글꼴 파일 만들기' }).click()
  const zipButton = page.getByRole('button', { name: /한 가족 ZIP 받기/ })
  await expect(zipButton).toBeVisible({ timeout: 180_000 })
  const [download] = await Promise.all([page.waitForEvent('download'), zipButton.click()])
  expect(download.suggestedFilename()).toBe('Luminous-Modular-family.zip')
  const zip = readFileSync((await download.path())!)
  expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50)
  expect(await axeViolations(page)).toEqual([])
  expect(consoleErrors).toEqual([])
})

test('가져오기: 양식 PDF를 받아 다시 올리고, 채운 양식 사진을 인식해 적용합니다', async ({
  page,
  consoleErrors,
}) => {
  const pdfjsWarnings = collectPdfjsWarnings(page)
  await openPage(page, '/import')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '양식 PDF 받기' }).click(),
  ])
  await page.locator('input[type="file"][multiple]').setInputFiles({
    name: 'template.pdf',
    mimeType: 'application/pdf',
    buffer: readFileSync((await download.path())!),
  })
  await expect(
    page.getByRole('status').filter({ hasText: /양식을 찾았지만 그린 칸이 없습니다/ }),
  ).toBeVisible({ timeout: 30_000 })
  expect(await axeViolations(page)).toEqual([])

  await page.locator('input[type="file"][multiple]').setInputFiles({
    name: 'filled-template.jpg',
    mimeType: 'image/jpeg',
    buffer: await filledTemplatePhoto(page),
  })
  await expect(
    page.getByRole('status').filter({ hasText: /'기본 자모 24자' 양식에서 3자를 찾았습니다/ }),
  ).toBeVisible({ timeout: 30_000 })
  expect(await axeViolations(page)).toEqual([])
  await page.getByRole('button', { name: '고른 자모 3자 적용' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: '3자를 작업 중인 글꼴에 적용했습니다' }),
  ).toBeVisible()
  expect(pdfjsWarnings).toEqual([])
  expect(consoleErrors).toEqual([])
})

test('가져오기: 표준 글꼴·CMYK 색을 쓰는 PDF도 pdf.js 자료(글꼴·WASM·색 프로필)를 사이트에서 받아 읽습니다', async ({
  page,
  consoleErrors,
}) => {
  const pdfjsWarnings = collectPdfjsWarnings(page)
  const data: string[] = []
  page.context().on('requestfinished', (request) => {
    if (/\/pdfjs-[^/]+\//.test(request.url()))
      data.push(new URL(request.url()).pathname.split('/').pop()!)
  })
  await openPage(page, '/import')
  await page.locator('input[type="file"][multiple]').setInputFiles({
    name: 'dingbats-cmyk.pdf',
    mimeType: 'application/pdf',
    buffer: pdfNeedingPdfjsData(),
  })
  await expect(page.getByRole('status').filter({ hasText: 'dingbats-cmyk.pdf 1쪽' })).toBeVisible({
    timeout: 30_000,
  })
  expect(pdfjsWarnings).toEqual([])
  expect(data).toEqual(expect.arrayContaining(['FoxitDingbats.pfb', 'qcms_bg.wasm']))
  expect(await axeViolations(page)).toEqual([])
  expect(consoleErrors).toEqual([])
})
