/**
 * Lighthouse CI(무료, 결과는 파일로만: .lighthouseci/). 빌드 결과(dist)를 띄워 화면마다 한 번씩 잽니다.
 * 접근성·권장 사항·검색 점수는 2.0.5에서 잰 값 아래로 내려가면 실패, 성능은 CI 장비에 따라 흔들려 경고만 합니다.
 * 실행: pnpm build 뒤 pnpm lhci
 */
const ROUTES = ['/', '/studio/', '/import/', '/preview/', '/export/', '/guide/']

module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      url: ROUTES.map((route) => `http://localhost${route}`),
      numberOfRuns: 1,
      settings: { chromeFlags: '--headless=new --no-sandbox' },
    },
    assert: {
      assertions: {
        'categories:accessibility': ['error', { minScore: 1 }],
        'categories:best-practices': ['error', { minScore: 1 }],
        'categories:seo': ['error', { minScore: 1 }],
        'categories:performance': ['warn', { minScore: 0.9 }],
      },
    },
    upload: { target: 'filesystem', outputDir: '.lighthouseci/reports' },
  },
}
