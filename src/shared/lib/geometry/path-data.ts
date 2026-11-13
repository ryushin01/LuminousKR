import type { Contour, Point, Rect } from './types.ts'

export type Transform = (p: Point) => Point

/** 윤곽선의 모든 점(조절점 포함)에 변환을 적용합니다. 아핀 변환이면 곡선 모양이 그대로 유지됩니다. */
export function transformContours(contours: readonly Contour[], fn: Transform): Contour[] {
  return contours.map((c) => ({
    start: fn(c.start),
    segments: c.segments.map((s) => {
      const end = fn({ x: s.x, y: s.y })
      if (s.type === 'L') return { type: 'L' as const, x: end.x, y: end.y }
      const c1 = fn({ x: s.x1, y: s.y1 })
      const c2 = fn({ x: s.x2, y: s.y2 })
      return { type: 'C' as const, x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y, x: end.x, y: end.y }
    }),
  }))
}

/** 좌표를 정수로 맞추고 길이 0인 조각을 지웁니다. */
export function roundContours(contours: readonly Contour[]): Contour[] {
  const r = Math.round
  return contours
    .map((c) => {
      const start = { x: r(c.start.x), y: r(c.start.y) }
      let prev = start
      const segments = []
      for (const s of c.segments) {
        const end = { x: r(s.x), y: r(s.y) }
        if (s.type === 'L') {
          if (end.x === prev.x && end.y === prev.y) continue
          segments.push({ type: 'L' as const, ...end })
        } else {
          const c1 = { x: r(s.x1), y: r(s.y1) }
          const c2 = { x: r(s.x2), y: r(s.y2) }
          const degenerate =
            end.x === prev.x &&
            end.y === prev.y &&
            c1.x === prev.x &&
            c1.y === prev.y &&
            c2.x === prev.x &&
            c2.y === prev.y
          if (degenerate) continue
          segments.push({ type: 'C' as const, x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y, ...end })
        }
        prev = end
      }
      return { start, segments }
    })
    .filter((c) => c.segments.length >= 2)
}

const fmt = (n: number) => {
  const v = Math.round(n * 10) / 10
  return Object.is(v, -0) ? '0' : String(v)
}

/**
 * SVG path 데이터로 바꿉니다.
 * flipY를 주면 y = flipY - y로 뒤집어 화면 좌표(아래로 커짐)에 맞춥니다.
 */
export function contoursToSvgPath(contours: readonly Contour[], flipY?: number): string {
  const y = (v: number) => (flipY === undefined ? v : flipY - v)
  let d = ''
  for (const c of contours) {
    d += `M${fmt(c.start.x)} ${fmt(y(c.start.y))}`
    for (const s of c.segments) {
      if (s.type === 'L') d += `L${fmt(s.x)} ${fmt(y(s.y))}`
      else
        d += `C${fmt(s.x1)} ${fmt(y(s.y1))} ${fmt(s.x2)} ${fmt(y(s.y2))} ${fmt(s.x)} ${fmt(y(s.y))}`
    }
    d += 'Z'
  }
  return d
}

/** 끝점과 조절점을 모두 감싸는 사각형 (곡선이 조절 다각형 안에 있으므로 넉넉한 경계) */
export function contoursBounds(contours: readonly Contour[]): Rect | null {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  const visit = (x: number, y: number) => {
    if (x < x0) x0 = x
    if (y < y0) y0 = y
    if (x > x1) x1 = x
    if (y > y1) y1 = y
  }
  for (const c of contours) {
    visit(c.start.x, c.start.y)
    for (const s of c.segments) {
      visit(s.x, s.y)
      if (s.type === 'C') {
        visit(s.x1, s.y1)
        visit(s.x2, s.y2)
      }
    }
  }
  return x0 === Infinity ? null : { x0, y0, x1, y1 }
}
