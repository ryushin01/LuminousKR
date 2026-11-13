import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
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
    testTimeout: 20_000,
  },
})
