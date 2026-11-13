import { describe, expect, it } from 'vitest'
import { catmullRomToCubics, cubicPoint, flattenEllipse } from './spline.ts'

describe('스플라인', () => {
  it('캣멀-롬 곡선은 모든 점을 지납니다', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 80 },
      { x: 200, y: 0 },
      { x: 300, y: 60 },
    ]
    const cubics = catmullRomToCubics(points, false)
    expect(cubics).toHaveLength(3)
    cubics.forEach((cubic, i) => {
      expect(cubicPoint(cubic, 0)).toEqual(points[i])
      expect(cubicPoint(cubic, 1)).toEqual(points[i + 1])
    })
  })

  it('닫힌 곡선은 마지막 점에서 첫 점으로 돌아옵니다', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 80 },
    ]
    const cubics = catmullRomToCubics(points, true)
    expect(cubics).toHaveLength(3)
    expect(cubicPoint(cubics[2]!, 1)).toEqual(points[0])
  })

  it('같은 점이 겹쳐도 무한대 값을 만들지 않습니다', () => {
    const cubics = catmullRomToCubics(
      [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
      false,
    )
    for (const cubic of cubics) for (const p of cubic) expect(Number.isFinite(p.x + p.y)).toBe(true)
  })

  it('타원 둘레 점은 크기에 맞춰 늘어나되 한도를 넘지 않습니다', () => {
    expect(flattenEllipse(0, 0, 10, 10, 4).length).toBe(24)
    expect(flattenEllipse(0, 0, 1000, 1000, 4).length).toBe(192)
  })
})
