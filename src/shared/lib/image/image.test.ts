import { describe, expect, it } from 'vitest'
import { applyHomography, solveHomography } from './homography.ts'
import { type BinaryImage, countInk, createBinary, createGray } from './raster.ts'
import { asEllipse, simplifyPolyline } from './simplify.ts'
import { adaptiveBinarize, otsuThreshold } from './threshold.ts'
import { thin } from './thinning.ts'
import { traceSkeleton } from './trace.ts'

function paint(
  width: number,
  height: number,
  inside: (x: number, y: number) => boolean,
): BinaryImage {
  const img = createBinary(width, height)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) if (inside(x, y)) img.data[y * width + x] = 1
  return img
}

describe('세선화와 뼈대 추적', () => {
  it('굵은 가로 막대는 한 줄 두께의 뼈대가 됩니다', () => {
    const bar = paint(60, 30, (x, y) => x >= 5 && x < 55 && y >= 10 && y < 20)
    const skeleton = thin(bar)
    for (let x = 10; x < 50; x++) {
      let count = 0
      for (let y = 0; y < 30; y++) count += skeleton.data[y * 60 + x]!
      expect(count).toBe(1)
    }
  })

  it('ㄱ자(꺾인 획)는 한 획으로 추적합니다', () => {
    const shape = paint(
      80,
      80,
      (x, y) => (y >= 10 && y < 18 && x >= 8 && x < 60) || (x >= 52 && x < 60 && y >= 10 && y < 70),
    )
    const strokes = traceSkeleton(thin(shape), { spurLength: 6 })
    expect(strokes).toHaveLength(1)
    expect(strokes[0]!.closed).toBe(false)
    const simplified = simplifyPolyline(strokes[0]!.points, 2, false)
    expect(simplified.length).toBeLessThanOrEqual(4)
  })

  it('+자 교차는 곧게 이어지는 가지끼리 두 획으로 잇습니다', () => {
    const plus = paint(
      90,
      90,
      (x, y) => (y >= 41 && y < 49 && x >= 5 && x < 85) || (x >= 41 && x < 49 && y >= 5 && y < 85),
    )
    const strokes = traceSkeleton(thin(plus), { spurLength: 6 })
    expect(strokes).toHaveLength(2)
    for (const s of strokes) {
      const first = s.points[0]!
      const last = s.points[s.points.length - 1]!
      expect(Math.hypot(last.x - first.x, last.y - first.y)).toBeGreaterThan(60)
    }
  })

  it('고리(ㅇ)는 닫힌 획이 되고 타원으로 알아봅니다', () => {
    const ring = paint(100, 100, (x, y) => {
      const r = Math.hypot((x - 50) / 36, (y - 50) / 28)
      return r > 0.85 && r < 1.12
    })
    const strokes = traceSkeleton(thin(ring), { spurLength: 6 })
    expect(strokes).toHaveLength(1)
    expect(strokes[0]!.closed).toBe(true)
    const ellipse = asEllipse(strokes[0]!.points)
    expect(ellipse).not.toBeNull()
    expect(ellipse!.rx).toBeGreaterThan(ellipse!.ry)
  })
})

describe('원근 변환과 이진화', () => {
  it('네 점 쌍으로 구한 변환이 점들을 정확히 옮깁니다', () => {
    const src = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 140 },
      { x: 0, y: 140 },
    ]
    const dst = [
      { x: 30, y: 20 },
      { x: 410, y: 60 },
      { x: 380, y: 600 },
      { x: 10, y: 560 },
    ]
    const h = solveHomography(src, dst)!
    src.forEach((p, i) => {
      const q = applyHomography(h, p)
      expect(q.x).toBeCloseTo(dst[i]!.x, 6)
      expect(q.y).toBeCloseTo(dst[i]!.y, 6)
    })
  })

  it('조명이 한쪽으로 어두워도 진한 네모만 잉크로 봅니다', () => {
    const img = createGray(200, 100)
    for (let y = 0; y < 100; y++)
      for (let x = 0; x < 200; x++) img.data[y * 200 + x] = Math.round(140 + x * 0.5)
    for (let y = 40; y < 60; y++) for (let x = 20; x < 40; x++) img.data[y * 200 + x] = 30
    const ink = adaptiveBinarize(img, { window: 60 })
    expect(countInk(ink)).toBeGreaterThanOrEqual(380)
    expect(countInk(ink)).toBeLessThanOrEqual(420)
  })

  it('Otsu 문턱값은 두 밝기 무리 사이에 있습니다', () => {
    const img = createGray(10, 10)
    img.data.fill(220)
    img.data.fill(40, 0, 30)
    const t = otsuThreshold(img)
    expect(t).toBeGreaterThanOrEqual(40)
    expect(t).toBeLessThan(220)
  })
})
