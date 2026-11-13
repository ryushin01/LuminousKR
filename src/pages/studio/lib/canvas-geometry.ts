import type { BodyFrame, Box, PlacedStroke, Point } from '@/entities/font'
import { ASCENDER } from '@/entities/font'

/** 음절 좌표(0~1, y 아래로) ↔ SVG 좌표(1em = 1000, 위가 0) */
export function toSvg(frame: BodyFrame, p: Point): Point {
  return {
    x: frame.x0 + p.x * (frame.x1 - frame.x0),
    y: ASCENDER - frame.yTop + p.y * (frame.yTop - frame.yBottom),
  }
}

export function fromSvg(frame: BodyFrame, p: Point): Point {
  return {
    x: (p.x - frame.x0) / (frame.x1 - frame.x0),
    y: (p.y - (ASCENDER - frame.yTop)) / (frame.yTop - frame.yBottom),
  }
}

export function boxToSvg(
  frame: BodyFrame,
  box: Box,
): { x: number; y: number; width: number; height: number } {
  const a = toSvg(frame, { x: box.x0, y: box.y0 })
  const b = toSvg(frame, { x: box.x1, y: box.y1 })
  return { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y }
}

/** 격자 칸 수에 맞춰 가장 가까운 격자점으로 옮깁니다. */
export function snapPoint(p: Point, divisions: number): Point {
  return { x: Math.round(p.x * divisions) / divisions, y: Math.round(p.y * divisions) / divisions }
}

export function clampPoint(p: Point, margin = 0.15): Point {
  return {
    x: Math.min(1 + margin, Math.max(-margin, p.x)),
    y: Math.min(1 + margin, Math.max(-margin, p.y)),
  }
}

export const samePoint = (a: Point, b: Point, epsilon = 1e-6) =>
  Math.abs(a.x - b.x) < epsilon && Math.abs(a.y - b.y) < epsilon

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** 획을 꺾은선으로 펼칩니다 (맞히기 판정·화면 표시용). */
export function strokePolyline(stroke: PlacedStroke): Point[] {
  if (stroke.kind === 'ellipse') {
    const out: Point[] = []
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI * 2
      out.push({ x: stroke.cx + Math.cos(a) * stroke.rx, y: stroke.cy + Math.sin(a) * stroke.ry })
    }
    return out
  }
  return stroke.closed && stroke.points.length > 2
    ? [...stroke.points, stroke.points[0]!]
    : stroke.points
}

export function distanceToStroke(p: Point, stroke: PlacedStroke): number {
  const line = strokePolyline(stroke)
  if (line.length === 1) return Math.hypot(p.x - line[0]!.x, p.y - line[0]!.y)
  let best = Infinity
  for (let i = 1; i < line.length; i++)
    best = Math.min(best, distanceToSegment(p, line[i - 1]!, line[i]!))
  return best
}

/** 점에서 가장 가까운 획 (허용 거리 안에서) */
export function hitStroke<T extends PlacedStroke & { id: string }>(
  p: Point,
  strokes: readonly T[],
  tolerance: number,
): T | null {
  let best: T | null = null
  let bestDistance = tolerance
  for (const stroke of strokes) {
    const d = distanceToStroke(p, stroke)
    if (d <= bestDistance) {
      best = stroke
      bestDistance = d
    }
  }
  return best
}

/** 점에서 가장 가까운 꼭짓점 (경로 획만) */
export function hitNode(
  p: Point,
  strokes: readonly (PlacedStroke & { id: string })[],
  tolerance: number,
): { id: string; index: number } | null {
  let best: { id: string; index: number } | null = null
  let bestDistance = tolerance
  for (const stroke of strokes) {
    if (stroke.kind !== 'path') continue
    stroke.points.forEach((q, index) => {
      const d = Math.hypot(p.x - q.x, p.y - q.y)
      if (d <= bestDistance) {
        best = { id: stroke.id, index }
        bestDistance = d
      }
    })
  }
  return best
}

/** SVG path 데이터로 (뼈대 표시) */
export function strokeToSvgPath(frame: BodyFrame, stroke: PlacedStroke): string {
  const line = strokePolyline(stroke).map((p) => toSvg(frame, p))
  return line.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('')
}
