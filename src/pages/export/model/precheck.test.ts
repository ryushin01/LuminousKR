// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createBlankProject, createPresetProject } from '@/entities/font'
import { precheckProject } from './precheck.ts'

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

  it('ㄱ의 획을 모두 지우면 ㄱ 초성 588자를 알리고, ㄲ·받침 ㄱ이 들어간 음절도 빠지는 수에 셉니다', () => {
    const project = createPresetProject()
    project.jamo.L0!.base!.strokes = []
    const check = precheckProject(project)
    expect(check.empty.map((item) => [item.key, item.syllables, item.layout])).toEqual([
      ['L0', 588, 'A'],
    ])
    expect(check.affectedSyllables).toBeGreaterThan(588 * 2)
  })

  it('따로 그린 배치(벌)만 비었으면 그 배치를 엽니다', () => {
    const project = createPresetProject()
    project.jamo.L0!.variants = { D: { strokes: [] } }
    const [item] = precheckProject(project).empty
    expect(item).toMatchObject({ key: 'L0', layouts: ['D'], layout: 'D' })
    // 받침 있는 세로 모음 배치(각)의 초성 ㄱ: 받침 27 × 세로 모음 9
    expect(item!.syllables).toBe(27 * 9)
  })
})
