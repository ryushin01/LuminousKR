import { describe, expect, it } from 'vitest'
import { decomposeSyllable } from '@/shared/lib/hangul'
import { derivationOf, derivationSources, isDerivable } from './derivation.ts'
import {
  ALL_JAMO_KEYS,
  DEFAULT_LAYOUTS,
  homeLayout,
  jamoLabel,
  layoutFor,
  layoutsOf,
  relativeBox,
  sampleSyllable,
  subBox,
} from './layout.ts'
import { BASIC_JAMO_KEYS, createPresetProject } from './preset.ts'

const layoutOf = (char: string) => {
  const parts = decomposeSyllable(char)!
  return layoutFor(parts.vowel, parts.tail)
}

describe('배치', () => {
  it('중성 모양과 받침으로 여섯 배치를 고릅니다', () => {
    expect(['가', '고', '과', '각', '곡', '곽'].map(layoutOf)).toEqual([
      'A',
      'B',
      'C',
      'D',
      'E',
      'F',
    ])
    expect(layoutOf('의')).toBe('C')
    expect(layoutOf('읽')).toBe('D')
  })

  it('자모마다 놓일 수 있는 배치와 기본 배치가 있습니다', () => {
    expect(layoutsOf('L0')).toHaveLength(6)
    expect(layoutsOf('V0')).toEqual(['A', 'D'])
    expect(layoutsOf('V8')).toEqual(['B', 'E'])
    expect(layoutsOf('V9')).toEqual(['C', 'F'])
    expect(layoutsOf('T1')).toEqual(['D', 'E', 'F'])
    expect(homeLayout('T21')).toBe('D')
  })

  it('자모 키는 초성 19 + 중성 21 + 종성 27 = 67개입니다', () => {
    expect(ALL_JAMO_KEYS).toHaveLength(67)
    expect(jamoLabel('T8')).toBe('ㄹ 종성')
  })

  it('견본 음절은 그 배치의 음절입니다', () => {
    for (const key of ALL_JAMO_KEYS) {
      for (const layout of layoutsOf(key))
        expect(layoutOf(sampleSyllable(key, layout))).toBe(layout)
    }
  })

  it('작은 틀 계산은 서로 되돌릴 수 있습니다', () => {
    const parent = DEFAULT_LAYOUTS.C.V
    const child = DEFAULT_LAYOUTS.C.Vv!
    const restored = subBox(parent, relativeBox(parent, child))
    expect(restored.x0).toBeCloseTo(child.x0)
    expect(restored.y1).toBeCloseTo(child.y1)
  })
})

describe('파생 규칙', () => {
  it('기본 자모 24자를 빼면 43자가 자동으로 만들어집니다', () => {
    const derivable = ALL_JAMO_KEYS.filter(isDerivable)
    expect(derivable).toHaveLength(43)
    expect(BASIC_JAMO_KEYS).toHaveLength(24)
    expect(new Set([...derivable, ...BASIC_JAMO_KEYS]).size).toBe(67)
  })

  it('쌍자음은 같은 자음 둘을 좌우에 나란히 놓습니다', () => {
    const parts = derivationOf('L1', 'A', DEFAULT_LAYOUTS, 0.1)!
    expect(parts.map((p) => p.key)).toEqual(['L0', 'L0'])
    expect(parts[0]!.rel.x1).toBeLessThan(parts[1]!.rel.x0)
  })

  it('섞임 모음은 배치의 가로·세로 틀에 나눠 놓습니다', () => {
    const parts = derivationOf('V9', 'C', DEFAULT_LAYOUTS, 0.1)!
    expect(parts.map((p) => p.key)).toEqual(['V8', 'V0'])
    expect(parts[1]!.rel.x0).toBeGreaterThan(parts[0]!.rel.x0)
  })

  it('홑받침은 초성의 기본 획을, 겹받침은 받침 둘을 씁니다', () => {
    expect(derivationOf('T21', 'D', DEFAULT_LAYOUTS, 0.1)).toEqual([
      { key: 'L11', rel: { x0: 0, y0: 0, x1: 1, y1: 1 }, inherit: false },
    ])
    expect(derivationSources('T9')).toEqual(['T8', 'T1'])
    expect(derivationSources('V1')).toEqual(['V0', 'V20'])
  })
})

describe('기본 프리셋', () => {
  it('기본 자모 24자만 직접 그린 그림이 있습니다', () => {
    const project = createPresetProject()
    expect(Object.keys(project.jamo).sort()).toEqual([...BASIC_JAMO_KEYS].sort())
    for (const key of BASIC_JAMO_KEYS)
      expect(project.jamo[key]!.base!.strokes.length).toBeGreaterThan(0)
  })
})
