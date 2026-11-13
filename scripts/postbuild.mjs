/**
 * 정적 호스팅(GitHub Pages)에서 /studio 같은 주소로 바로 들어와도 200으로 열리도록
 * 화면마다 index.html 사본을 만들고, 문서 제목을 화면 이름으로 바꿉니다.
 * 없는 주소는 404.html(같은 앱)이 받아 '없는 화면'을 보여 줍니다.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../dist', import.meta.url))
const html = readFileSync(join(dist, 'index.html'), 'utf8')

const ROUTES = [
  { path: 'studio', title: '작업실' },
  { path: 'import', title: '가져오기' },
  { path: 'preview', title: '미리보기' },
  { path: 'export', title: '내보내기' },
  { path: 'guide', title: '안내' },
]

const withTitle = (title) =>
  html.replace(/<title>[^<]*<\/title>/, `<title>${title} — LuminousKR</title>`)

for (const route of ROUTES) {
  mkdirSync(join(dist, route.path), { recursive: true })
  writeFileSync(join(dist, route.path, 'index.html'), withTitle(route.title))
}
writeFileSync(join(dist, '404.html'), withTitle('없는 화면'))
console.log(`화면 ${ROUTES.length}개의 HTML 사본과 404.html을 만들었습니다.`)
