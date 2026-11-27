import { describe, expect, it } from 'vitest'
import {
  add,
  cross,
  distance,
  distanceToSegment,
  length,
  lerp,
  normalize,
  rectOfPoints,
  rectsOverlap,
  scale,
  signedArea,
  sub,
  turnAngle,
  unionRect,
} from './vector.ts'

describe('벡터 계산', () => {
  it('더하기·빼기·배율·외적·길이·거리', () => {
    expect(add({ x: 1, y: 2 }, { x: 3, y: 4 })).toEqual({ x: 4, y: 6 })
    expect(sub({ x: 1, y: 2 }, { x: 3, y: 4 })).toEqual({ x: -2, y: -2 })
    expect(scale({ x: 1, y: -2 }, 3)).toEqual({ x: 3, y: -6 })
    expect(cross({ x: 1, y: 0 }, { x: 0, y: 1 })).toBe(1)
    expect(length({ x: 3, y: 4 })).toBe(5)
    expect(distance({ x: 1, y: 1 }, { x: 4, y: 5 })).toBe(5)
  })

  it('길이가 0인 벡터를 정규화하면 0 벡터입니다', () => {
    expect(normalize({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 })
    expect(normalize({ x: 0, y: 2 })).toEqual({ x: 0, y: 1 })
  })

  it('두 점 사이를 비율로 잇습니다', () => {
    expect(lerp({ x: 0, y: 0 }, { x: 10, y: 20 }, 0.25)).toEqual({ x: 2.5, y: 5 })
  })

  it('선분까지의 거리는 끝을 넘으면 끝점까지의 거리입니다', () => {
    const a = { x: 0, y: 0 }
    const b = { x: 10, y: 0 }
    expect(distanceToSegment({ x: 5, y: 3 }, a, b)).toBe(3)
    expect(distanceToSegment({ x: 13, y: 4 }, a, b)).toBe(5)
    expect(distanceToSegment({ x: -3, y: 4 }, a, b)).toBe(5)
    // 길이 0인 선분은 점까지의 거리
    expect(distanceToSegment({ x: 3, y: 4 }, a, a)).toBe(5)
  })

  it('꺾인 각도는 0~π입니다', () => {
    expect(turnAngle({ x: 1, y: 0 }, { x: 1, y: 0 })).toBe(0)
    expect(turnAngle({ x: 1, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(Math.PI / 2)
    expect(turnAngle({ x: 1, y: 0 }, { x: -1, y: 0 })).toBeCloseTo(Math.PI)
  })

  it('점들을 감싸는 사각형, 두 사각형 합치기와 겹침', () => {
    const r = rectOfPoints([
      { x: 3, y: -1 },
      { x: -2, y: 4 },
      { x: 1, y: 1 },
    ])
    expect(r).toEqual({ x0: -2, y0: -1, x1: 3, y1: 4 })
    expect(unionRect(r, { x0: 0, y0: -5, x1: 9, y1: 0 })).toEqual({ x0: -2, y0: -5, x1: 9, y1: 4 })
    const far = { x0: 4, y0: 0, x1: 6, y1: 2 }
    expect(rectsOverlap(r, far)).toBe(false)
    expect(rectsOverlap(r, far, 1.5)).toBe(true)
    expect(rectsOverlap(r, { x0: 0, y0: 0, x1: 1, y1: 1 })).toBe(true)
  })

  it('넓이의 부호는 돌아가는 방향을 따릅니다', () => {
    const ccw = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ]
    expect(signedArea(ccw)).toBe(4)
    expect(signedArea([...ccw].reverse())).toBe(-4)
  })
})
