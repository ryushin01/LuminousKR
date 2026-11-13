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
    // 소프트웨어 WebGL로 배경을 계속 그리면 CPU를 많이 써서 검사가 느려지므로 '동작 줄이기'로 멈춥니다.
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    launchOptions: {
      // CI에는 GPU가 없으므로 배경 WebGL을 소프트웨어로 그립니다.
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // 프로덕션 빌드를 띄워 검사합니다 (먼저 pnpm build:all 필요).
  webServer: {
    command: `pnpm preview --port ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
})
