import type { Point, Rect } from './types.ts'

export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y })
export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y })
export const scale = (a: Point, s: number): Point => ({ x: a.x * s, y: a.y * s })
export const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y
export const cross = (a: Point, b: Point): number => a.x * b.y - a.y * b.x
export const length = (a: Point): number => Math.hypot(a.x, a.y)
export const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y)

export function normalize(a: Point): Point {
  const len = Math.hypot(a.x, a.y)
  return len < 1e-12 ? { x: 0, y: 0 } : { x: a.x / len, y: a.y / len }
}

export function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

/** 두 방향 사이의 꺾인 각도(라디안, 0~π) */
export function turnAngle(incoming: Point, outgoing: Point): number {
  const a = normalize(incoming)
  const b = normalize(outgoing)
  return Math.acos(Math.max(-1, Math.min(1, dot(a, b))))
}

export function rectOfPoints(points: readonly Point[]): Rect {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const p of points) {
    if (p.x < x0) x0 = p.x
    if (p.y < y0) y0 = p.y
    if (p.x > x1) x1 = p.x
    if (p.y > y1) y1 = p.y
  }
  return { x0, y0, x1, y1 }
}

export function unionRect(a: Rect, b: Rect): Rect {
  return {
    x0: Math.min(a.x0, b.x0),
    y0: Math.min(a.y0, b.y0),
    x1: Math.max(a.x1, b.x1),
    y1: Math.max(a.y1, b.y1),
  }
}

export function rectsOverlap(a: Rect, b: Rect, margin = 0): boolean {
  return (
    a.x0 - margin < b.x1 && b.x0 - margin < a.x1 && a.y0 - margin < b.y1 && b.y0 - margin < a.y1
  )
}

/** 다각형의 부호 있는 넓이 (y가 위로 커지는 좌표에서 반시계 방향이면 양수) */
export function signedArea(points: readonly Point[]): number {
  let sum = 0
  for (let i = 0, n = points.length; i < n; i++) {
    const a = points[i]!
    const b = points[(i + 1) % n]!
    sum += a.x * b.y - b.x * a.y
  }
  return sum / 2
}
