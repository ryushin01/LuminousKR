/**
 * README용 화면 사진을 프로덕션 빌드에서 찍어 docs/images/*.jpg로 저장합니다.
 * 사용: pnpm build && node scripts/screenshots.mjs
 */
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import {
  BIT,
  BIT_CENTERS,
  MARKER,
  MARKER_CENTERS,
  PAGE,
  bitsForSet,
  layoutCells,
} from '../src/pages/import/lib/template-geometry.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const out = join(root, 'docs/images')
const PORT = 4290
const base = `http://localhost:${PORT}`
mkdirSync(out, { recursive: true })

const server = spawn('pnpm', ['exec', 'vite', 'preview', '--port', String(PORT), '--strictPort'], {
  cwd: root,
  stdio: 'ignore',
})

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(base)).ok) return
    } catch {
      // 아직 뜨는 중
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('미리보기 서버가 뜨지 않았습니다.')
}

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})

/** 가져오기 사진용: 손으로 채운 양식을 캔버스로 그려 사진처럼 살짝 돌립니다 (가상 데이터). */
async function uploadFilledTemplate(page) {
  const keys = [
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
  ]
  const geometry = {
    page: PAGE,
    markers: MARKER_CENTERS,
    bits: BIT_CENTERS,
    bitSize: BIT.size,
    markerSize: MARKER.size,
    bits1: bitsForSet(1),
    cells: layoutCells(keys),
  }
  const dataUrl = await page.evaluate((g) => {
    const scale = 2.2
    const sheet = document.createElement('canvas')
    sheet.width = Math.round(g.page.width * scale)
    sheet.height = Math.round(g.page.height * scale)
    const c = sheet.getContext('2d')
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
    g.bits1.forEach((bit, i) => {
      if (bit)
        c.fillRect(
          (g.bits[i].x - g.bitSize / 2) * scale,
          (g.bits[i].y - g.bitSize / 2) * scale,
          g.bitSize * scale,
          g.bitSize * scale,
        )
    })
    const at = (key, u, v) => {
      const cell = g.cells.find((x) => x.key === key)
      return [(cell.x + u * cell.size) * scale, (cell.y + v * cell.size) * scale]
    }
    c.strokeStyle = '#1c1c28'
    c.lineWidth = 6
    c.lineCap = 'round'
    c.lineJoin = 'round'
    const line = (key, ...pts) => {
      c.beginPath()
      pts.forEach(([u, v], i) =>
        i === 0 ? c.moveTo(...at(key, u, v)) : c.lineTo(...at(key, u, v)),
      )
      c.stroke()
    }
    line('L0', [0.08, 0.2], [0.44, 0.22], [0.42, 0.86])
    line('L2', [0.12, 0.14], [0.12, 0.8], [0.46, 0.8])
    line('L9', [0.06, 0.85], [0.26, 0.2], [0.46, 0.85])
    const [ox, oy] = at('L11', 0.27, 0.5)
    c.beginPath()
    c.ellipse(ox, oy, 0.18 * 86 * scale, 0.24 * 86 * scale, 0, 0, Math.PI * 2)
    c.stroke()
    line('V0', [0.74, 0.05], [0.74, 0.95])
    line('V0', [0.74, 0.47], [0.95, 0.48])
    line('V4', [0.84, 0.05], [0.84, 0.95])
    line('V4', [0.62, 0.48], [0.84, 0.47])
    const photo = document.createElement('canvas')
    photo.width = sheet.width + 160
    photo.height = sheet.height + 160
    const p = photo.getContext('2d')
    p.fillStyle = '#6b6f78'
    p.fillRect(0, 0, photo.width, photo.height)
    p.translate(photo.width / 2, photo.height / 2)
    p.rotate((2.5 * Math.PI) / 180)
    p.drawImage(sheet, -sheet.width / 2, -sheet.height / 2)
    return photo.toDataURL('image/jpeg', 0.9)
  }, geometry)
  await page.locator('input[type="file"][multiple]').setInputFiles({
    name: 'handwriting-template.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from(dataUrl.split(',')[1], 'base64'),
  })
  await page
    .getByRole('status')
    .filter({ hasText: /자를 찾았습니다/ })
    .waitFor({ timeout: 30_000 })
}

async function shot(name, path, viewport, prepare) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' })
  await page.goto(base + path)
  await page.locator('main h1').waitFor()
  if (prepare) await prepare(page)
  await page.waitForTimeout(1500)
  await page.screenshot({ path: join(out, `${name}.jpg`), type: 'jpeg', quality: 82 })
  await page.close()
  console.log(`docs/images/${name}.jpg`)
}

try {
  await waitForServer()
  const desktop = { width: 1440, height: 900 }
  await shot('home', '/', desktop)
  await shot('studio', '/studio', { width: 1440, height: 1240 })
  await shot('import', '/import', { width: 1440, height: 1100 }, async (page) => {
    await uploadFilledTemplate(page)
    await page.locator('section', { hasText: '인식 결과' }).first().scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollBy(0, -90))
  })
  await shot('preview', '/preview', desktop)
  await shot('export', '/export', desktop, async (page) => {
    await page.getByRole('button', { name: '글꼴 파일 만들기' }).click()
    await page.getByRole('button', { name: /OTF 받기/ }).waitFor({ timeout: 60_000 })
    await page.evaluate(() => window.scrollTo(0, 190))
  })
  await shot('guide', '/guide', desktop)
  const mobile = { width: 390, height: 844 }
  await shot('mobile-home', '/', mobile)
  await shot('mobile-studio', '/studio', mobile, async (page) => {
    await page.getByRole('application').scrollIntoViewIfNeeded()
  })
} finally {
  await browser.close()
  server.kill()
}
