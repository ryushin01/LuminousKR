/**
 * LuminousKR 서비스 워커 원본. scripts/postbuild.mjs가 아래 세 값을 빌드 결과로 채워 dist/sw.js로 씁니다.
 *
 * - 화면(HTML): 네트워크를 먼저 쓰고, 연결이 없을 때만 저장해 둔 것을 씁니다. 온라인이면 지금처럼 새로 고치면 새 판이 열립니다.
 * - 해시가 붙은 자산(assets/): 캐시를 먼저 씁니다(이름이 내용마다 달라 바뀌지 않음, pdf.js 자료는 판 번호 폴더).
 *   화면 조각·CSS·화면 글자 글꼴은 설치할 때 미리 받고, 쓸 때만 불러오는 pdf.js와 그 자료·WOFF2 압축기는 설치 뒤
 *   페이지가 'warm'을 보내면 따로 받습니다(처음 쓰기 전에 연결이 끊겨도 되게). 글자 조각은 쓸 때 저장합니다.
 * - 이번 판과 바로 앞 판의 자산을 남겨, 배포 전에 연 탭이 옛 화면 조각을 찾아도 캐시에서 받게 합니다.
 */
const VERSION = '__VERSION__'
/** 설치할 때 미리 받을 주소(서비스 워커 범위 기준 상대 경로) */
const PRECACHE = /* __PRECACHE__ */ []
/** 설치 뒤 페이지가 부탁하면 따로 받을 주소: 쓸 때만 불러오는 pdf.js와 그 자료, WOFF2 압축기 */
const WARM = /* __WARM__ */ []
/** 이번 판의 assets/ 안 파일 경로 전부(하위 폴더 포함, 앞 판 자산을 정리할 때 씀) */
const KNOWN_ASSETS = /* __KNOWN_ASSETS__ */ []

const PAGES = `lkr-pages-${VERSION}`
const ASSETS = 'lkr-assets'
const META = 'lkr-meta'
const scope = self.registration.scope
const assetsPath = new URL('assets/', scope).pathname
const absolute = (path) => new URL(path, scope).href
const isAsset = (url) => new URL(url).pathname.startsWith(assetsPath)
// 서버가 Vary: Origin을 붙이면(모듈 스크립트 요청에만 Origin이 있음) 미리 받은 응답과 대조되지 않으므로 Vary는 보지 않습니다.
const MATCH = { ignoreVary: true }
/**
 * 캐시에 넣기는 덤입니다. 저장 공간이 모자라 실패해도(QuotaExceededError, 운영 주소는 다른 GitHub Pages 프로젝트와
 * 공간을 나눠 씀) 네트워크에서 받은 응답은 그대로 씁니다.
 */
const store = (cache, request, response) => cache.put(request, response).catch(() => {})

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const pages = await caches.open(PAGES)
      const assets = await caches.open(ASSETS)
      await Promise.all(
        PRECACHE.map(async (path) => {
          const url = absolute(path)
          // 자산은 이미 있으면 다시 받지 않습니다(같은 이름은 같은 내용).
          if (isAsset(url) && (await assets.match(url, MATCH))) return
          const response = await fetch(url, { cache: 'reload' })
          if (!response.ok) throw new Error(`${url}: ${response.status}`)
          await (isAsset(url) ? assets : pages).put(url, response)
        }),
      )
      // 화면은 네트워크를 먼저 쓰고 자산 이름은 판마다 달라 섞이지 않으므로, 기다리지 않고 바로 맡습니다.
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 자산은 이번 판과 바로 앞 판이 쓰는 것만 남깁니다.
      const meta = await caches.open(META)
      const stored = await meta.match(absolute('known-assets'))
      const previous = stored ? await stored.json().catch(() => []) : []
      const keep = new Set([...KNOWN_ASSETS, ...previous].map((name) => absolute(`assets/${name}`)))
      const assets = await caches.open(ASSETS)
      for (const request of await assets.keys()) {
        if (!keep.has(request.url)) await assets.delete(request)
      }
      await meta.put(absolute('known-assets'), new Response(JSON.stringify(KNOWN_ASSETS)))
      for (const name of await caches.keys()) {
        if (name.startsWith('lkr-pages-') && name !== PAGES) await caches.delete(name)
      }
      await self.clients.claim()
    })(),
  )
})

async function pageFromNetworkFirst(request) {
  const pages = await caches.open(PAGES)
  try {
    const response = await fetch(request)
    // 다음에 연결이 없을 때 쓰도록 최신 화면을 남깁니다(주소 이동 응답은 브라우저가 따라가므로 담지 않음).
    if (response.ok) await store(pages, request, response.clone())
    return response
  } catch (error) {
    const cached =
      (await pages.match(request, { ...MATCH, ignoreSearch: true })) ??
      (await pages.match(absolute(new URL(request.url).pathname.replace(/\/?$/, '/')), MATCH)) ??
      (await pages.match(absolute('./'), MATCH))
    if (cached) return cached
    throw error
  }
}

async function assetFromCacheFirst(request) {
  const assets = await caches.open(ASSETS)
  const cached = await assets.match(request, MATCH)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) await store(assets, request, response.clone())
  return response
}

/**
 * 쓸 때만 불러오는 자산을 미리 받아 둡니다. 하나가 실패해도 나머지는 받고, 다음 방문에 다시 시도합니다
 * (이미 받은 것은 건너뜀). 첫 화면과 다투지 않게 설치에 묶지 않고 페이지가 다 열린 뒤 부탁합니다.
 */
async function warmOptionalAssets() {
  const assets = await caches.open(ASSETS)
  await Promise.allSettled(
    WARM.map(async (path) => {
      const url = absolute(path)
      if (await assets.match(url, MATCH)) return
      const response = await fetch(url)
      if (response.ok) await store(assets, url, response)
    }),
  )
}

self.addEventListener('message', (event) => {
  if (event.data === 'warm') event.waitUntil(warmOptionalAssets())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (request.mode === 'navigate') event.respondWith(pageFromNetworkFirst(request))
  else if (url.pathname.startsWith(assetsPath)) event.respondWith(assetFromCacheFirst(request))
  // 그 밖(매니페스트·아이콘·사용 허락 전문)은 브라우저에 맡깁니다.
})
