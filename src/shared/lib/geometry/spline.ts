import type { Point } from './types.ts'
import { distance } from './vector.ts'

/** 3차 베지어 한 조각 (p0 → p3, 조절점 p1·p2) */
export type Cubic = [Point, Point, Point, Point]

const EPSILON = 1e-6

/**
 * 구심(centripetal, α = 0.5) 캣멀-롬 스플라인을 3차 베지어 조각들로 바꿉니다.
 * 점을 모두 지나는 매끄러운 곡선이 되며, 고리나 뾰족점이 잘 생기지 않습니다.
 */
export function catmullRomToCubics(points: readonly Point[], closed: boolean): Cubic[] {
  const n = points.length
  if (n < 2) return []
  const at = (i: number): Point => {
    if (closed) return points[((i % n) + n) % n]!
    if (i < 0) {
      const a = points[0]!
      const b = points[1]!
      return { x: 2 * a.x - b.x, y: 2 * a.y - b.y }
    }
    if (i >= n) {
      const a = points[n - 1]!
      const b = points[n - 2]!
      return { x: 2 * a.x - b.x, y: 2 * a.y - b.y }
    }
    return points[i]!
  }

  const cubics: Cubic[] = []
  const count = closed ? n : n - 1
  for (let i = 0; i < count; i++) {
    const p0 = at(i - 1)
    const p1 = at(i)
    const p2 = at(i + 1)
    const p3 = at(i + 2)
    const t01 = Math.max(Math.sqrt(distance(p0, p1)), EPSILON)
    const t12 = Math.max(Math.sqrt(distance(p1, p2)), EPSILON)
    const t23 = Math.max(Math.sqrt(distance(p2, p3)), EPSILON)
    const m1 = {
      x: p2.x - p1.x + t12 * ((p1.x - p0.x) / t01 - (p2.x - p0.x) / (t01 + t12)),
      y: p2.y - p1.y + t12 * ((p1.y - p0.y) / t01 - (p2.y - p0.y) / (t01 + t12)),
    }
    const m2 = {
      x: p2.x - p1.x + t12 * ((p3.x - p2.x) / t23 - (p3.x - p1.x) / (t12 + t23)),
      y: p2.y - p1.y + t12 * ((p3.y - p2.y) / t23 - (p3.y - p1.y) / (t12 + t23)),
    }
    cubics.push([
      p1,
      { x: p1.x + m1.x / 3, y: p1.y + m1.y / 3 },
      { x: p2.x - m2.x / 3, y: p2.y - m2.y / 3 },
      p2,
    ])
  }
  return cubics
}

export function cubicPoint([p0, p1, p2, p3]: Cubic, t: number): Point {
  const mt = 1 - t
  const a = mt * mt * mt
  const b = 3 * mt * mt * t
  const c = 3 * mt * t * t
  const d = t * t * t
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  }
}

/** 베지어를 꺾은선으로 펼칩니다. 조절 다각형 길이에 맞춰 step 간격으로 나눕니다. */
export function flattenCubic(cubic: Cubic, step: number, includeStart: boolean): Point[] {
  const [p0, p1, p2, p3] = cubic
  const hull = distance(p0, p1) + distance(p1, p2) + distance(p2, p3)
  const parts = Math.min(96, Math.max(2, Math.ceil(hull / step)))
  const out: Point[] = includeStart ? [p0] : []
  for (let i = 1; i <= parts; i++) out.push(cubicPoint(cubic, i / parts))
  return out
}

/** 타원 둘레를 점으로 펼칩니다 (시작점 반복 없음). */
export function flattenEllipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  step: number,
): Point[] {
  const perimeter = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)))
  const count = Math.min(192, Math.max(24, Math.ceil(perimeter / step)))
  const out: Point[] = []
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    out.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry })
  }
  return out
}
