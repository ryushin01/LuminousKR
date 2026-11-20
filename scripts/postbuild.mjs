/**
 * 정적 호스팅(GitHub Pages)에서 /studio 같은 주소로 바로 들어와도 200으로 열리도록
 * 화면마다 index.html 사본을 만들고, 문서 제목을 화면 이름으로 바꿉니다.
 * 없는 주소는 404.html(같은 앱)이 받아 '없는 화면'을 보여 줍니다.
 *
 * 화면마다 그 화면 조각(JS·CSS)의 미리 받기를 넣어, 진입 JS를 받은 뒤에야 화면 조각을 요청하던
 * 한 번의 왕복을 없앱니다(빌드 매니페스트로 찾고, 다 쓴 매니페스트는 지움).
 * 모든 화면의 첫 화면에 쓰는 글꼴(제목 700·본문 400·머리글 600 한글, 영문 Syne)도 미리 받습니다.
 * CSS를 읽은 뒤에야 요청하면 첫 그리기 뒤에 도착해, 대체 글꼴로 그린 제목의 줄 수가 바뀌며 아래가 밀립니다(CLS).
 */
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../dist', import.meta.url))
const html = readFileSync(join(dist, 'index.html'), 'utf8')
const manifestPath = join(dist, '.vite', 'manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

/** 화면별 HTML: 경로(빈 문자열은 홈), 문서 제목, 화면 조각의 소스 모듈 */
const ROUTES = [
  { path: '', title: null, module: 'src/pages/home/index.ts' },
  { path: 'studio', title: '작업실', module: 'src/pages/studio/index.ts' },
  { path: 'import', title: '가져오기', module: 'src/pages/import/index.ts' },
  { path: 'preview', title: '미리보기', module: 'src/pages/preview/index.ts' },
  { path: 'export', title: '내보내기', module: 'src/pages/export/index.ts' },
  { path: 'guide', title: '안내', module: 'src/pages/guide/index.ts' },
]
const NOT_FOUND = { title: '없는 화면', module: 'src/pages/not-found/index.ts', noindex: true }

// 기준 경로는 진입 스크립트 주소에서 읽습니다(BASE_PATH=/LuminousKR/ 빌드면 /LuminousKR/).
const entry = manifest['index.html']
const base = html.match(new RegExp(`src="([^"]*)${entry.file.replace(/[.]/g, '\\.')}"`))?.[1]
if (base === undefined) throw new Error('index.html에서 진입 스크립트를 찾지 못했습니다.')

/** 진입 HTML이 이미 받는 조각(진입 JS와 그 정적 import, 진입 CSS) */
const entryFiles = new Set([entry.file, ...(entry.css ?? [])])
for (const key of entry.imports ?? []) {
  entryFiles.add(manifest[key].file)
  for (const css of manifest[key].css ?? []) entryFiles.add(css)
}

/** 화면 조각과 그 정적 import가 쓰는 JS·CSS (진입이 이미 받는 것은 뺌) */
function chunkFiles(key, js = new Set(), css = new Set(), seen = new Set()) {
  if (seen.has(key) || key === 'index.html') return { js, css }
  seen.add(key)
  const chunk = manifest[key]
  if (!chunk) throw new Error(`빌드 매니페스트에 ${key}가 없습니다.`)
  if (!entryFiles.has(chunk.file)) js.add(chunk.file)
  for (const file of chunk.css ?? []) if (!entryFiles.has(file)) css.add(file)
  for (const next of chunk.imports ?? []) chunkFiles(next, js, css, seen)
  return { js, css }
}

/** 모든 화면의 첫 화면에 쓰는 글꼴 파일 (해시가 붙은 빌드 이름으로 찾음) */
const FIRST_VIEW_FONTS = [
  /^luminous-sans-400-ui-[\w-]+\.woff2$/,
  /^luminous-sans-600-ui-[\w-]+\.woff2$/,
  /^luminous-sans-700-ui-[\w-]+\.woff2$/,
  /^syne-latin-wght-normal-[\w-]+\.woff2$/,
]
const assetNames = readdirSync(join(dist, 'assets'))
const fontFiles = FIRST_VIEW_FONTS.map((pattern) => {
  const name = assetNames.find((file) => pattern.test(file))
  if (!name) throw new Error(`첫 화면 글꼴(${pattern})을 빌드 결과에서 찾지 못했습니다.`)
  return `assets/${name}`
})

/** 화면 조각을 미리 받는 태그 (Vite가 조각을 불러올 때 같은 주소의 태그가 있으면 다시 넣지 않음) */
function preloadTags(module) {
  const { js, css } = chunkFiles(module)
  return [
    ...fontFiles.map(
      (file) =>
        `<link rel="preload" as="font" type="font/woff2" crossorigin href="${base}${file}">`,
    ),
    ...[...css].map((file) => `<link rel="stylesheet" crossorigin href="${base}${file}">`),
    ...[...js].map((file) => `<link rel="modulepreload" crossorigin href="${base}${file}">`),
  ].join('\n    ')
}

/** 운영 주소 (공유 미리보기·canonical의 기준) */
const SITE = 'https://ryushin01.github.io/LuminousKR/'

function pageHtml(route) {
  let out = html.replace(/\n\s*<\/head>/, `\n    ${preloadTags(route.module)}\n  </head>`)
  if (route.title) {
    out = out.replace(/<title>[^<]*<\/title>/, `<title>${route.title} — LuminousKR</title>`)
  }
  // 화면별 사본은 공유 주소·canonical을 그 화면 주소로 (없는 화면은 검색에 남기지 않음)
  if (route.path) {
    const url = `${SITE}${route.path}/`
    out = out
      .replace(
        `<meta property="og:url" content="${SITE}" />`,
        `<meta property="og:url" content="${url}" />`,
      )
      .replace(`<link rel="canonical" href="${SITE}" />`, `<link rel="canonical" href="${url}" />`)
  }
  if (route.noindex) {
    out = out
      .replace(/\s*<link rel="canonical"[^>]*>/, '')
      .replace('</title>', '</title>\n    <meta name="robots" content="noindex" />')
  }
  return out
}

for (const route of ROUTES) {
  const dir = join(dist, route.path)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.html'), pageHtml(route))
}
writeFileSync(join(dist, '404.html'), pageHtml(NOT_FOUND))
rmSync(join(dist, '.vite'), { recursive: true, force: true })

/**
 * 배포하는 웹 폰트는 SIL OFL 1.1이라 사본마다 저작권과 사용 허락을 함께 줘야 합니다.
 * 줄인 글꼴 파일의 이름 표(저작권·라이선스 설명·주소)에 더해, 전문을 licenses/에 둡니다.
 * WOFF2 압축에 쓰는 WASM(brotli-wasm)도 함께 배포하므로 그 사용 허락(Apache-2.0)도 둡니다
 * (그 안의 rust-brotli 전문은 public/licenses/에 있음).
 */
const LICENSES = [
  ['LuminousSans-OFL.txt', '../src/app/styles/fonts/luminous-sans/OFL.txt'],
  ['Syne-OFL.txt', '../node_modules/@fontsource-variable/syne/LICENSE'],
  ['brotli-wasm-Apache-2.0.txt', '../node_modules/brotli-wasm/LICENSE'],
]
mkdirSync(join(dist, 'licenses'), { recursive: true })
for (const [name, from] of LICENSES)
  copyFileSync(fileURLToPath(new URL(from, import.meta.url)), join(dist, 'licenses', name))

/**
 * 서비스 워커(dist/sw.js): 한 번 연 뒤에는 연결이 끊겨도 열리게 합니다(원본은 scripts/sw-template.js).
 * 설치할 때 화면별 HTML, assets/의 JS·CSS, 화면 글자 글꼴을 미리 받고, 쓸 때만 받는 것(pdf.js, WOFF2 압축기,
 * 글자 조각)은 쓸 때 저장합니다. 판 이름은 자산 이름과 HTML에서 만들어 바뀌면 화면 캐시를 새로 씁니다.
 */
const OPTIONAL_ASSETS = [/^pdf[-.]/, /^index\.web-/]
const PRECACHE_FONTS = [
  /^luminous-sans-\d+-ui-[\w-]+\.woff2$/,
  /^syne-latin-wght-normal-[\w-]+\.woff2$/,
]
const precacheAssets = assetNames.filter(
  (name) =>
    (/\.(js|css)$/.test(name) && !OPTIONAL_ASSETS.some((pattern) => pattern.test(name))) ||
    PRECACHE_FONTS.some((pattern) => pattern.test(name)),
)
const precache = [
  ...ROUTES.map((route) => (route.path ? `./${route.path}/` : './')),
  ...precacheAssets.map((name) => `./assets/${name}`),
]
const swVersion = createHash('sha256')
  .update(JSON.stringify([assetNames, html]))
  .digest('hex')
  .slice(0, 12)
const swTemplate = readFileSync(fileURLToPath(new URL('./sw-template.js', import.meta.url)), 'utf8')
const fills = [
  ["'__VERSION__'", `'${swVersion}'`],
  ['/* __PRECACHE__ */ []', JSON.stringify(precache)],
  ['/* __KNOWN_ASSETS__ */ []', JSON.stringify(assetNames)],
]
let sw = swTemplate
for (const [mark, value] of fills) {
  if (!sw.includes(mark)) throw new Error(`서비스 워커 원본에 ${mark} 자리가 없습니다.`)
  sw = sw.replace(mark, value)
}
writeFileSync(
  join(dist, 'sw.js'),
  `// scripts/postbuild.mjs가 만든 파일입니다. 직접 고치지 마세요.\n${sw}`,
)

console.log(
  `화면 ${ROUTES.length - 1}개의 HTML 사본과 404.html을 만들고, 화면마다 조각·첫 화면 글꼴 ${fontFiles.length}개 미리 받기를 넣었습니다. 웹 폰트·WASM 라이선스 ${LICENSES.length}개를 licenses/에 두었습니다. 서비스 워커는 ${precache.length}개를 미리 받습니다(판 ${swVersion}).`,
)
