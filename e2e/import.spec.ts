import { readFileSync } from 'node:fs'
import { expect, openPage, test } from './fixtures.ts'
import { filledTemplatePhoto } from './samples.ts'

test('앱이 만든 양식 PDF를 받아 다시 올리면 양식을 알아봅니다 (빈 칸 안내)', async ({
  page,
  consoleErrors,
}) => {
  await openPage(page, '/import')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '양식 PDF 받기' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('luminouskr-handwriting-template.pdf')
  const pdf = readFileSync((await download.path())!)
  expect(pdf.subarray(0, 8).toString('latin1')).toBe('%PDF-1.7')
  await expect(
    page.getByRole('status').filter({ hasText: '양식 1쪽(PDF)을 내려받았습니다' }),
  ).toBeVisible()

  await page.locator('input[type="file"][multiple]').setInputFiles({
    name: 'template.pdf',
    mimeType: 'application/pdf',
    buffer: pdf,
  })
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: /'기본 자모 24자' 양식을 찾았지만 그린 칸이 없습니다/ }),
  ).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('list', { name: '올린 파일' }).getByText('확인 필요')).toBeVisible()
  expect(consoleErrors).toEqual([])
})

test('손으로 채운 양식 사진에서 자모를 인식해 작업 중인 글꼴에 적용합니다', async ({
  page,
  consoleErrors,
}) => {
  await openPage(page, '/import')
  await page.locator('input[type="file"][multiple]').setInputFiles({
    name: 'filled-template.jpg',
    mimeType: 'image/jpeg',
    buffer: await filledTemplatePhoto(page),
  })
  await expect(
    page.getByRole('status').filter({ hasText: /'기본 자모 24자' 양식에서 3자를 찾았습니다/ }),
  ).toBeVisible({ timeout: 30_000 })
  const results = page.locator('section', { hasText: '인식 결과' })
  for (const name of ['ㄱ 초성 적용', 'ㅇ 초성 적용', 'ㅏ 중성 적용']) {
    await expect(results.getByRole('checkbox', { name: new RegExp(name) })).toBeChecked()
  }
  await expect(results.getByRole('img', { name: 'ㄱ 초성 칸을 바로잡은 그림' })).toBeVisible()

  await page.getByRole('button', { name: '고른 자모 3자 적용' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: '3자를 작업 중인 글꼴에 적용했습니다' }),
  ).toBeVisible()
  await page.getByRole('link', { name: '작업실에서 다듬기' }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: '자모의 뼈대를 그립니다' }),
  ).toBeVisible()
  // 적용한 ㄱ은 획 1개(꺾인 직선)로 들어옵니다.
  await expect(page.getByText(/^획 1/)).toBeVisible()
  expect(consoleErrors).toEqual([])
})
