import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string }

// GitHub Pages처럼 하위 경로에 올릴 때 BASE_PATH=/LuminousKR/ 로 빌드
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [solid()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  resolve: { tsconfigPaths: true },
  worker: { format: 'es' },
  build: {
    // 한글 글꼴 조각(대부분 4KB 미만)을 CSS에 base64로 넣지 않고 파일로 둠
    assetsInlineLimit: (file) => (/\.woff2?$/.test(file) ? false : undefined),
    target: 'es2023',
    // pdf.js처럼 큰 조각은 필요할 때만 받으므로 경고 기준을 넉넉히 둠
    chunkSizeWarningLimit: 1600,
  },
})
