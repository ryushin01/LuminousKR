import type { Cubic } from './spline.ts'
import type { Contour, Point, Segment } from './types.ts'
import { add, distance, dot, normalize, scale, sub, turnAngle } from './vector.ts'

/**
 * 꺾은선 다각형을 직선과 3차 베지어로 된 윤곽선으로 되돌립니다.
 *
 * 획 두께를 입힐 때 둥근 끝·둥근 꺾임은 잘게 나눈 점으로 나오므로, 그대로 쓰면 점이 많고
 * 크게 보면 각져 보입니다. 길게 곧은 변은 직선으로 두고, 짧은 변이 이어진 부분만
 * Schneider 알고리즘(Graphics Gems, 1990)으로 베지어에 맞춥니다.
 */
export type FitOptions = {
  /** 허용 오차 (좌표 단위) */
  tolerance: number
  /** 이 각도(라디안) 이상 꺾이면 모서리로 남깁니다. */
  cornerAngle: number
  /** 이 길이 이상인 변은 직선으로 남깁니다. */
  lineLength: number
}

export const DEFAULT_FIT: FitOptions = {
  tolerance: 0.6,
  cornerAngle: (28 * Math.PI) / 180,
  lineLength: 12,
}

const MAX_ITERATIONS = 16
const MAX_DEPTH = 14

export function fitClosedPolygon(
  input: readonly Point[],
  options: FitOptions = DEFAULT_FIT,
): Contour | null {
  const points = dedupe(input)
  const n = points.length
  if (n < 3) return null

  const edgeLong: boolean[] = []
  for (let i = 0; i < n; i++) {
    edgeLong.push(distance(points[i]!, points[(i + 1) % n]!) >= options.lineLength)
  }
  const corner: boolean[] = []
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n]!
    const curr = points[i]!
    const next = points[(i + 1) % n]!
    const angle = turnAngle(sub(curr, prev), sub(next, curr))
    const bothLong = edgeLong[(i - 1 + n) % n]! && edgeLong[i]!
    corner.push(angle >= options.cornerAngle || bothLong)
  }

  // 시작점: 모서리이거나 직선·곡선이 바뀌는 점
  let start = -1
  for (let i = 0; i < n; i++) {
    if (corner[i] || edgeLong[i] !== edgeLong[(i - 1 + n) % n]) {
      start = i
      break
    }
  }

  const tolerance2 = options.tolerance * options.tolerance

  if (start === -1) {
    // 모서리 없는 매끈한 고리(타원 등): 한 점에서 끊어 앞뒤 접선을 같게 맞춤
    if (edgeLong[0]) return polygonContour(points)
    const loop = [...points, points[0]!]
    const tangent = normalize(sub(points[1]!, points[n - 1]!))
    const cubics: Cubic[] = []
    fitCubic(loop, 0, loop.length - 1, tangent, scale(tangent, -1), tolerance2, cubics, 0)
    return { start: points[0]!, segments: cubics.map(cubicSegment) }
  }

  const segments: Segment[] = []
  let k = 0
  while (k < n) {
    const i = (start + k) % n
    if (edgeLong[i]) {
      const end = points[(i + 1) % n]!
      segments.push({ type: 'L', x: end.x, y: end.y })
      k += 1
      continue
    }
    // 짧은 변이 이어지는 구간을 모읍니다 (모서리나 긴 변을 만나면 끝)
    const run: Point[] = [points[i]!]
    let m = k
    while (m < n) {
      const e = (start + m) % n
      if (edgeLong[e]) break
      run.push(points[(e + 1) % n]!)
      m += 1
      const vertex = (start + m) % n
      if (m < n && corner[vertex]) break
    }
    if (run.length === 2) {
      const end = run[1]!
      segments.push({ type: 'L', x: end.x, y: end.y })
    } else {
      const first = (start + k) % n
      const last = (start + m) % n
      const prevEdge = (first - 1 + n) % n
      const tHat1 =
        !corner[first] && edgeLong[prevEdge]
          ? normalize(sub(points[first]!, points[prevEdge]!))
          : normalize(sub(run[1]!, run[0]!))
      const tHat2 =
        !corner[last] && edgeLong[last]
          ? normalize(sub(points[last]!, points[(last + 1) % n]!))
          : normalize(sub(run[run.length - 2]!, run[run.length - 1]!))
      const cubics: Cubic[] = []
      fitCubic(run, 0, run.length - 1, tHat1, tHat2, tolerance2, cubics, 0)
      for (const c of cubics) segments.push(cubicSegment(c))
    }
    k = m
  }
  return { start: points[start]!, segments }
}

