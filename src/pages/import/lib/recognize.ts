/**
 * 손글씨 인식: 사진·스캔에서 표식을 찾아 원근을 바로잡고, 칸마다 잉크를 뼈대 획으로 바꿉니다.
 * DOM을 쓰지 않는 순수 함수라 워커와 테스트에서 함께 씁니다.
 */
import type { Point } from '@/shared/lib/geometry'
import {
  type BinaryImage,
  type GrayImage,
  type Homography,
  adaptiveBinarize,
  applyHomography,
  asEllipse,
  countInk,
  createGray,
  findComponents,
  percentile,
  relativeBinarize,
  removeSmallComponents,
  sampleGray,
  simplifyPolyline,
  solveHomography,
  thin,
  traceSkeleton,
} from '@/shared/lib/image'
import { type CellRect, type TemplateGeometry, setFromBits } from './template-geometry.ts'

/** 인식한 획 (음절 좌표 0~1, y 아래로) */
export type RecognizedStroke =
  | { kind: 'path'; points: Point[]; closed: boolean; smooth: boolean }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }

export type RecognizeOptions = {
  /** 격자에 맞출 칸 수 (null이면 맞추지 않음) */
  divisions: number | null
  /** 점이 셋 이상인 획을 매끄러운 곡선으로 */
  smooth: boolean
}

export type CellResult = {
  key: string
  strokes: RecognizedStroke[]
  /** 칸에서 잉크가 차지하는 비율 */
  ink: number
  /** 펜 굵기 (음절 너비에 대한 비율) */
  penWidth: number
  /** 화면에 보여 줄 칸 그림 (회색조) */
  raster: GrayImage
}

export type PageResult =
  | { ok: true; setId: number; cells: CellResult[]; empty: string[] }
  | { ok: false; reason: 'markers' | 'set'; message: string }

const CELL_PIXELS = 160

/* ── 획 추출 ── */

function strokeLength(points: readonly Point[]): number {
  let sum = 0
  for (let i = 1; i < points.length; i++)
    sum += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y)
  return sum
}

function snap(points: Point[], divisions: number | null): Point[] {
  if (!divisions) return points
  const out: Point[] = []
  for (const p of points) {
    const q = {
      x: Math.round(p.x * divisions) / divisions,
      y: Math.round(p.y * divisions) / divisions,
    }
    const last = out[out.length - 1]
    if (!last || last.x !== q.x || last.y !== q.y) out.push(q)
  }
  return out
}

/** 잉크 그림(정사각, 한 변 size 픽셀) → 정규화 좌표의 획 */
export function strokesFromRaster(
  ink: BinaryImage,
  options: RecognizeOptions,
): { strokes: RecognizedStroke[]; penWidth: number } {
  const size = ink.width
  const skeleton = thin(ink)
  const skeletonCount = countInk(skeleton)
  if (skeletonCount === 0) return { strokes: [], penWidth: 0 }
  const penWidth = countInk(ink) / skeletonCount / size
  const traced = traceSkeleton(skeleton, {
    spurLength: Math.max(6, size * 0.05 + penWidth * size * 0.6),
    directionReach: Math.max(5, size * 0.05),
    straightness: -0.72,
  })
  const strokes: RecognizedStroke[] = []
  for (const stroke of traced) {
    if (stroke.points.length < 2 || strokeLength(stroke.points) < size * 0.035) continue
    const scaled = stroke.points.map((p) => ({ x: (p.x + 0.5) / size, y: (p.y + 0.5) / size }))
    if (stroke.closed) {
      const ellipse = asEllipse(scaled)
      if (ellipse) {
        strokes.push({ kind: 'ellipse', ...ellipse })
        continue
      }
    }
    const simplified = simplifyPolyline(scaled, 0.014, stroke.closed)
    const points = snap(simplified, options.divisions)
    if (points.length === 0) continue
    strokes.push({
      kind: 'path',
      points,
      closed: stroke.closed && points.length >= 3,
      smooth: options.smooth && points.length >= 3,
    })
  }
  return { strokes, penWidth }
}

/* ── 양식 찾기 ── */

