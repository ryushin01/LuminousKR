import { createReadStream, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type Plugin, defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

/**
 * 프로덕션 빌드에만 콘텐츠 보안 정책(CSP)을 meta로 넣습니다. GitHub Pages는 응답 헤더를 바꿀 수 없어
 * frame-ancestors는 넣지 못합니다. 개발 서버는 HMR 때문에 넣지 않습니다.
 * - 스크립트·워커는 같은 출처만, eval 금지(pdf.js 6은 eval을 쓰지 않음)
 * - 인라인 style 속성(Solid의 style 바인딩), 칸 그림의 blob: 주소, CSS의 data: SVG는 허용
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "worker-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

function contentSecurityPolicy(): Plugin {
  return {
    name: 'luminous-csp',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
        injectTo: 'head-prepend',
      },
    ],
  }
}

/**
 * pdf.js가 PDF를 그릴 때 따로 받는 자료(넣지 않은 표준 글꼴, JPEG 2000·JBIG2·ICC 색 변환 WASM, CMYK 색 프로필,
 * 한중일 문자표)를 사이트 안 `assets/pdfjs-<판>/`에 원래 이름 그대로 둡니다. pdf.js는 '주소 + 파일 이름'으로 받으므로
 * 해시를 붙이지 않고, 판 번호를 경로에 넣어 서비스 워커의 캐시 먼저 규칙과 어긋나지 않게 합니다.
 * 이 자료가 없으면 pdf.js는 경고만 남기고 해당 글자·그림을 빼고 그립니다(인터넷 연결과 무관하게).
 * 스크립트 실행용 QuickJS는 쓰지 않으므로(enableScripting 꺼짐) 뺍니다.
 */
const PDFJS_DIR = fileURLToPath(new URL('./node_modules/pdfjs-dist/', import.meta.url))
const PDFJS_DATA_DIRS = ['cmaps', 'iccs', 'standard_fonts', 'wasm'] as const
const { version: pdfjsVersion } = JSON.parse(
  readFileSync(join(PDFJS_DIR, 'package.json'), 'utf8'),
) as {
  version: string
}
const PDFJS_DATA_PATH = `assets/pdfjs-${pdfjsVersion}/`

function pdfjsDataFiles(): string[] {
  return PDFJS_DATA_DIRS.flatMap((dir) =>
    readdirSync(join(PDFJS_DIR, dir))
      .filter((name) => !/quickjs/i.test(name))
      .map((name) => `${dir}/${name}`),
  )
}

function pdfjsData(): Plugin {
  let base = '/'
  return {
    name: 'luminous-pdfjs-data',
    configResolved(config) {
      base = config.base
    },
    // 개발 서버도 같은 주소로 줍니다.
    configureServer(server) {
      const files = new Set(pdfjsDataFiles())
      server.middlewares.use((request, response, next) => {
        const path = (request.url ?? '').split('?')[0]!
        const prefix = `${base}${PDFJS_DATA_PATH}`
        const file = path.startsWith(prefix) ? path.slice(prefix.length) : ''
        if (!files.has(file)) return next()
        response.setHeader(
          'Content-Type',
          file.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream',
        )
        createReadStream(join(PDFJS_DIR, file)).pipe(response)
      })
    },
    generateBundle() {
      for (const file of pdfjsDataFiles()) {
        this.emitFile({
          type: 'asset',
          fileName: `${PDFJS_DATA_PATH}${file}`,
          source: readFileSync(join(PDFJS_DIR, file)),
        })
      }
    },
  }
}

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string }

// GitHub Pages처럼 하위 경로에 올릴 때 BASE_PATH=/LuminousKR/ 로 빌드
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [solid(), contentSecurityPolicy(), pdfjsData()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  resolve: { tsconfigPaths: true },
  worker: { format: 'es' },
  build: {
    // 화면별 HTML 사본에 그 화면 조각의 미리 받기(modulepreload)를 넣는 데 씀(scripts/postbuild.mjs, 쓴 뒤 지움)
    manifest: true,
    // 한글 글꼴 조각(대부분 4KB 미만)을 CSS에 base64로 넣지 않고 파일로 둠
    assetsInlineLimit: (file) => (/\.woff2?$/.test(file) ? false : undefined),
    target: 'es2023',
    // pdf.js처럼 큰 조각은 필요할 때만 받으므로 경고 기준을 넉넉히 둠
    chunkSizeWarningLimit: 1600,
  },
})
