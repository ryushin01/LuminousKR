import { readFileSync } from 'node:fs'
import { configDefaults, defineConfig } from 'vitest/config'
import solid from 'vite-plugin-solid'

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string }

export default defineConfig({
  plugins: [solid()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  resolve: { tsconfigPaths: true, conditions: ['development', 'browser'] },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // 성능 기록은 따로(pnpm perf, vitest.perf.config.ts)
    exclude: [...configDefaults.exclude, 'src/**/*.perf.test.ts'],
    testTimeout: 20_000,
    // pnpm test:coverage(CI)에서만 켭니다. 표는 coverage/coverage-summary.json → scripts/coverage-summary.mjs
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*.stories.tsx', 'src/**/*.d.ts'],
      reporter: ['text-summary', 'json-summary', 'html'],
      reportOnFailure: true,
      thresholds: {
        // 전체: 2.0.5에서 잰 값(줄 65.6·문장 60.8·함수 47.0·분기 61.8%) 아래로 내려가지 않게
        lines: 65,
        statements: 60,
        functions: 47,
        branches: 61,
        // 로직 계층은 80%: 조합 엔진, 파생 규칙(배치·파생), 획 두께·곡선 맞춤, 내보내기, 인식 파이프라인
        // (화면·워커 진입점은 jsdom에 Worker가 없어 E2E에서 봄)
        ...Object.fromEntries(
          [
            'src/entities/font/lib/**',
            'src/entities/font/model/{derivation,layout}.ts',
            'src/shared/lib/geometry/**',
            'src/{shared/lib/font-file,shared/lib/zip,pages/export/model}/**',
            'src/{pages/import/lib/{recognize,template-*}.ts,shared/lib/image/**}',
          ].map((glob) => [glob, { lines: 80, statements: 80, functions: 80, branches: 80 }]),
        ),
      },
    },
  },
})