/** 네 모서리의 검은 네모를 찾습니다 (왼쪽 위부터 시계 방향). */
export function findMarkers(gray: GrayImage): Point[] | null {
  const { width, height } = gray
  const minDim = Math.min(width, height)
  const binary = adaptiveBinarize(gray, { window: Math.max(width, height) / 7, ratio: 0.25 })
  const { components } = findComponents(binary)
  const candidates = components.filter((c) => {
    const w = c.x1 - c.x0 + 1
    const h = c.y1 - c.y0 + 1
    const fill = c.area / (w * h)
    const aspect = w / h
    return (
      c.area >= (minDim * 0.012) ** 2 &&
      w < minDim * 0.16 &&
      h < minDim * 0.16 &&
      fill > 0.6 &&
      aspect > 0.6 &&
      aspect < 1.66
    )
  })
  const corners = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ]
  const picked = corners.map((corner) => {
    let best: (typeof candidates)[number] | null = null
    let bestDistance = Math.hypot(width, height) * 0.4
    for (const c of candidates) {
      const d = Math.hypot(c.cx - corner.x, c.cy - corner.y)
      if (d < bestDistance) {
        best = c
        bestDistance = d
      }
    }
    return best
  })
  if (picked.some((c) => !c) || new Set(picked).size !== 4) return null
  const areas = picked.map((c) => c!.area)
  if (Math.max(...areas) / Math.min(...areas) > 4) return null
  return picked.map((c) => ({ x: c!.cx, y: c!.cy }))
}

function isDark(gray: GrayImage, h: Homography, center: Point, paper: number): boolean {
  let sum = 0
  const offsets = [-1.6, 0, 1.6]
  for (const dx of offsets) {
    for (const dy of offsets) {
      const p = applyHomography(h, { x: center.x + dx, y: center.y + dy })
      sum += sampleGray(gray, p.x, p.y)
    }
  }
  return sum / 9 < paper * 0.55
}

/** 칸 하나를 바로잡은 정사각 그림으로 떠냅니다. */
export function sampleCell(
  gray: GrayImage,
  h: Homography,
  cell: CellRect,
  pixels = CELL_PIXELS,
): GrayImage {
  const out = createGray(pixels, pixels)
  for (let j = 0; j < pixels; j++) {
    for (let i = 0; i < pixels; i++) {
      const p = applyHomography(h, {
        x: cell.x + ((i + 0.5) / pixels) * cell.size,
        y: cell.y + ((j + 0.5) / pixels) * cell.size,
      })
      out.data[j * pixels + i] = Math.round(sampleGray(gray, p.x, p.y))
    }
  }
  return out
}

/** 칸 테두리 선이 잉크로 잡히지 않게 가장자리를 비웁니다. */
function clearBorder(image: BinaryImage, margin: number): BinaryImage {
  const { width, height } = image
  const data = image.data.slice()
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x < margin || y < margin || x >= width - margin || y >= height - margin)
        data[y * width + x] = 0
    }
  }
  return { width, height, data }
}

export function inkOfCell(cellGray: GrayImage): BinaryImage {
  const size = cellGray.width
  const binary = clearBorder(relativeBinarize(cellGray, 0.58), Math.round(size * 0.03))
  return removeSmallComponents(binary, Math.round(size * size * 0.0006))
}

/**
 * 양식 한 쪽을 인식합니다. 사진이 뒤집혀 있어도 표식 순서를 돌려 가며 양식 번호를 맞춰 봅니다.
 */
