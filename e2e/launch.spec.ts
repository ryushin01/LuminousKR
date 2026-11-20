import { ROUTES, expect, openPage, test } from './fixtures.ts'

test('웹 앱 매니페스트와 아이콘(192·512·마스크)을 줍니다', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest')
  expect(response.ok()).toBe(true)
  const manifest = (await response.json()) as {
    name: string
    short_name: string
    start_url: string
    display: string
    icons: { src: string; sizes: string; purpose?: string }[]
  }
  expect(manifest).toMatchObject({
    short_name: 'LuminousKR',
    start_url: './',
    display: 'standalone',
  })
  expect(manifest.icons.map((icon) => icon.sizes)).toEqual(['192x192', '512x512', '512x512'])
  expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true)
  for (const icon of manifest.icons) {
    const image = await request.get(`/${icon.src}`)
    expect(image.ok(), icon.src).toBe(true)
    expect(image.headers()['content-type']).toContain('image/png')
  }
})

test('공유 미리보기: 운영 주소의 이미지·주소를 걸고, 화면별 HTML은 그 화면 주소를 씁니다', async ({
  page,
  request,
}) => {
  await openPage(page, '/')
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    'https://ryushin01.github.io/LuminousKR/og.jpg',
  )
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    'content',
    'summary_large_image',
  )
  expect((await request.get('/og.jpg')).headers()['content-type']).toContain('image/jpeg')
  const studio = await (await request.get('/studio/')).text()
  expect(studio).toContain(
    '<link rel="canonical" href="https://ryushin01.github.io/LuminousKR/studio/" />',
  )
  expect(studio).toContain('content="https://ryushin01.github.io/LuminousKR/studio/"')
  const notFound = await (await request.get('/404.html')).text()
  expect(notFound).toContain('<meta name="robots" content="noindex" />')
  expect(notFound).not.toContain('rel="canonical"')
})

test('배포하는 웹 폰트(OFL)의 저작권과 사용 허락 전문을 함께 줍니다', async ({ request }) => {
  const licenses = [
    [
      '/licenses/LuminousSans-OFL.txt',
      'Copyright © 2017 IBM Corp. with Reserved Font Name "Plex".',
    ],
    ['/licenses/Syne-OFL.txt', 'Copyright 2019 The Syne Project Authors'],
  ]
  for (const [url, copyright] of licenses) {
    const response = await request.get(url!)
    expect(response.ok(), url).toBe(true)
    const text = await response.text()
    expect(text, url).toContain(copyright!)
    expect(text, url).toContain('SIL OPEN FONT LICENSE Version 1.1')
  }
})

test('WOFF2 압축에 쓰는 WASM(brotli-wasm·rust-brotli)의 사용 허락 전문을 함께 줍니다', async ({
  request,
}) => {
  const licenses = [
    ['/licenses/brotli-wasm-Apache-2.0.txt', 'Apache License'],
    ['/licenses/rust-brotli-BSD-3-Clause.txt', 'Copyright (c) 2016 Dropbox, Inc.'],
    ['/licenses/rust-brotli-MIT.txt', 'Copyright (c) 2009, 2010, 2013-2016 by the Brotli Authors.'],
  ]
  for (const [url, mark] of licenses) {
    const response = await request.get(url!)
    expect(response.ok(), url).toBe(true)
    expect(await response.text(), url).toContain(mark!)
  }
})

test('모든 화면이 콘텐츠 보안 정책(CSP) 아래에서 위반 없이 열립니다', async ({ page }) => {
  const violations: string[] = []
  await page.exposeFunction('reportViolation', (text: string) => violations.push(text))
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      ;(window as unknown as { reportViolation: (t: string) => void }).reportViolation(
        `${event.violatedDirective} ${event.blockedURI}`,
      )
    })
  })
  for (const route of ROUTES) {
    await openPage(page, route.path)
    await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1)
    await page.waitForTimeout(400)
  }
  expect(violations).toEqual([])
})
