// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createBlankProject, createPresetProject } from '@/entities/font'
import { SYLLABLE_BASE, SYLLABLE_COUNT, decomposeCode } from '@/shared/lib/hangul'
import { precheckProject, syllableMissing } from './precheck.ts'

/** 조건에 맞는 음절 수 (점검과 따로 세는 기준값) */
function countSyllables(match: (lead: number, vowel: number, tail: number) => boolean): number {
  let count = 0
  for (let code = SYLLABLE_BASE; code < SYLLABLE_BASE + SYLLABLE_COUNT; code++) {
    const { lead, vowel, tail } = decomposeCode(code)!
    if (match(lead, vowel, tail)) count += 1
  }
  return count
}

/** ㄱ이 부분으로 들어가는 초성(ㄱ·ㄲ)과 받침(ㄱ·ㄲ·ㄳ·ㄺ) */
const LEADS_WITH_G = new Set([0, 1])
const TAILS_WITH_G = new Set([1, 2, 3, 9])

describe('내보내기 전 점검', () => {
  it('기본 프리셋에는 빈 자모가 없습니다', () => {
    expect(precheckProject(createPresetProject())).toEqual({ empty: [], affectedSyllables: 0 })
  })

  it('빈 글꼴은 기본 자모 24자가 비어 11,172자 모두에서 획이 빠지고, 파생 자모는 따로 알리지 않습니다', () => {
    const check = precheckProject(createBlankProject())
    expect(check.empty).toHaveLength(24)
    expect(check.affectedSyllables).toBe(11_172)
    expect(check.empty.map((item) => item.key)).not.toContain('L1') // ㄲ은 ㄱ을 그리면 생김
  })

  it('ㄱ의 획을 모두 지우면 ㄱ을 알리고, ㄲ과 ㄱ이 한 부분인 겹받침(ㄳ·ㄺ) 음절까지 셉니다', () => {
    const project = createPresetProject()
    project.jamo.L0!.base!.strokes = []
    const check = precheckProject(project)
    const expected = countSyllables(
      (lead, _vowel, tail) => LEADS_WITH_G.has(lead) || TAILS_WITH_G.has(tail),
    )
    expect(expected).toBe(2604)
    expect(check.empty.map((item) => [item.key, item.syllables, item.layout])).toEqual([
      ['L0', expected, 'A'],
    ])
    expect(check.affectedSyllables).toBe(expected)
  })

  it('읽: ㄺ의 ㄹ은 있고 ㄱ만 비어도 그 음절의 빠지는 그림으로 ㄱ을 찾습니다', () => {
    const project = createPresetProject()
    project.jamo.L0!.base!.strokes = []
    expect(syllableMissing(project, '읽'.codePointAt(0)!)).toEqual([{ key: 'L0', drawing: 'base' }])
    // ㄹ만 있는 받침(일)은 빠지지 않습니다.
    expect(syllableMissing(project, '일'.codePointAt(0)!)).toEqual([])
  })

  it('따로 그린 배치(벌)만 비었으면 그 배치를 열고, 그 벌을 물려받는 ㄲ 음절까지 셉니다', () => {
    const project = createPresetProject()
    project.jamo.L0!.variants = { D: { strokes: [] } }
    const [item] = precheckProject(project).empty
    expect(item).toMatchObject({ key: 'L0', layouts: ['D'], layout: 'D' })
    // 받침 있는 세로 모음 배치(각)의 초성 ㄱ·ㄲ: 받침 27 × 세로 모음 9 × 2
    expect(item!.syllables).toBe(27 * 9 * 2)
  })

  it('모든 배치를 벌로 그려 기본 획이 가려져도, 기본 획을 쓰는 받침(ㄱ·ㄲ·ㄳ·ㄺ)이 비면 ㄱ의 기본 획을 알립니다', () => {
    const project = createPresetProject()
    const base = project.jamo.L0!.base!
    project.jamo.L0!.variants = Object.fromEntries(
      (['A', 'B', 'C', 'D', 'E', 'F'] as const).map((id) => [id, structuredClone(base)]),
    )
    project.jamo.L0!.base = { strokes: [] }
    const check = precheckProject(project)
    const expected = countSyllables((_lead, _vowel, tail) => TAILS_WITH_G.has(tail))
    expect(
      check.empty.map((item) => [item.key, item.layouts, item.layout, item.syllables]),
    ).toEqual([['L0', ['A'], 'A', expected]])
    expect(check.affectedSyllables).toBe(expected)
  })
})