function polygonContour(points: readonly Point[]): Contour {
  const segments: Segment[] = points.slice(1).map((p) => ({ type: 'L' as const, x: p.x, y: p.y }))
  segments.push({ type: 'L', x: points[0]!.x, y: points[0]!.y })
  return { start: points[0]!, segments }
}

function cubicSegment([, c1, c2, end]: Cubic): Segment {
  return { type: 'C', x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y, x: end.x, y: end.y }
}

/** 이보다 가까운 점은 하나로 봅니다. 정수 격자 반올림에서 생긴 잔떨림을 없앱니다. */
const MIN_EDGE = 1
/** 이보다 크게 되돌아가는 점(바늘처럼 튀어나온 점)은 지웁니다. */
const SPIKE_ANGLE = (150 * Math.PI) / 180

function dedupe(points: readonly Point[]): Point[] {
  const out: Point[] = []
  for (const p of points) {
    const last = out[out.length - 1]
    if (!last || distance(last, p) >= MIN_EDGE) out.push(p)
  }
  while (out.length > 2 && distance(out[0]!, out[out.length - 1]!) < MIN_EDGE) out.pop()
  let removed = true
  while (removed && out.length > 3) {
    removed = false
    for (let i = 0; i < out.length; i++) {
      const n = out.length
      const prev = out[(i - 1 + n) % n]!
      const curr = out[i]!
      const next = out[(i + 1) % n]!
      if (turnAngle(sub(curr, prev), sub(next, curr)) > SPIKE_ANGLE) {
        out.splice(i, 1)
        removed = true
        break
      }
    }
  }
  return out
}

/* ── Schneider 곡선 맞춤 ── */

function fitCubic(
  d: readonly Point[],
  first: number,
  last: number,
  tHat1: Point,
  tHat2: Point,
  error2: number,
  out: Cubic[],
  depth: number,
): void {
  const p0 = d[first]!
  const p3 = d[last]!
  if (last - first === 1 || depth > MAX_DEPTH) {
    if (depth > MAX_DEPTH) {
      for (let i = first + 1; i <= last; i++) out.push(lineCubic(d[i - 1]!, d[i]!))
      return
    }
    const dist = distance(p0, p3) / 3
    out.push([p0, add(p0, scale(tHat1, dist)), add(p3, scale(tHat2, dist)), p3])
    return
  }

  let u = chordLengthParameterize(d, first, last)
  let bezier = generateBezier(d, first, last, u, tHat1, tHat2)
  let { maxError, splitPoint } = computeMaxError(d, first, last, bezier, u)
  if (maxError < error2) {
    out.push(bezier)
    return
  }
  if (maxError < error2 * 16) {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const uPrime = reparameterize(d, first, last, u, bezier)
      bezier = generateBezier(d, first, last, uPrime, tHat1, tHat2)
      ;({ maxError, splitPoint } = computeMaxError(d, first, last, bezier, uPrime))
      if (maxError < error2) {
        out.push(bezier)
        return
      }
      u = uPrime
    }
  }
  const center = Math.min(last - 1, Math.max(first + 1, splitPoint))
  const tHatCenter = normalize(sub(d[center - 1]!, d[center + 1]!))
  fitCubic(d, first, center, tHat1, tHatCenter, error2, out, depth + 1)
  fitCubic(d, center, last, scale(tHatCenter, -1), tHat2, error2, out, depth + 1)
}

function lineCubic(a: Point, b: Point): Cubic {
  return [
    a,
    { x: a.x + (b.x - a.x) / 3, y: a.y + (b.y - a.y) / 3 },
    { x: a.x + ((b.x - a.x) * 2) / 3, y: a.y + ((b.y - a.y) * 2) / 3 },
    b,
  ]
}

function chordLengthParameterize(d: readonly Point[], first: number, last: number): number[] {
  const u = [0]
  for (let i = first + 1; i <= last; i++) u.push(u[u.length - 1]! + distance(d[i]!, d[i - 1]!))
  const total = u[u.length - 1]!
  return total > 0 ? u.map((v) => v / total) : u.map((_, i) => i / (u.length - 1))
}

