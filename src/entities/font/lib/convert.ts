import { mapFromBox, mapToBox } from '../model/layout.ts'
import type { Box, Stroke } from '../model/types.ts'
import type { PlacedStroke } from './resolve.ts'

/** 저장된 획을 음절 좌표로 */
export function strokeToSyllable(stroke: Stroke, box: Box): PlacedStroke & { id: string } {
  if (stroke.kind === 'path') {
    return {
      id: stroke.id,
      kind: 'path',
      points: stroke.points.map((p) => mapToBox(box, p.x, p.y)),
      closed: stroke.closed,
      smooth: stroke.smooth,
    }
  }
  const c = mapToBox(box, stroke.cx, stroke.cy)
  return {
    id: stroke.id,
    kind: 'ellipse',
    cx: c.x,
    cy: c.y,
    rx: stroke.rx * (box.x1 - box.x0),
    ry: stroke.ry * (box.y1 - box.y0),
  }
}

/** 음절 좌표의 획을 저장 형식(틀 안 정규화 좌표)으로 */
export function strokeFromSyllable(stroke: PlacedStroke, box: Box, id: string): Stroke {
  const w = box.x1 - box.x0 || 1
  const h = box.y1 - box.y0 || 1
  const round = (v: number) => Math.round(v * 10000) / 10000
  if (stroke.kind === 'path') {
    return {
      id,
      kind: 'path',
      points: stroke.points.map((p) => {
        const q = mapFromBox(box, p.x, p.y)
        return { x: round(q.x), y: round(q.y) }
      }),
      closed: stroke.closed,
      smooth: stroke.smooth,
    }
  }
  const c = mapFromBox(box, stroke.cx, stroke.cy)
  return {
    id,
    kind: 'ellipse',
    cx: round(c.x),
    cy: round(c.y),
    rx: round(stroke.rx / w),
    ry: round(stroke.ry / h),
  }
}
