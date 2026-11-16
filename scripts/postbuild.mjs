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
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
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
console.log(
  `화면 ${ROUTES.length - 1}개의 HTML 사본과 404.html을 만들고, 화면마다 조각·첫 화면 글꼴 ${fontFiles.length}개 미리 받기를 넣었습니다.`,
)
