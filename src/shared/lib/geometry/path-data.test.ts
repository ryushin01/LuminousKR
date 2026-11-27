import { describe, expect, it } from 'vitest'
import { contoursBounds, contoursToSvgPath, roundContours, transformContours } from './path-data.ts'
import type { Contour } from './types.ts'

const curve: Contour = {
  start: { x: 0, y: 0 },
  segments: [
    { type: 'L', x: 10, y: 0 },
    { type: 'C', x1: 12, y1: 2, x2: 12, y2: 8, x: 10, y: 10 },
    { type: 'L', x: 0, y: 10 },
  ],
}

describe('윤곽 경로 자료', () => {
  it('변환은 끝점과 조절점에 모두 적용됩니다', () => {
    const [moved] = transformContours([curve], (p) => ({ x: p.x * 2, y: p.y + 1 }))
    expect(moved!.start).toEqual({ x: 0, y: 1 })
    expect(moved!.segments[1]).toEqual({ type: 'C', x1: 24, y1: 3, x2: 24, y2: 9, x: 20, y: 11 })
    expect(moved!.segments[2]).toEqual({ type: 'L', x: 0, y: 11 })
  })

  it('정수로 맞추며 길이 0인 직선·곡선 조각을 지우고, 조각이 2개 미만인 윤곽은 버립니다', () => {
    const rounded = roundContours([
      {
        start: { x: 0.2, y: 0.4 },
        segments: [
          { type: 'L', x: 0.4, y: -0.3 },
          { type: 'C', x1: 0.1, y1: 0.2, x2: -0.2, y2: 0.1, x: 0.3, y: 0 },
          { type: 'L', x: 9.6, y: 0.2 },
          { type: 'C', x1: 10.4, y1: 4.6, x2: 10, y2: 6, x: 5.5, y: 9.5 },
        ],
      },
      { start: { x: 0, y: 0 }, segments: [{ type: 'L', x: 5, y: 5 }] },
    ])
    expect(rounded).toEqual([
      {
        start: { x: 0, y: 0 },
        segments: [
          { type: 'L', x: 10, y: 0 },
          { type: 'C', x1: 10, y1: 5, x2: 10, y2: 6, x: 6, y: 10 },
        ],
      },
    ])
  })

  it('SVG 경로는 소수 한 자리, -0은 0으로 쓰고 y를 뒤집을 수 있습니다', () => {
    expect(contoursToSvgPath([curve])).toBe('M0 0L10 0C12 2 12 8 10 10L0 10Z')
    expect(contoursToSvgPath([{ start: { x: -0.01, y: 1.26 }, segments: [] }], 10)).toBe('M0 8.7Z')
  })

  it('경계는 조절점까지 감싸고, 윤곽이 없으면 null입니다', () => {
    expect(contoursBounds([curve])).toEqual({ x0: 0, y0: 0, x1: 12, y1: 10 })
    expect(contoursBounds([])).toBeNull()
  })
})
