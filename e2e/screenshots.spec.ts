import { type Page, expect, test } from '@playwright/test'
import {
  BIT,
  BIT_CENTERS,
  MARKER,
  MARKER_CENTERS,
  PAGE,
  bitsForSet,
  layoutCells,
} from '../src/pages/import/lib/template-geometry.ts'

/**
 * README 화면(docs/images)을 다시 찍습니다. 평소 E2E에서는 건너뜁니다.
 * 실행: pnpm build && pnpm screenshots
 */
test.skip(!process.env.SCREENSHOTS, 'README 화면은 pnpm screenshots로만 찍습니다')
// README 화면은 일식 배경이 보이도록 움직임을 켭니다.
test.use({ reducedMotion: 'no-preference' })
test.describe.configure({ mode: 'serial' })

const OUT = 'docs/images'
const DESKTOP = { width: 1440, height: 900 }
const MOBILE = { width: 390, height: 844 }

/** 기본 자모 24자 양식의 칸 순서(src/entities/font의 BASIC_JAMO_KEYS와 같음) */
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
  'V2',
  'V4',
  'V6',
  'V8',
  'V12',
  'V13',
  'V17',
  'V18',
  'V20',
]

async function open(page: Page, path: string) {
  await page.goto(path)
  await expect(page.locator('main h1')).toBeVisible()
  // 배경과 글꼴이 다 그려질 때까지 잠시 기다립니다.
  await page.waitForTimeout(2500)
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 85 })
}

test('홈', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await open(page, '/')
  await shot(page, 'home')
})

test('작업실', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1240 })
  await open(page, '/studio')
  await shot(page, 'studio')
})

test('가져오기: 손으로 채운 양식 사진에서 자모 6자를 인식', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  await open(page, '/import')
  const geometry = {
    page: PAGE,
    markers: MARKER_CENTERS,
    bits: BIT_CENTERS,
    bitSize: BIT.size,
    markerSize: MARKER.size,
    bits1: bitsForSet(1),
    cells: layoutCells(BASIC_KEYS),
  }
  // 양식에 펜으로 ㄱ ㄴ ㅅ ㅇ ㅏ ㅓ를 그리고 사진처럼 살짝 돌립니다(e2e/import.spec.ts와 같은 방식).
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
    const path = (key: string, points: [number, number][]) => {
      c.beginPath()
      c.moveTo(...at(key, ...points[0]!))
      for (const p of points.slice(1)) c.lineTo(...at(key, ...p))
      c.stroke()
    }
    c.strokeStyle = '#1c1c28'
    c.lineWidth = 5.5
    c.lineCap = 'round'
    c.lineJoin = 'round'
    path('L0', [
      [0.1, 0.2],
      [0.42, 0.2],
      [0.42, 0.86],
    ])
    path('L2', [
      [0.14, 0.12],
      [0.14, 0.82],
      [0.48, 0.82],
    ])
    path('L9', [
      [0.08, 0.86],
      [0.27, 0.2],
      [0.46, 0.86],
    ])
    const [ox, oy] = at('L11', 0.27, 0.5)
    c.beginPath()
    c.ellipse(ox, oy, 0.18 * 86 * scale, 0.24 * 86 * scale, 0, 0, Math.PI * 2)
    c.stroke()
    path('V0', [
      [0.74, 0.05],
      [0.74, 0.95],
    ])
    path('V0', [
      [0.74, 0.48],
      [0.95, 0.48],
    ])
    path('V4', [
      [0.74, 0.05],
      [0.74, 0.95],
    ])
    path('V4', [
      [0.52, 0.48],
      [0.74, 0.48],
    ])
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
    name: 'handwriting-template.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from(dataUrl.split(',')[1]!, 'base64'),
  })
  await expect(
    page.getByRole('status').filter({ hasText: /양식에서 \d+자를 찾았습니다/ }),
  ).toBeVisible({
    timeout: 30_000,
  })
  // 인식 결과가 화면 아래쪽 절반을 채우도록 내립니다.
  const results = page.locator('section', { hasText: '인식 결과' }).last()
  const top = await results.evaluate((el) => el.getBoundingClientRect().top + window.scrollY)
  await page.evaluate((y) => window.scrollTo(0, y), Math.max(0, top - 520))
  await page.waitForTimeout(800)
  await shot(page, 'import')
})

test('미리보기', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await open(page, '/preview')
  await expect(page.getByRole('status').filter({ hasText: '글꼴 파일(' })).toBeVisible({
    timeout: 60_000,
  })
  await page.waitForTimeout(1000)
  await shot(page, 'preview')
})

test('내보내기: 11,172칸이 모두 켜진 진행 그림', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await open(page, '/export')
  await page.getByRole('button', { name: '글꼴 파일 만들기' }).click()
  await expect(page.getByRole('button', { name: /OTF 받기/ })).toBeVisible({ timeout: 120_000 })
  // 단추를 누르면 그쪽으로 내려가므로 맨 위로 올려 글꼴 정보와 진행 그림을 함께 보여 줍니다.
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(1500)
  await shot(page, 'export')
})

test('안내', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await open(page, '/guide')
  await shot(page, 'guide')
})

test('좁은 화면: 홈과 그리기 판', async ({ page }) => {
  await page.setViewportSize(MOBILE)
  await open(page, '/')
  await shot(page, 'mobile-home')
  await open(page, '/studio')
  // 그리기 도구와 판이 위쪽에 오도록 내립니다.
  const board = page.getByRole('application', { name: /그리기 판/ })
  const top = await board.evaluate((el) => el.getBoundingClientRect().top + window.scrollY)
  await page.evaluate((y) => window.scrollTo(0, y), Math.max(0, top - 330))
  await page.waitForTimeout(800)
  await shot(page, 'mobile-studio')
})
