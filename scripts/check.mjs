/**
 * CI와 같은 검사를 한 명령으로 돌립니다. CI(.github/workflows/ci.yml)도 이 스크립트의 단계를 나눠 부릅니다.
 *
 *   pnpm check                     # 모든 단계(정적 → 단위 → 빌드 → 성능 기록 → E2E → Lighthouse)
 *   pnpm check static unit         # 고른 단계만
 *   pnpm check e2e -- --project=chromium   # '--' 뒤는 Playwright에 그대로 넘김
 *
 * 단계 하나가 실패하면 바로 멈춥니다. E2E 전에 `pnpm exec playwright install chromium webkit`이 필요합니다.
 */
import { spawnSync } from 'node:child_process'

const STAGES = {
  static: [['lint'], ['lint:fsd'], ['format:check'], ['typecheck']],
  // 커버리지 표는 기준에 못 미쳐 실패해도 씁니다(always).
  unit: [
    ['test:coverage'],
    { command: ['exec', 'node', 'scripts/coverage-summary.mjs'], always: true },
  ],
  build: [['build:all'], ['size']],
  perf: [['perf']],
  e2e: [['test:e2e']],
  lhci: [['lhci']],
}
const ORDER = ['static', 'unit', 'build', 'perf', 'e2e', 'lhci']

const args = process.argv.slice(2)
const split = args.indexOf('--')
const names = split < 0 ? args : args.slice(0, split)
const passThrough = split < 0 ? [] : args.slice(split + 1)
const unknown = names.filter((name) => !(name in STAGES))
if (unknown.length > 0) {
  console.error(`모르는 단계: ${unknown.join(', ')} (가능: ${ORDER.join(', ')})`)
  process.exit(2)
}
const selected = names.length > 0 ? ORDER.filter((name) => names.includes(name)) : ORDER

const timings = []
for (const stage of selected) {
  const started = Date.now()
  let failed = null
  for (const step of STAGES[stage]) {
    const { command, always } = Array.isArray(step) ? { command: step, always: false } : step
    if (failed && !always) continue
    const full = stage === 'e2e' ? [...command, ...passThrough] : command
    console.log(`\n▶ [${stage}] pnpm ${full.join(' ')}`)
    const result = spawnSync('pnpm', full, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
    if (result.status !== 0 && !failed) failed = { full, code: result.status ?? 1 }
  }
  if (failed) {
    console.error(`\n✖ [${stage}] pnpm ${failed.full.join(' ')} 실패(종료 코드 ${failed.code})`)
    process.exit(failed.code)
  }
  timings.push(`${stage} ${((Date.now() - started) / 1000).toFixed(0)}초`)
}
console.log(`\n✔ 통과: ${timings.join(' · ')}`)
