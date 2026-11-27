/**
 * 커버리지 표(coverage/coverage-summary.json)를 마크다운으로 씁니다. CI에서는 $GITHUB_STEP_SUMMARY에 덧붙이고,
 * 없으면 화면에 보여 줍니다. 묶음은 vitest.config.ts의 로직 계층 기준(80%)과 같습니다.
 */
import { appendFileSync, readFileSync } from 'node:fs'

const summary = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf8'))
const METRICS = ['lines', 'statements', 'functions', 'branches']
const GROUPS = [
  ['조합 엔진', /\/src\/entities\/font\/lib\//],
  ['파생 규칙(배치·파생)', /\/src\/entities\/font\/model\/(derivation|layout)\.ts$/],
  ['획 두께·곡선 맞춤', /\/src\/shared\/lib\/geometry\//],
  ['내보내기', /\/src\/(shared\/lib\/(font-file|zip)|pages\/export\/model)\//],
  [
    '인식 파이프라인',
    /\/src\/(pages\/import\/lib\/(recognize|template-[a-z]+)\.ts$|shared\/lib\/image\/)/,
  ],
]

const files = Object.entries(summary).filter(([name]) => name !== 'total')
const pct = (covered, total) => (total === 0 ? 100 : (100 * covered) / total)
const row = (label, entries, goal) => {
  const cells = METRICS.map((metric) => {
    const covered = entries.reduce((sum, [, v]) => sum + v[metric].covered, 0)
    const total = entries.reduce((sum, [, v]) => sum + v[metric].total, 0)
    return `${pct(covered, total).toFixed(1)}%`
  })
  return `| ${label} | ${entries.length} | ${cells.join(' | ')} | ${goal} |`
}

const lines = [
  '### 단위 시험 커버리지',
  '',
  '| 묶음 | 파일 | 줄 | 문장 | 함수 | 분기 | 기준 |',
  '| --- | ---: | ---: | ---: | ---: | ---: | --- |',
  row('전체', files, '2.0.5 측정값 이상'),
  ...GROUPS.map(([label, pattern]) =>
    row(
      label,
      files.filter(([name]) => pattern.test(name)),
      '80% 이상',
    ),
  ),
  '',
]
const out = lines.join('\n')
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${out}\n`)
else console.log(out)
