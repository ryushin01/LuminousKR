import { defineConfig } from 'vitest/config'
import base from './vitest.config.ts'

/** 성능 기록(pnpm perf): *.perf.test.ts만, 한 번에 하나씩(서로 다투지 않게) 돌립니다. */
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ['src/**/*.perf.test.ts'],
    exclude: [],
    fileParallelism: false,
    testTimeout: 120_000,
  },
})
