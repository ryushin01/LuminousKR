import { readFileSync } from 'node:fs'
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

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string }

// GitHub Pages처럼 하위 경로에 올릴 때 BASE_PATH=/LuminousKR/ 로 빌드
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [solid(), contentSecurityPolicy()],
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