export function recognizePage(
  gray: GrayImage,
  geometry: TemplateGeometry,
  options: RecognizeOptions,
): PageResult {
  const found = findMarkers(gray)
  if (!found) {
    return {
      ok: false,
      reason: 'markers',
      message:
        '네 모서리의 검은 네모를 모두 찾지 못했습니다. 종이 전체가 보이게, 그림자 없이 다시 찍어 주세요.',
    }
  }
  const paper = percentile(gray, 0.9)
  for (let turn = 0; turn < 4; turn++) {
    const image = [0, 1, 2, 3].map((i) => found[(i + turn) % 4]!)
    const h = solveHomography(geometry.markers, image)
    if (!h) continue
    const setId = setFromBits(geometry.bits.map((c) => isDark(gray, h, c, paper)))
    const set = geometry.sets.find((s) => s.id === setId)
    if (!set) continue
    const cells: CellResult[] = []
    const empty: string[] = []
    for (const cell of set.cells) {
      const raster = sampleCell(gray, h, cell)
      const ink = inkOfCell(raster)
      const ratio = countInk(ink) / (ink.width * ink.height)
      if (ratio < 0.004) {
        empty.push(cell.key)
        continue
      }
      const { strokes, penWidth } = strokesFromRaster(ink, options)
      if (strokes.length === 0) {
        empty.push(cell.key)
        continue
      }
      cells.push({ key: cell.key, strokes, ink: ratio, penWidth, raster })
    }
    return { ok: true, setId: set.id, cells, empty }
  }
  return {
    ok: false,
    reason: 'set',
    message:
      '어떤 양식인지 읽지 못했습니다. 위쪽 가운데의 작은 네모 넷이 가려지지 않았는지 확인해 주세요.',
  }
}

/**
 * 양식 없이 그림 한 장을 자모 하나로: 잉크가 있는 곳을 잘라 그 자모의 틀에 맞춥니다.
 * @param frame 자모 틀 (음절 좌표)
 */
export function recognizeSingle(
  gray: GrayImage,
  frame: { x0: number; y0: number; x1: number; y1: number },
  options: RecognizeOptions,
): { strokes: RecognizedStroke[]; penWidth: number; raster: GrayImage } | null {
  const { width, height } = gray
  const binary = removeSmallComponents(
    adaptiveBinarize(gray, { window: Math.max(width, height) / 6, ratio: 0.25 }),
    Math.max(4, Math.round(width * height * 0.0004)),
  )
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (binary.data[y * width + x] !== 1) continue
      if (x < x0) x0 = x
      if (y < y0) y0 = y
      if (x > x1) x1 = x
      if (y > y1) y1 = y
    }
  }
  if (x0 === Infinity) return null
  // 잉크 영역을 감싸는 정사각을 떠내고(가로세로 비율 유지), 그린 범위를 틀에 맞춥니다.
  const side = Math.max(x1 - x0, y1 - y0) * 1.12 + 4
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const raster = createGray(CELL_PIXELS, CELL_PIXELS)
  for (let j = 0; j < CELL_PIXELS; j++) {
    for (let i = 0; i < CELL_PIXELS; i++) {
      const x = cx - side / 2 + ((i + 0.5) / CELL_PIXELS) * side
      const y = cy - side / 2 + ((j + 0.5) / CELL_PIXELS) * side
      raster.data[j * CELL_PIXELS + i] = Math.round(sampleGray(gray, x, y))
    }
  }
  const ink = removeSmallComponents(
    relativeBinarize(raster, 0.62),
    Math.round(CELL_PIXELS * CELL_PIXELS * 0.0006),
  )
  const { strokes, penWidth } = strokesFromRaster(ink, { ...options, divisions: null })
  if (strokes.length === 0) return null
  // 그린 범위(정규화)를 자모 틀로 늘여 놓습니다.
  const bx0 = 0.5 - (x1 - x0) / side / 2
  const by0 = 0.5 - (y1 - y0) / side / 2
  const bw = Math.max(1e-3, (x1 - x0) / side)
  const bh = Math.max(1e-3, (y1 - y0) / side)
  const fw = frame.x1 - frame.x0
  const fh = frame.y1 - frame.y0
  const map = (p: Point): Point => ({
    x: frame.x0 + ((p.x - bx0) / bw) * fw,
    y: frame.y0 + ((p.y - by0) / bh) * fh,
  })
  const placed = strokes.map((stroke): RecognizedStroke => {
    if (stroke.kind === 'ellipse') {
      const c = map({ x: stroke.cx, y: stroke.cy })
      return {
        kind: 'ellipse',
        cx: c.x,
        cy: c.y,
        rx: (stroke.rx / bw) * fw,
        ry: (stroke.ry / bh) * fh,
      }
    }
    return { ...stroke, points: snap(stroke.points.map(map), options.divisions) }
  })
  return { strokes: placed, penWidth: (penWidth / bw) * fw, raster }
}
