// @vitest-environment node
/**
 * 성능 기록: 11,172자 다시 계산과 OTF·WOFF 만들기 시간을 잽니다(pnpm perf, CI는 결과를 작업 요약에 씀).
 * 장비에 따라 크게 흔들리므로 기록이 목적이고, 실패는 평소의 수십 배로 느려졌을 때만 냅니다.
 */
import { appendFileSync, writeFileSync } from 'node:fs'
import { afterAll, describe, expect, it } from 'vitest'
import { SYLLABLE_BASE, SYLLABLE_COUNT } from '@/shared/lib/hangul'
import { createPresetProject } from '../model/preset.ts'
import { buildFont } from './build-font.ts'
import { ComponentCache, Composer } from './composer.ts'

/** 이보다 느리면 실패(평소 CI에서 1~3초) */
const CEILING_MS = 60_000
const results: { name: string; ms: number }[] = []

function time<T>(name: string, run: () => T): T {
  const started = performance.now()
  const value = run()
  results.push({ name, ms: Math.round(performance.now() - started) })
  return value
}

async function timeAsync<T>(name: string, run: () => Promise<T>): Promise<T> {
  const started = performance.now()
  const value = await run()
  results.push({ name, ms: Math.round(performance.now() - started) })
  return value
}

function composeAll(composer: Composer): number {
  let contours = 0
  for (let i = 0; i < SYLLABLE_COUNT; i++)
    contours += composer.glyphContours(SYLLABLE_BASE + i).length
  return contours
}

describe('성능 기록', () => {
  afterAll(() => {
    const table = [
      '### 성능 기록(엔진, Node)',
      '',
      '| 항목 | 시간 |',
      '| --- | ---: |',
      ...results.map((r) => `| ${r.name} | ${r.ms.toLocaleString('en-US')} ms |`),
      '',
    ].join('\n')
    writeFileSync('perf-results.json', `${JSON.stringify(results, null, 2)}\n`)
    if (process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${table}\n`)
    else console.log(table)
  })

  it('11,172자를 처음부터 계산하고, 굵기를 바꿔 다시 계산합니다', () => {
    const project = createPresetProject()
    const cache = new ComponentCache()
    const contours = time('11,172자 처음 계산', () => composeAll(new Composer(project, cache)))
    expect(contours).toBeGreaterThan(SYLLABLE_COUNT)
    // 같은 판으로 다시: 캐시에서 이어 씀
    time('11,172자 다시 계산(그대로, 캐시)', () => composeAll(new Composer(project, cache)))
    const bolder = { ...project, style: { ...project.style, weight: project.style.weight + 10 } }
    time('11,172자 다시 계산(굵기 바꿈)', () => composeAll(new Composer(bolder, cache)))
    for (const r of results) expect(r.ms, r.name).toBeLessThan(CEILING_MS)
  })

  it('전체 글꼴(11,319글리프)의 OTF와 WOFF를 만듭니다', async () => {
    const project = createPresetProject()
    const otf = await timeAsync('OTF 만들기(전체 글꼴)', () => buildFont(project, { woff: false }))
    expect(otf.glyphCount).toBe(11_319)
    const woff = await timeAsync('OTF + WOFF 만들기(전체 글꼴)', () =>
      buildFont(project, { woff: true }),
    )
    expect(woff.woff!.byteLength).toBeLessThan(woff.otf.byteLength)
    for (const r of results) expect(r.ms, r.name).toBeLessThan(CEILING_MS)
  }, 120_000)
})
