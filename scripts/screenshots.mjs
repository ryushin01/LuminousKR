/**
 * README용 화면 사진을 프로덕션 빌드에서 찍어 docs/images/*.jpg로 저장합니다.
 * 사용: pnpm build && node scripts/screenshots.mjs
 */
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

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

async function shot(name, path, viewport, prepare) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 })
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