const b0 = (t: number) => (1 - t) * (1 - t) * (1 - t)
const b1 = (t: number) => 3 * t * (1 - t) * (1 - t)
const b2 = (t: number) => 3 * t * t * (1 - t)
const b3 = (t: number) => t * t * t

function generateBezier(
  d: readonly Point[],
  first: number,
  last: number,
  u: readonly number[],
  tHat1: Point,
  tHat2: Point,
): Cubic {
  const p0 = d[first]!
  const p3 = d[last]!
  let c00 = 0
  let c01 = 0
  let c11 = 0
  let x0 = 0
  let x1 = 0
  for (let i = 0; i < u.length; i++) {
    const t = u[i]!
    const a0 = scale(tHat1, b1(t))
    const a1 = scale(tHat2, b2(t))
    c00 += dot(a0, a0)
    c01 += dot(a0, a1)
    c11 += dot(a1, a1)
    const base = {
      x: p0.x * (b0(t) + b1(t)) + p3.x * (b2(t) + b3(t)),
      y: p0.y * (b0(t) + b1(t)) + p3.y * (b2(t) + b3(t)),
    }
    const tmp = sub(d[first + i]!, base)
    x0 += dot(a0, tmp)
    x1 += dot(a1, tmp)
  }
  const det = c00 * c11 - c01 * c01
  let alphaL = det === 0 ? 0 : (x0 * c11 - x1 * c01) / det
  let alphaR = det === 0 ? 0 : (c00 * x1 - c01 * x0) / det
  const segLength = distance(p0, p3)
  const epsilon = 1e-6 * segLength
  if (alphaL < epsilon || alphaR < epsilon || alphaL > segLength * 2 || alphaR > segLength * 2) {
    alphaL = segLength / 3
    alphaR = segLength / 3
  }
  return [p0, add(p0, scale(tHat1, alphaL)), add(p3, scale(tHat2, alphaR)), p3]
}

function bezierAt(c: Cubic, t: number): Point {
  return {
    x: b0(t) * c[0].x + b1(t) * c[1].x + b2(t) * c[2].x + b3(t) * c[3].x,
    y: b0(t) * c[0].y + b1(t) * c[1].y + b2(t) * c[2].y + b3(t) * c[3].y,
  }
}

function reparameterize(
  d: readonly Point[],
  first: number,
  last: number,
  u: readonly number[],
  bezier: Cubic,
): number[] {
  const out: number[] = []
  for (let i = first; i <= last; i++) out.push(newtonRaphson(bezier, d[i]!, u[i - first]!))
  return out
}

function newtonRaphson(q: Cubic, p: Point, u: number): number {
  const q1: [Point, Point, Point] = [
    scale(sub(q[1], q[0]), 3),
    scale(sub(q[2], q[1]), 3),
    scale(sub(q[3], q[2]), 3),
  ]
  const q2: [Point, Point] = [scale(sub(q1[1], q1[0]), 2), scale(sub(q1[2], q1[1]), 2)]
  const qu = bezierAt(q, u)
  const mt = 1 - u
  const q1u = {
    x: q1[0].x * mt * mt + q1[1].x * 2 * mt * u + q1[2].x * u * u,
    y: q1[0].y * mt * mt + q1[1].y * 2 * mt * u + q1[2].y * u * u,
  }
  const q2u = { x: q2[0].x * mt + q2[1].x * u, y: q2[0].y * mt + q2[1].y * u }
  const diff = sub(qu, p)
  const numerator = dot(diff, q1u)
  const denominator = dot(q1u, q1u) + dot(diff, q2u)
  if (denominator === 0) return u
  return Math.min(1, Math.max(0, u - numerator / denominator))
}

function computeMaxError(
  d: readonly Point[],
  first: number,
  last: number,
  bezier: Cubic,
  u: readonly number[],
): { maxError: number; splitPoint: number } {
  let maxError = 0
  let splitPoint = Math.floor((last - first + 1) / 2) + first
  for (let i = first + 1; i < last; i++) {
    const p = bezierAt(bezier, u[i - first]!)
    const v = sub(p, d[i]!)
    const dist = v.x * v.x + v.y * v.y
    if (dist >= maxError) {
      maxError = dist
      splitPoint = i
    }
  }
  return { maxError, splitPoint }
}
