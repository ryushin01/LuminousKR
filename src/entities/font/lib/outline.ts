import {
  ClipperOffset,
  EndType,
  FillRule,
  JoinType,
  union,
  type Path64,
  type Paths64,
} from 'clipper2-ts'
import {
  DEFAULT_FIT,
  catmullRomToCubics,
  fitClosedPolygon,
  flattenCubic,
  flattenEllipse,
  roundContours,
  transformContours,
  type Contour,
  type Point,
  type Rect,
} from '@/shared/lib/geometry'
import type { Metrics, StrokeStyle } from '../model/types.ts'
import type { PlacedStroke } from './resolve.ts'

/** 글꼴 세로 기준 (1em = 1000) */
export const UNITS_PER_EM = 1000
export const ASCENDER = 880
export const DESCENDER = -120
/** 한글 글자 몸의 세로 가운데 */
export const CENTER_Y = (ASCENDER + DESCENDER) / 2

/** 클리퍼는 정수 좌표를 쓰므로 1/8 단위까지 살립니다. */
const SCALE = 8
/** 둥근 끝을 점으로 나눌 때 허용하는 오차 (글꼴 단위) */
const ARC_TOLERANCE = 0.12
/** 곡선을 펼칠 간격 (글꼴 단위) */
const FLATTEN_STEP = 4

/** 음절 좌표(0~1)를 글꼴 좌표(y 위로)로 옮기는 틀 */
export type BodyFrame = { x0: number; x1: number; yTop: number; yBottom: number }

export function strokeWidths(style: StrokeStyle): { vertical: number; horizontal: number } {
  return { vertical: style.weight, horizontal: style.weight * style.contrast }
}

/**
 * 획 바깥이 글자 너비·높이 안에 들어오도록 뼈대가 놓일 범위를 정합니다.
 * 굵기가 커지면 뼈대 범위가 줄어듭니다.
 */
export function bodyFrame(metrics: Metrics, style: StrokeStyle): BodyFrame {
  const { vertical, horizontal } = strokeWidths(style)
  const half = metrics.height / 2 - horizontal / 2
  return {
    x0: metrics.sideBearing + vertical / 2,
    x1: metrics.advance - metrics.sideBearing - vertical / 2,
    yTop: CENTER_Y + half,
    yBottom: CENTER_Y - half,
  }
}

export function toFontUnits(frame: BodyFrame, p: Point): Point {
  return {
    x: frame.x0 + p.x * (frame.x1 - frame.x0),
    y: frame.yTop - p.y * (frame.yTop - frame.yBottom),
  }
}

/** 획 하나를 글꼴 좌표의 꺾은선으로 */
function polyline(stroke: PlacedStroke, frame: BodyFrame): Point[] {
  if (stroke.kind === 'ellipse') {
    const c = toFontUnits(frame, { x: stroke.cx, y: stroke.cy })
    const rx = stroke.rx * (frame.x1 - frame.x0)
    const ry = stroke.ry * (frame.yTop - frame.yBottom)
    return flattenEllipse(c.x, c.y, Math.abs(rx), Math.abs(ry), FLATTEN_STEP)
  }
  const points = stroke.points.map((p) => toFontUnits(frame, p))
  if (!stroke.smooth || points.length < 3) return points
  const cubics = catmullRomToCubics(points, stroke.closed)
  const out: Point[] = []
  cubics.forEach((cubic, i) => out.push(...flattenCubic(cubic, FLATTEN_STEP, i === 0)))
  if (stroke.closed) out.pop()
  return out
}

const JOIN: Record<StrokeStyle['join'], JoinType> = {
  round: JoinType.Round,
  miter: JoinType.Miter,
  bevel: JoinType.Bevel,
}

const END: Record<StrokeStyle['cap'], EndType> = {
  round: EndType.Round,
  square: EndType.Square,
  butt: EndType.Butt,
}

/**
 * 뼈대에 두께를 입혀 다각형으로 만들고 모두 합칩니다.
 * 가로·세로 굵기 차이(대비)는 x축을 줄인 공간에서 같은 두께로 부풀린 뒤 되돌려 만듭니다
 * (타원 펜으로 쓴 효과). 결과 좌표는 그 줄인 공간의 정수 좌표입니다.
 */
export function expandStrokes(
  strokes: readonly PlacedStroke[],
  style: StrokeStyle,
  frame: BodyFrame,
): Paths64 {
  const { vertical, horizontal } = strokeWidths(style)
  if (strokes.length === 0 || vertical <= 0) return []
  const kx = horizontal / vertical
  const offset = new ClipperOffset(2, ARC_TOLERANCE * SCALE)
  for (const stroke of strokes) {
    const path: Path64 = []
    for (const p of polyline(stroke, frame)) {
      const q = { x: Math.round(p.x * kx * SCALE), y: Math.round(p.y * SCALE) }
      const last = path[path.length - 1]
      if (!last || last.x !== q.x || last.y !== q.y) path.push(q)
    }
    if (path.length === 0) continue
    if (stroke.kind === 'ellipse') {
      offset.addPath(path, JoinType.Round, EndType.Joined)
    } else if (stroke.closed && path.length >= 3) {
      offset.addPath(path, stroke.smooth ? JoinType.Round : JOIN[style.join], EndType.Joined)
    } else {
      offset.addPath(path, stroke.smooth ? JoinType.Round : JOIN[style.join], END[style.cap])
    }
  }
  const solution: Paths64 = []
  offset.execute((horizontal / 2) * SCALE, solution)
  return solution
}

export function unionPaths(groups: readonly Paths64[]): Paths64 {
  const all = groups.flat()
  return all.length === 0 ? [] : union(all, FillRule.NonZero)
}

/** 줄인 공간의 정수 좌표 → 글꼴 좌표 */
export function pathsBounds(paths: Paths64, style: StrokeStyle): Rect | null {
  const { vertical, horizontal } = strokeWidths(style)
  const kx = horizontal / vertical
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const path of paths) {
    for (const p of path) {
      if (p.x < x0) x0 = p.x
      if (p.y < y0) y0 = p.y
      if (p.x > x1) x1 = p.x
      if (p.y > y1) y1 = p.y
    }
  }
  if (x0 === Infinity) return null
  return { x0: x0 / (kx * SCALE), y0: y0 / SCALE, x1: x1 / (kx * SCALE), y1: y1 / SCALE }
}

/**
 * 다각형을 곡선 윤곽선으로 맞추고, 기울기를 적용한 뒤 정수 좌표로 맞춥니다.
 * 바깥 윤곽은 반시계(PostScript 규칙), 구멍은 시계 방향입니다.
 */
export function pathsToContours(paths: Paths64, style: StrokeStyle): Contour[] {
  const { vertical, horizontal } = strokeWidths(style)
  const kx = horizontal / vertical
  const fit = {
    ...DEFAULT_FIT,
    tolerance: 0.45,
    lineLength: Math.min(40, Math.max(8, vertical * 0.3)),
  }
  const contours: Contour[] = []
  for (const path of paths) {
    const points = path.map((p) => ({ x: p.x / (kx * SCALE), y: p.y / SCALE }))
    const contour = fitClosedPolygon(points, fit)
    if (contour) contours.push(contour)
  }
  const slant = Math.tan((style.slant * Math.PI) / 180)
  const sheared =
    slant === 0
      ? contours
      : transformContours(contours, (p) => ({ x: p.x + (p.y - CENTER_Y) * slant, y: p.y }))
  return roundContours(sheared)
}
