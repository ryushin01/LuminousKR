/** 시험 전용 도우미 (제품 코드에서 쓰지 않음) */
import { type Contour, type Point, cubicPoint } from '@/shared/lib/geometry'

/** 윤곽(0이 아닌 감김 규칙, CFF와 같음) 안에 점이 있는지. 곡선은 잘게 나눠 봅니다. */
export function insideContours(contours: readonly Contour[], p: Point): boolean {
  let winding = 0
  for (const c of contours) {
    const points: Point[] = [c.start]
    let from = c.start
    for (const s of c.segments) {
      if (s.type === 'L') points.push(s)
      else {
        for (let i = 1; i <= 16; i++) {
          points.push(
            cubicPoint(
              [from, { x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }, { x: s.x, y: s.y }],
              i / 16,
            ),
          )
        }
      }
      from = { x: s.x, y: s.y }
    }
    for (let i = 0; i < points.length; i++) {
      const a = points[i]!
      const b = points[(i + 1) % points.length]!
      if (a.y <= p.y && b.y > p.y && (b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y) > 0)
        winding += 1
      else if (a.y > p.y && b.y <= p.y && (b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y) < 0)
        winding -= 1
    }
  }
  return winding !== 0
}
