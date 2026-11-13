import { buildOtf, sfntToWoff, type FontNames, type GlyphSpec } from '@/shared/lib/font-file'
import type { Contour } from '@/shared/lib/geometry'
import {
  COMPAT_JAMO_FIRST,
  COMPAT_JAMO_LAST,
  SYLLABLE_BASE,
  SYLLABLE_LAST,
} from '@/shared/lib/hangul'
import type { FontProject } from '../model/types.ts'
import { Composer, isComposable } from './composer.ts'
import { ASCENDER, DESCENDER, UNITS_PER_EM } from './outline.ts'

export type BuildPhase = 'compose' | 'encode' | 'compress'
export type BuildProgress = { phase: BuildPhase; done: number; total: number }

export type BuildRequest = {
  /** 이 글자만 넣은 작은 글꼴(미리보기용). 없으면 전체(음절 11,172자 + 호환 자모 51자) */
  chars?: string
  woff: boolean
}

export type BuildResult = {
  otf: ArrayBuffer
  woff?: ArrayBuffer
  glyphCount: number
  syllableCount: number
  durationMs: number
}

export function glyphName(code: number): string {
  return `uni${code.toString(16).toUpperCase().padStart(4, '0')}`
}

/** 획 굵기를 OS/2 usWeightClass(100~900)로 */
export function weightClassOf(weight: number): number {
  const stops: [number, number][] = [
    [30, 100], [45, 200], [60, 300], [76, 400], [92, 500], [110, 600], [130, 700], [155, 800], [185, 900],
  ] // prettier-ignore
  if (weight <= stops[0]![0]) return 100
  for (let i = 1; i < stops.length; i++) {
    const [w1, c1] = stops[i]!
    if (weight <= w1) {
      const [w0, c0] = stops[i - 1]!
      const value = c0 + ((weight - w0) / (w1 - w0)) * (c1 - c0)
      return Math.round(value / 100) * 100
    }
  }
  return 900
}

/** 운영체제가 받아들이는 영문 이름만 남깁니다. */
export function sanitizeLatinName(name: string, fallback: string): string {
  const cleaned = name
    .replace(/[^A-Za-z0-9 -]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.length > 0 ? cleaned.slice(0, 48) : fallback
}

export function postScriptName(family: string, style: string): string {
  return `${family}-${style}`.replace(/[^A-Za-z0-9-]/g, '').slice(0, 63)
}

function notdef(advance: number): GlyphSpec {
  const x0 = 100
  const x1 = advance - 100
  const y0 = 0
  const y1 = 700
  const t = 50
  const rect = (a: number, b: number, c: number, d: number, clockwise: boolean): Contour => {
    const pts = clockwise
      ? [
          { x: a, y: d },
          { x: c, y: d },
          { x: c, y: b },
          { x: a, y: b },
        ]
      : [
          { x: a, y: b },
          { x: c, y: b },
          { x: c, y: d },
          { x: a, y: d },
        ]
    return {
      start: pts[0]!,
      segments: [...pts.slice(1), pts[0]!].map((p) => ({ type: 'L' as const, ...p })),
    }
  }
  return {
    name: '.notdef',
    advance,
    contours: [rect(x0, y0, x1, y1, false), rect(x0 + t, y0 + t, x1 - t, y1 - t, true)],
  }
}

/** 글꼴에 넣을 글자 번호 목록 */
export function glyphCodes(chars?: string): number[] {
  if (chars !== undefined) {
    const set = new Set<number>()
    for (const char of chars) {
      const code = char.codePointAt(0)
      if (code !== undefined && isComposable(code)) set.add(code)
    }
    return [...set].sort((a, b) => a - b)
  }
  const codes: number[] = []
  for (let c = COMPAT_JAMO_FIRST; c <= COMPAT_JAMO_LAST; c++) codes.push(c)
  for (let c = SYLLABLE_BASE; c <= SYLLABLE_LAST; c++) codes.push(c)
  return codes
}

export function fontNamesOf(project: FontProject): FontNames {
  const familyName = sanitizeLatinName(project.meta.familyName, 'Luminous Custom')
  const styleName = sanitizeLatinName(project.meta.styleName, 'Regular')
  return {
    familyName,
    familyNameKo: project.meta.familyNameKo.trim() || undefined,
    styleName,
    postScriptName: postScriptName(familyName, styleName),
    version: /^\d+\.\d{1,3}$/.test(project.meta.version) ? project.meta.version : '1.000',
    designer: project.meta.designer.trim() || undefined,
    description: project.meta.description.trim() || undefined,
    license: project.meta.license.trim() || undefined,
  }
}

/** 프로젝트로 글꼴 파일을 만듭니다. (Web Worker 안에서 부르는 것을 전제로 합니다) */
export async function buildFont(
  project: FontProject,
  request: BuildRequest,
  onProgress?: (progress: BuildProgress) => void,
): Promise<BuildResult> {
  const started = performance.now()
  const composer = new Composer(project)
  const { advance } = project.metrics
  const codes = glyphCodes(request.chars)
  const total = codes.length
  const glyphs: GlyphSpec[] = [
    notdef(advance),
    { name: 'space', unicode: 32, advance: Math.round(advance * 0.28), contours: [] },
  ]
  let syllableCount = 0
  codes.forEach((code, i) => {
    if (code >= SYLLABLE_BASE) syllableCount += 1
    glyphs.push({
      name: glyphName(code),
      unicode: code,
      advance,
      contours: composer.glyphContours(code),
    })
    if ((i + 1) % 256 === 0) onProgress?.({ phase: 'compose', done: i + 1, total })
  })
  onProgress?.({ phase: 'encode', done: total, total })

  const otf = buildOtf(glyphs, fontNamesOf(project), {
    unitsPerEm: UNITS_PER_EM,
    ascender: ASCENDER,
    descender: DESCENDER,
    weightClass: weightClassOf(project.style.weight),
    italicAngle: -project.style.slant,
  })

  let woff: ArrayBuffer | undefined
  if (request.woff) {
    onProgress?.({ phase: 'compress', done: total, total })
    woff = await sfntToWoff(otf)
  }
  return {
    otf,
    woff,
    glyphCount: glyphs.length,
    syllableCount,
    durationMs: Math.round(performance.now() - started),
  }
}
