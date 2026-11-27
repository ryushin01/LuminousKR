import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LAYOUTS,
  frameBox,
  homeLayout,
  isJamoKey,
  isLayoutId,
  jamoChar,
  jamoLabel,
  jamoName,
  layoutFor,
  layoutsOf,
  mapFromBox,
  mapToBox,
  relativeBox,
  sampleSyllable,
  subBox,
} from './layout.ts'

describe('배치와 자모 키', () => {
  it('중성 모양과 받침으로 여섯 배치를 고릅니다', () => {
    // ㅏ(0) 세로, ㅗ(8) 가로, ㅘ(9) 섞임
    expect([layoutFor(0, 0), layoutFor(8, 0), layoutFor(9, 0)]).toEqual(['A', 'B', 'C'])
    expect([layoutFor(0, 1), layoutFor(8, 4), layoutFor(9, 27)]).toEqual(['D', 'E', 'F'])
  })

  it('밖에서 온 값은 자모 키·배치 이름인지 확인합니다', () => {
    expect(isJamoKey('L18')).toBe(true)
    expect(isJamoKey('L19')).toBe(false)
    expect(isJamoKey('T0')).toBe(false)
    expect(isLayoutId('F')).toBe(true)
    expect(isLayoutId('Z')).toBe(false)
  })

  it('자모 글자·이름·화면 이름(없는 번호는 ?와 빈 이름)', () => {
    expect([jamoChar('L0'), jamoChar('V9'), jamoChar('T27')]).toEqual(['ㄱ', 'ㅘ', 'ㅎ'])
    expect(jamoName('L0')).toBe('기역')
    expect(jamoName('V0')).toBe('아')
    expect(jamoName('T1')).not.toBe('')
    expect(jamoLabel('V9')).toBe('ㅘ 중성')
    expect([jamoChar('L99'), jamoChar('V99'), jamoChar('T99')]).toEqual(['?', '?', '?'])
    expect([jamoName('L99'), jamoName('V99'), jamoName('T99')]).toEqual(['', '', ''])
  })

  it('자모마다 놓일 수 있는 배치와 기본 배치', () => {
    expect(layoutsOf('L3')).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
    expect(layoutsOf('T4')).toEqual(['D', 'E', 'F'])
    expect(layoutsOf('V0')).toEqual(['A', 'D'])
    expect(layoutsOf('V8')).toEqual(['B', 'E'])
    expect(layoutsOf('V9')).toEqual(['C', 'F'])
    expect(homeLayout('T4')).toBe('D')
  })

  it('자모의 틀: 받침이 없는 배치에서 종성은 D 배치의 받침 틀을 씁니다', () => {
    expect(frameBox(DEFAULT_LAYOUTS, 'L0', 'B')).toBe(DEFAULT_LAYOUTS.B.L)
    expect(frameBox(DEFAULT_LAYOUTS, 'V0', 'D')).toBe(DEFAULT_LAYOUTS.D.V)
    expect(frameBox(DEFAULT_LAYOUTS, 'T1', 'E')).toBe(DEFAULT_LAYOUTS.E.T)
    expect(frameBox(DEFAULT_LAYOUTS, 'T1', 'A')).toBe(DEFAULT_LAYOUTS.D.T)
  })

  it('미리 볼 음절은 그 배치의 모양입니다', () => {
    expect(sampleSyllable('L0', 'A')).toBe('가')
    expect(sampleSyllable('L0', 'F')).toBe('관')
    expect(sampleSyllable('V0', 'D')).toBe('안')
    expect(sampleSyllable('T1', 'E')).toBe('곡')
  })

  it('틀 좌표 바꾸기는 서로 되돌리고, 폭이 0인 틀도 나누기를 하지 않습니다', () => {
    const box = { x0: 0.2, y0: 0.1, x1: 0.6, y1: 0.5 }
    const p = mapToBox(box, 0.5, 0.25)
    expect(p.x).toBeCloseTo(0.4)
    expect(p.y).toBeCloseTo(0.2)
    const back = mapFromBox(box, p.x, p.y)
    expect(back.x).toBeCloseTo(0.5)
    expect(back.y).toBeCloseTo(0.25)
    expect(mapFromBox({ x0: 1, y0: 1, x1: 1, y1: 1 }, 2, 3)).toEqual({ x: 1, y: 2 })

    const rel = { x0: 0.25, y0: 0, x1: 0.75, y1: 0.5 }
    const child = subBox(box, rel)
    const again = relativeBox(box, child)
    for (const k of ['x0', 'y0', 'x1', 'y1'] as const) expect(again[k]).toBeCloseTo(rel[k])
    expect(relativeBox({ x0: 0, y0: 0, x1: 0, y1: 0 }, { x0: 1, y0: 1, x1: 2, y1: 2 })).toEqual({
      x0: 1,
      y0: 1,
      x1: 2,
      y1: 2,
    })
  })
})
