import type {
  Box,
  Drawing,
  FontProject,
  JamoKey,
  LayoutId,
  PlacedStroke,
  Point,
} from '@/entities/font'
import { defaultLatinWidth, homeLayout, mapFromBox, strokeFromSyllable } from '@/entities/font'

/**
 * 그림(정규화 틀 좌표)과 음절 좌표 사이를 오가며 프로젝트를 고치는 순수 함수들.
 * 모두 draft(Solid produce의 초안)를 직접 고칩니다.
 */

let idSeq = 0
/** @param prefix 자모 키(L0 …)나 영문 글자의 번호(U41 …) */
export function newStrokeId(prefix: string): string {
  idSeq += 1
  return `${prefix}-${Date.now().toString(36)}${idSeq.toString(36)}`
}

/** 자모 하나를 한 배치에서 고칠 때 */
export type JamoTarget = { key: JamoKey; layout: LayoutId }
/** 영문·숫자·문장부호 한 글자를 고칠 때 */
export type LatinTarget = { latin: string }
export type EditTarget = JamoTarget | LatinTarget

export const isLatinTarget = (target: EditTarget): target is LatinTarget => 'latin' in target

const idPrefix = (target: EditTarget) =>
  isLatinTarget(target) ? `U${target.latin.charCodeAt(0).toString(16)}` : target.key

/** 고칠 그림: 영문은 그 글자의 그림, 자모는 기본 배치면 기본 획·아니면 그 배치의 변형 */
export function drawingOf(project: FontProject, target: EditTarget): Drawing | undefined {
  if (isLatinTarget(target)) return project.latin[target.latin]?.drawing
  const entry = project.jamo[target.key]
  if (!entry) return undefined
  return target.layout === homeLayout(target.key) ? entry.base : entry.variants?.[target.layout]
}

function ensureDrawing(draft: FontProject, target: EditTarget): Drawing {
  if (isLatinTarget(target)) {
    const entry = (draft.latin[target.latin] ??= {})
    return (entry.drawing ??= { strokes: [] })
  }
  const entry = (draft.jamo[target.key] ??= {})
  if (target.layout === homeLayout(target.key)) return (entry.base ??= { strokes: [] })
  const variants = (entry.variants ??= {})
  return (variants[target.layout] ??= { strokes: [] })
}

export function addStroke(
  draft: FontProject,
  target: EditTarget,
  box: Box,
  stroke: PlacedStroke,
): string {
  const id = newStrokeId(idPrefix(target))
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
  drawing.strokes = strokes.map((s) => strokeFromSyllable(s, box, newStrokeId(idPrefix(target))))
}

/** 이 배치의 그림을 비웁니다 (빈 그림이 남아 파생 규칙 대신 '빈 자모'가 됨). */
export function clearDrawing(draft: FontProject, target: EditTarget): void {
  ensureDrawing(draft, target).strokes = []
}

/**
 * 직접 그린 것을 지웁니다: 영문은 기본 뼈대로, 자모의 기본 배치면 파생(자동)으로,
 * 다른 배치면 기본 획으로 돌아갑니다.
 */
export function removeDrawing(draft: FontProject, target: EditTarget): void {
  if (isLatinTarget(target)) {
    const entry = draft.latin[target.latin]
    if (!entry) return
    delete entry.drawing
    if (entry.width === undefined) delete draft.latin[target.latin]
    return
  }
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

/** 영문 글자의 뼈대 너비를 바꿉니다. 기본 너비와 같으면 고친 것으로 남기지 않습니다. */
export function setLatinWidth(draft: FontProject, char: string, width: number): void {
  if (Math.abs(width - defaultLatinWidth(char)) < 1e-9) {
    const entry = draft.latin[char]
    if (!entry) return
    delete entry.width
    if (!entry.drawing) delete draft.latin[char]
    return
  }
  ;(draft.latin[char] ??= {}).width = width
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
