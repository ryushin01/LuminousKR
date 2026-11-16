import { defineConfig, devices } from '@playwright/test'

const PORT = 4281

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'ko-KR',
    // 배경 움직임 멈춤(동작 줄이기) 상태를 기본으로 검사합니다.
    // CI처럼 GPU가 없으면(소프트웨어 렌더러) 앱은 WebGL 배경 대신 CSS 배경을 씁니다.
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // 프로덕션 빌드를 띄워 검사합니다 (먼저 pnpm build:all 필요).
  webServer: {
    command: `pnpm preview --port ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
})
