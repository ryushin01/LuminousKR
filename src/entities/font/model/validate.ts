import { DEFAULT_LAYOUTS, LAYOUT_IDS } from './layout.ts'
import { createPresetProject } from './preset.ts'
import type {
  Box,
  Drawing,
  FontProject,
  JamoEntry,
  JamoKey,
  LayoutId,
  LayoutSet,
  Stroke,
} from './types.ts'

/** 프로젝트 파일을 읽을 수 없을 때 */
export class ProjectFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProjectFormatError'
  }
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

const JAMO_KEY = /^(L(1[0-8]|[0-9])|V(20|1[0-9]|[0-9])|T(2[0-7]|1[0-9]|[1-9]))$/

function readStroke(raw: unknown, fallbackId: string): Stroke | null {
  if (!isObject(raw)) return null
  const id = typeof raw.id === 'string' && raw.id.length > 0 ? raw.id.slice(0, 40) : fallbackId
  if (raw.kind === 'ellipse') {
    const { cx, cy, rx, ry } = raw
    if (![cx, cy, rx, ry].every(isNumber)) return null
    return {
      id,
      kind: 'ellipse',
      cx: cx as number,
      cy: cy as number,
      rx: Math.abs(rx as number),
      ry: Math.abs(ry as number),
    }
  }
  if (raw.kind === 'path' && Array.isArray(raw.points)) {
    const points = raw.points
      .filter((p): p is { x: number; y: number } => isObject(p) && isNumber(p.x) && isNumber(p.y))
      .slice(0, 200)
      .map((p) => ({ x: clamp(p.x, -0.5, 1.5), y: clamp(p.y, -0.5, 1.5) }))
    if (points.length === 0) return null
    return { id, kind: 'path', points, closed: raw.closed === true, smooth: raw.smooth === true }
  }
  return null
}

function readDrawing(raw: unknown, key: string): Drawing | undefined {
  if (!isObject(raw) || !Array.isArray(raw.strokes)) return undefined
  const strokes = raw.strokes
    .slice(0, 60)
    .map((s, i) => readStroke(s, `${key}-${i + 1}`))
    .filter((s): s is Stroke => s !== null)
  return { strokes }
}

function readBox(raw: unknown, fallback: Box): Box {
  if (!isObject(raw)) return fallback
  const { x0, y0, x1, y1 } = raw
  if (![x0, y0, x1, y1].every(isNumber)) return fallback
  const box = { x0: x0 as number, y0: y0 as number, x1: x1 as number, y1: y1 as number }
  return box.x1 > box.x0 && box.y1 > box.y0 ? box : fallback
}

function readLayouts(raw: unknown): LayoutSet {
  const layouts = structuredClone(DEFAULT_LAYOUTS)
  if (!isObject(raw)) return layouts
  for (const id of LAYOUT_IDS) {
    const source = raw[id]
    if (!isObject(source)) continue
    const target = layouts[id]
    for (const part of ['L', 'V', 'Vh', 'Vv', 'T'] as const) {
      const fallback = target[part]
      if (fallback) target[part] = readBox(source[part], fallback)
    }
  }
  return layouts
}

/** 외부에서 읽은 값을 검사하고, 빠진 값은 기본값으로 채운 프로젝트로 돌려줍니다. */
export function normalizeProject(raw: unknown): FontProject {
  if (!isObject(raw) || raw.format !== 'luminous-kr') {
    throw new ProjectFormatError(
      'LuminousKR 프로젝트 파일이 아닙니다. 내보내기에서 받은 .json 파일을 골라 주세요.',
    )
  }
  if (raw.version !== 1) {
    throw new ProjectFormatError(
      `지원하지 않는 프로젝트 판(${String(raw.version)})입니다. 최신 LuminousKR에서 다시 내보내 주세요.`,
    )
  }
  const preset = createPresetProject()
  const jamo: Partial<Record<JamoKey, JamoEntry>> = {}
  if (isObject(raw.jamo)) {
    for (const [key, value] of Object.entries(raw.jamo)) {
      if (!JAMO_KEY.test(key) || !isObject(value)) continue
      const entry: JamoEntry = {}
      const base = readDrawing(value.base, key)
      if (base) entry.base = base
      if (isObject(value.variants)) {
        const variants: Partial<Record<LayoutId, Drawing>> = {}
        for (const id of LAYOUT_IDS) {
          const drawing = readDrawing(value.variants[id], `${key}${id}`)
          if (drawing) variants[id] = drawing
        }
        if (Object.keys(variants).length > 0) entry.variants = variants
      }
      jamo[key as JamoKey] = entry
    }
  }
  const style = isObject(raw.style) ? raw.style : {}
  const metrics = isObject(raw.metrics) ? raw.metrics : {}
  const meta = isObject(raw.meta) ? raw.meta : {}
  const text = (v: unknown, fallback: string, max = 120) =>
    typeof v === 'string' ? v.slice(0, max) : fallback
  return {
    format: 'luminous-kr',
    version: 1,
    name: text(raw.name, '가져온 글꼴', 60),
    jamo,
    style: {
      weight: isNumber(style.weight) ? clamp(style.weight, 20, 200) : preset.style.weight,
      contrast: isNumber(style.contrast) ? clamp(style.contrast, 0.3, 1) : preset.style.contrast,
      cap: style.cap === 'square' || style.cap === 'butt' ? style.cap : 'round',
      join: style.join === 'miter' || style.join === 'bevel' ? style.join : 'round',
      slant: isNumber(style.slant) ? clamp(style.slant, 0, 20) : 0,
    },
    layouts: readLayouts(raw.layouts),
    metrics: {
      advance: isNumber(metrics.advance)
        ? clamp(metrics.advance, 700, 1200)
        : preset.metrics.advance,
      height: isNumber(metrics.height) ? clamp(metrics.height, 600, 1000) : preset.metrics.height,
      sideBearing: isNumber(metrics.sideBearing)
        ? clamp(metrics.sideBearing, 0, 150)
        : preset.metrics.sideBearing,
    },
    meta: {
      familyName: text(meta.familyName, preset.meta.familyName, 48),
      familyNameKo: text(meta.familyNameKo, preset.meta.familyNameKo, 48),
      styleName: text(meta.styleName, preset.meta.styleName, 32),
      designer: text(meta.designer, '', 80),
      version: text(meta.version, preset.meta.version, 12),
      license: text(meta.license, '', 200),
      description: text(meta.description, preset.meta.description, 300),
    },
  }
}

export function parseProjectJson(text: string): FontProject {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new ProjectFormatError(
      '파일을 JSON으로 읽을 수 없습니다. 파일이 손상되지 않았는지 확인해 주세요.',
    )
  }
  return normalizeProject(raw)
}
