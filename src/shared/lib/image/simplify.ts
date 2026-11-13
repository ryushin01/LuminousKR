import type { Point } from '../geometry/index.ts'

/** 점에서 선분 a–b까지의 거리 (무한 직선이 아니라 선분이라, 되돌아가는 획의 끝을 잃지 않음) */
function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

function rdp(points: readonly Point[], epsilon: number): Point[] {
  if (points.length < 3) return [...points]
  let index = 0
  let max = 0
  const first = points[0]!
  const last = points[points.length - 1]!
  for (let i = 1; i < points.length - 1; i++) {
    const d = distanceToSegment(points[i]!, first, last)
    if (d > max) {
      max = d
      index = i
    }
  }
  if (max <= epsilon) return [first, last]
  const left = rdp(points.slice(0, index + 1), epsilon)
  const right = rdp(points.slice(index), epsilon)
  return [...left.slice(0, -1), ...right]
}

/** Ramer–Douglas–Peucker 꺾은선 단순화. 닫힌 선은 가장 먼 두 점에서 나눠 줄입니다. */
export function simplifyPolyline(
  points: readonly Point[],
  epsilon: number,
  closed: boolean,
): Point[] {
  if (!closed) return rdp(points, epsilon)
  if (points.length < 4) return [...points]
  let far = 0
  let best = 0
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i]!.x - points[0]!.x, points[i]!.y - points[0]!.y)
    if (d > best) {
      best = d
      far = i
    }
  }
  const first = rdp(points.slice(0, far + 1), epsilon)
  const second = rdp([...points.slice(far), points[0]!], epsilon)
  return [...first.slice(0, -1), ...second.slice(0, -1)]
}

/** 꺾은선이 타원에 가까우면 그 타원을 돌려줍니다 (ㅇ 인식). */
export function asEllipse(
  points: readonly Point[],
  tolerance = 0.13,
): { cx: number; cy: number; rx: number; ry: number } | null {
  if (points.length < 8) return null
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const p of points) {
    x0 = Math.min(x0, p.x)
    y0 = Math.min(y0, p.y)
    x1 = Math.max(x1, p.x)
    y1 = Math.max(y1, p.y)
  }
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const rx = (x1 - x0) / 2
  const ry = (y1 - y0) / 2
  if (rx <= 0 || ry <= 0) return null
  let sum = 0
  let worst = 0
  for (const p of points) {
    const r = Math.hypot((p.x - cx) / rx, (p.y - cy) / ry)
    const error = Math.abs(r - 1)
    sum += error
    worst = Math.max(worst, error)
  }
  return sum / points.length < tolerance && worst < tolerance * 2.6 ? { cx, cy, rx, ry } : null
}
