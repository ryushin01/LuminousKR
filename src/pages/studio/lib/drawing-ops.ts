import type {
  Box,
  Drawing,
  FontProject,
  JamoKey,
  LayoutId,
  PlacedStroke,
  Point,
  Stroke,
} from '@/entities/font'
import { homeLayout, mapFromBox, mapToBox } from '@/entities/font'

/**
 * 그림(정규화 틀 좌표)과 음절 좌표 사이를 오가며 프로젝트를 고치는 순수 함수들.
 * 모두 draft(Solid produce의 초안)를 직접 고칩니다.
 */

let idSeq = 0
export function newStrokeId(key: JamoKey): string {
  idSeq += 1
  return `${key}-${Date.now().toString(36)}${idSeq.toString(36)}`
}

export type EditTarget = { key: JamoKey; layout: LayoutId }

/** 이 배치에서 고칠 그림: 기본 배치면 기본 획, 아니면 그 배치의 변형 */
export function drawingOf(project: FontProject, target: EditTarget): Drawing | undefined {
  const entry = project.jamo[target.key]
  if (!entry) return undefined
  return target.layout === homeLayout(target.key) ? entry.base : entry.variants?.[target.layout]
}

function ensureDrawing(draft: FontProject, target: EditTarget): Drawing {
  const entry = (draft.jamo[target.key] ??= {})
  if (target.layout === homeLayout(target.key)) return (entry.base ??= { strokes: [] })
  const variants = (entry.variants ??= {})
  return (variants[target.layout] ??= { strokes: [] })
}

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

export function addStroke(
  draft: FontProject,
  target: EditTarget,
  box: Box,
  stroke: PlacedStroke,
): string {
  const id = newStrokeId(target.key)
  ensureDrawing(draft, target).strokes.push(strokeFromSyllable(stroke, box, id))
  return id
}

export function removeStroke(draft: FontProject, target: EditTarget, id: string): void {
  const drawing = drawingOf(draft, target)
  if (!drawing) return
  const index = drawing.strokes.findIndex((s) => s.id === id)
  if (index >= 0) drawing.strokes.splice(index, 1)
}

/** 획 전체를 음절 좌표 (dx, dy)만큼 옮깁니다. */
export function moveStroke(
  draft: FontProject,
  target: EditTarget,
  box: Box,
  id: string,
  delta: Point,
): void {
  const stroke = drawingOf(draft, target)?.strokes.find((s) => s.id === id)
  if (!stroke) return
  const du = delta.x / (box.x1 - box.x0 || 1)
  const dv = delta.y / (box.y1 - box.y0 || 1)
  if (stroke.kind === 'path') {
    for (const p of stroke.points) {
      p.x += du
      p.y += dv
    }
  } else {
    stroke.cx += du
    stroke.cy += dv
  }
}

/** 경로 획의 꼭짓점 하나를 음절 좌표의 점으로 옮깁니다. */
export function moveNode(
  draft: FontProject,
  target: EditTarget,
  box: Box,
  id: string,
  index: number,
  to: Point,
): void {
  const stroke = drawingOf(draft, target)?.strokes.find((s) => s.id === id)
  if (stroke?.kind !== 'path' || !stroke.points[index]) return
  const q = mapFromBox(box, to.x, to.y)
  stroke.points[index] = { x: q.x, y: q.y }
}

export function setStrokeSmooth(
  draft: FontProject,
  target: EditTarget,
  id: string,
  smooth: boolean,
): void {
  const stroke = drawingOf(draft, target)?.strokes.find((s) => s.id === id)
  if (stroke?.kind === 'path') stroke.smooth = smooth
}

/** 자동(파생)·기본 획을 이 배치의 그림으로 옮겨 와 직접 고칠 수 있게 합니다. */
export function adoptStrokes(
  draft: FontProject,
  target: EditTarget,
  box: Box,
  strokes: readonly PlacedStroke[],
): void {
  const drawing = ensureDrawing(draft, target)
  drawing.strokes = strokes.map((s) => strokeFromSyllable(s, box, newStrokeId(target.key)))
}

/** 이 배치의 그림을 비웁니다 (빈 그림이 남아 파생 규칙 대신 '빈 자모'가 됨). */
export function clearDrawing(draft: FontProject, target: EditTarget): void {
  ensureDrawing(draft, target).strokes = []
}

/** 직접 그린 것을 지웁니다: 기본 배치면 파생(자동)으로, 다른 배치면 기본 획으로 돌아갑니다. */
export function removeDrawing(draft: FontProject, target: EditTarget): void {
  const entry = draft.jamo[target.key]
  if (!entry) return
  if (target.layout === homeLayout(target.key)) {
    delete entry.base
  } else if (entry.variants) {
    delete entry.variants[target.layout]
    if (Object.keys(entry.variants).length === 0) delete entry.variants
  }
  if (!entry.base && !entry.variants) delete draft.jamo[target.key]
}

/** 두 점으로 정한 사각형에 들어가는 타원 */
export function ellipseFromCorners(a: Point, b: Point): PlacedStroke {
  return {
    kind: 'ellipse',
    cx: (a.x + b.x) / 2,
    cy: (a.y + b.y) / 2,
    rx: Math.abs(b.x - a.x) / 2,
    ry: Math.abs(b.y - a.y) / 2,
  }
}
