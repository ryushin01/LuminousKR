import { derivationOf } from '../model/derivation.ts'
import { frameBox, homeLayout, mapToBox, subBox } from '../model/layout.ts'
import type { Box, Drawing, FontProject, JamoKey, LayoutId, Point } from '../model/types.ts'

/** 음절 좌표(0~1, y 아래로)로 옮긴 획 */
export type PlacedStroke =
  | { kind: 'path'; points: Point[]; closed: boolean; smooth: boolean }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }

/** 원(ㅇ·ㅎ)이 틀 비율 때문에 지나치게 납작해지지 않도록 허용하는 늘임 정도 */
const ELLIPSE_STRETCH_ALLOWANCE = 1.12

const width = (b: Box) => b.x1 - b.x0
const height = (b: Box) => b.y1 - b.y0

/**
 * 정규화 좌표로 저장된 그림을 target 틀에 놓습니다.
 * 선은 틀에 맞춰 늘이고, 타원은 기준 틀(ref)에서 보이던 비율을 되도록 지킵니다.
 */
export function placeDrawing(drawing: Drawing, ref: Box, target: Box): PlacedStroke[] {
  const sx = width(target) / (width(ref) || 1)
  const sy = height(target) / (height(ref) || 1)
  const uniform = Math.sqrt(Math.abs(sx * sy))
  return drawing.strokes.map((stroke): PlacedStroke => {
    if (stroke.kind === 'path') {
      return {
        kind: 'path',
        points: stroke.points.map((p) => mapToBox(target, p.x, p.y)),
        closed: stroke.closed,
        smooth: stroke.smooth,
      }
    }
    const center = mapToBox(target, stroke.cx, stroke.cy)
    const rxRef = stroke.rx * width(ref)
    const ryRef = stroke.ry * height(ref)
    return {
      kind: 'ellipse',
      cx: center.x,
      cy: center.y,
      rx: Math.min(rxRef * uniform, rxRef * sx * ELLIPSE_STRETCH_ALLOWANCE),
      ry: Math.min(ryRef * uniform, ryRef * sy * ELLIPSE_STRETCH_ALLOWANCE),
    }
  })
}

export type ResolveOptions = {
  /** 나란히 놓는 두 자모 사이 간격 (음절 좌표) */
  pairGap: number
}

/**
 * 자모를 배치에 놓았을 때의 획을 구합니다.
 * 1) 그 배치의 변형(벌) → 2) 직접 그린 기본 획 → 3) 파생 규칙 순으로 찾습니다.
 */
export function resolveJamo(
  project: FontProject,
  key: JamoKey,
  layout: LayoutId,
  options: ResolveOptions,
  target?: Box,
  useVariants = true,
  depth = 0,
): PlacedStroke[] {
  const frame = target ?? frameBox(project.layouts, key, layout)
  const entry = project.jamo[key]
  const variant = useVariants ? entry?.variants?.[layout] : undefined
  if (variant) return placeDrawing(variant, frameBox(project.layouts, key, layout), frame)
  if (entry?.base) {
    return placeDrawing(entry.base, frameBox(project.layouts, key, homeLayout(key)), frame)
  }
  if (depth > 4) return []
  const gap = options.pairGap / (width(frame) || 1)
  const parts = derivationOf(key, layout, project.layouts, gap)
  if (!parts) return []
  return parts.flatMap((part) =>
    resolveJamo(
      project,
      part.key,
      layout,
      options,
      subBox(frame, part.rel),
      useVariants && part.inherit,
      depth + 1,
    ),
  )
}

/** 직접 그린 획이 있는지(기본 또는 그 배치의 변형) */
export function hasOwnDrawing(project: FontProject, key: JamoKey, layout?: LayoutId): boolean {
  const entry = project.jamo[key]
  if (!entry) return false
  if (layout && entry.variants?.[layout]) return true
  return Boolean(entry.base && entry.base.strokes.length > 0)
}
