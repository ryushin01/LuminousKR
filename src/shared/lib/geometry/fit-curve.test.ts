import { describe, expect, it } from 'vitest'
import { fitClosedPolygon } from './fit-curve.ts'
import { cubicPoint } from './spline.ts'
import type { Contour, Point } from './types.ts'

function sampleContour(contour: Contour, steps = 24): Point[] {
  const out: Point[] = []
  let from = contour.start
  for (const seg of contour.segments) {
    if (seg.type === 'L') {
      out.push(seg)
    } else {
      const cubic = [
        from,
        { x: seg.x1, y: seg.y1 },
        { x: seg.x2, y: seg.y2 },
        { x: seg.x, y: seg.y },
      ] as const
      for (let i = 1; i <= steps; i++) out.push(cubicPoint([...cubic] as never, i / steps))
    }
    from = { x: seg.x, y: seg.y }
  }
  return out
}

describe('곡선 맞춤', () => {
  it('잘게 나눈 원을 적은 수의 베지어로 되돌리고 반지름 오차가 작습니다', () => {
    const points: Point[] = []
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2
      points.push({ x: 300 + Math.cos(a) * 100, y: 300 + Math.sin(a) * 100 })
    }
    const contour = fitClosedPolygon(points)!
    expect(contour.segments.length).toBeLessThanOrEqual(8)
    expect(contour.segments.every((s) => s.type === 'C')).toBe(true)
    for (const p of sampleContour(contour)) {
      expect(Math.abs(Math.hypot(p.x - 300, p.y - 300) - 100)).toBeLessThan(1)
    }
  })

  it('사각형은 모서리를 지키며 직선 4개로 남깁니다', () => {
    const contour = fitClosedPolygon([
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 100 },
      { x: 0, y: 100 },
    ])!
    expect(contour.segments).toHaveLength(4)
    expect(contour.segments.every((s) => s.type === 'L')).toBe(true)
  })

  it('둥근 끝 획(경기장 모양)은 곧은 변은 직선, 끝은 곡선으로 맞춥니다', () => {
    const points: Point[] = []
    const r = 40
    for (let i = 0; i <= 24; i++) {
      const a = -Math.PI / 2 + (i / 24) * Math.PI
      points.push({ x: 300 + Math.cos(a) * r, y: Math.sin(a) * r })
    }
    for (let i = 0; i <= 24; i++) {
      const a = Math.PI / 2 + (i / 24) * Math.PI
      points.push({ x: Math.cos(a) * r, y: Math.sin(a) * r })
    }
    const contour = fitClosedPolygon(points)!
    const lines = contour.segments.filter((s) => s.type === 'L')
    const curves = contour.segments.filter((s) => s.type === 'C')
    expect(lines.length).toBe(2)
    expect(curves.length).toBeGreaterThanOrEqual(2)
    expect(curves.length).toBeLessThanOrEqual(8)
  })

  it('정수 격자에서 생긴 잔떨림(아주 짧은 변)은 모서리로 보지 않습니다', () => {
    const points: Point[] = []
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2
      const p = { x: 500 + Math.cos(a) * 80, y: 500 + Math.sin(a) * 60 }
      points.push(p, { x: p.x + 0.125, y: p.y })
    }
    const contour = fitClosedPolygon(points)!
    expect(contour.segments.length).toBeLessThanOrEqual(10)
  })

  it('점이 셋보다 적으면 윤곽을 만들지 않습니다', () => {
    expect(
      fitClosedPolygon([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ]),
    ).toBeNull()
  })
})
