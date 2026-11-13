import { readFileSync } from 'node:fs'
import {
  BIT,
  BIT_CENTERS,
  MARKER,
  MARKER_CENTERS,
  PAGE,
  bitsForSet,
  layoutCells,
} from '../src/pages/import/lib/template-geometry.ts'
import { expect, openPage, test } from './fixtures.ts'

/** 기본 자모 양식의 칸 순서 (앞쪽 일부) */
const BASIC_KEYS = [
  'L0',
  'L2',
  'L3',
  'L5',
  'L6',
  'L7',
  'L9',
  'L11',
  'L12',
  'L14',
  'L15',
  'L16',
  'L17',
  'L18',
  'V0',
]

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
  const geometry = {
    page: PAGE,
    markers: MARKER_CENTERS,
    bits: BIT_CENTERS,
    bitSize: BIT.size,
    markerSize: MARKER.size,
    bits1: bitsForSet(1),
    cells: layoutCells(BASIC_KEYS),
  }
  // 브라우저 캔버스에 양식과 펜 획(ㄱ, ㅇ, ㅏ)을 그리고, 사진처럼 살짝 돌립니다.
  const dataUrl = await page.evaluate((g) => {
    const scale = 2.2
    const sheet = document.createElement('canvas')
    sheet.width = Math.round(g.page.width * scale)
    sheet.height = Math.round(g.page.height * scale)
    const c = sheet.getContext('2d')!
    c.fillStyle = '#f6f5f2'
    c.fillRect(0, 0, sheet.width, sheet.height)
    c.fillStyle = '#111'
    for (const m of g.markers)
      c.fillRect(
        (m.x - g.markerSize / 2) * scale,
        (m.y - g.markerSize / 2) * scale,
        g.markerSize * scale,
        g.markerSize * scale,
      )
    g.bits1.forEach((bit: boolean, i: number) => {
      if (!bit) return
      const b = g.bits[i]!
      c.fillRect(
        (b.x - g.bitSize / 2) * scale,
        (b.y - g.bitSize / 2) * scale,
        g.bitSize * scale,
        g.bitSize * scale,
      )
    })
    c.strokeStyle = '#d0d0d0'
    c.lineWidth = 1
    for (const cell of g.cells)
      c.strokeRect(cell.x * scale, cell.y * scale, cell.size * scale, cell.size * scale)
    const at = (key: string, u: number, v: number) => {
      const cell = g.cells.find((x: { key: string }) => x.key === key)!
      return [(cell.x + u * cell.size) * scale, (cell.y + v * cell.size) * scale] as const
    }
    c.strokeStyle = '#1c1c28'
    c.lineWidth = 5.5
    c.lineCap = 'round'
    c.lineJoin = 'round'
    c.beginPath()
    c.moveTo(...at('L0', 0.1, 0.2))
    c.lineTo(...at('L0', 0.42, 0.2))
    c.lineTo(...at('L0', 0.42, 0.86))
    c.stroke()
    const [ox, oy] = at('L11', 0.27, 0.5)
    c.beginPath()
    c.ellipse(ox, oy, 0.18 * 86 * scale, 0.24 * 86 * scale, 0, 0, Math.PI * 2)
    c.stroke()
    c.beginPath()
    c.moveTo(...at('V0', 0.74, 0.05))
    c.lineTo(...at('V0', 0.74, 0.95))
    c.moveTo(...at('V0', 0.74, 0.48))
    c.lineTo(...at('V0', 0.95, 0.48))
    c.stroke()

    const photo = document.createElement('canvas')
    photo.width = sheet.width + 160
    photo.height = sheet.height + 160
    const p = photo.getContext('2d')!
    p.fillStyle = '#6b6f78'
    p.fillRect(0, 0, photo.width, photo.height)
    p.translate(photo.width / 2, photo.height / 2)
    p.rotate((3 * Math.PI) / 180)
    p.drawImage(sheet, -sheet.width / 2, -sheet.height / 2)
    return photo.toDataURL('image/jpeg', 0.9)
  }, geometry)

  await page.locator('input[type="file"][multiple]').setInputFiles({
    name: 'filled-template.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from(dataUrl.split(',')[1]!, 'base64'),
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
