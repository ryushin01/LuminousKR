import {
  brotliCompress,
  buildOtf,
  sfntToWoff,
  sfntToWoff2,
  type FontNames,
  type GlyphSpec,
} from '@/shared/lib/font-file'
import type { Contour } from '@/shared/lib/geometry'
import {
  COMPAT_JAMO_FIRST,
  COMPAT_JAMO_LAST,
  SYLLABLE_BASE,
  SYLLABLE_LAST,
} from '@/shared/lib/hangul'
import type { FontProject } from '../model/types.ts'
import { type ComponentCache, Composer, isComposable } from './composer.ts'
import { ASCENDER, DESCENDER, UNITS_PER_EM } from './outline.ts'

export type BuildPhase = 'compose' | 'encode' | 'compress'
export type BuildProgress = { phase: BuildPhase; done: number; total: number }

export type BuildRequest = {
  /** 이 글자만 넣은 작은 글꼴(미리보기용). 없으면 전체(음절 11,172자 + 호환 자모 51자) */
  chars?: string
  woff: boolean
  /** WOFF2(brotli)도 만들지 */
  woff2?: boolean
  /** 굵기 여러 벌을 한 가족으로 만들 때 이 벌의 굵기 등급(100~900). 이름·스타일 연결을 가족 규칙으로 */
  member?: { weightClass: number }
}

export type BuildResult = {
  otf: ArrayBuffer
  woff?: ArrayBuffer
  woff2?: ArrayBuffer
  glyphCount: number
  syllableCount: number
  durationMs: number
}

export function glyphName(code: number): string {
  return `uni${code.toString(16).toUpperCase().padStart(4, '0')}`
}

/** 획 굵기(세로획, 1em = 1000) ↔ 굵기 등급(OS/2 usWeightClass) 기준점 */
const WEIGHT_STOPS: readonly [weight: number, weightClass: number][] = [
  [30, 100], [45, 200], [60, 300], [76, 400], [92, 500], [110, 600], [130, 700], [155, 800], [185, 900],
] // prettier-ignore

/** 굵기 등급의 영문 이름 (OpenType 관례) */
export const WEIGHT_NAMES: Readonly<Record<number, string>> = {
  100: 'Thin',
  200: 'ExtraLight',
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'SemiBold',
  700: 'Bold',
  800: 'ExtraBold',
  900: 'Black',
}

export const WEIGHT_CLASSES: readonly number[] = WEIGHT_STOPS.map(([, weightClass]) => weightClass)

/** 굵기 등급에 맞는 획 굵기 (가족의 다른 벌을 만들 때) */
export function strokeWeightFor(weightClass: number): number {
  return WEIGHT_STOPS.find(([, c]) => c === weightClass)?.[0] ?? 76
}

/** 획 굵기를 OS/2 usWeightClass(100~900)로 */
export function weightClassOf(weight: number): number {
  const stops = WEIGHT_STOPS
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

/**
 * 굵기 여러 벌을 한 가족으로 묶을 때 그 벌의 이름.
 * Regular·Bold는 같은 가족 이름(이름 ID 1)에 스타일 이름만 다르고(스타일 연결), 그 밖의 굵기는
 * '가족 이름 굵기'를 이름 ID 1로, 원래 가족 이름과 굵기를 typographic family·subfamily(ID 16·17)로 둡니다.
 * 기울기가 있으면(이탤릭 비트·각도를 쓰는 벌) 이름에도 Italic을 넣어 똑바른 벌과 구별합니다
 * (Italic·Bold Italic·Light Italic, PostScript 이름 -Italic·-BoldItalic·-LightItalic).
 */
export function familyMemberNames(project: FontProject, weightClass: number): FontNames {
  const base = fontNamesOf(project)
  const weightName = WEIGHT_NAMES[weightClass] ?? 'Regular'
  const linked = weightClass === 400 || weightClass === 700
  const italic = project.style.slant !== 0
  /** 가족 안에서 이 벌을 부르는 이름 (typographic subfamily) */
  const subfamily = italic ? (weightClass === 400 ? 'Italic' : `${weightName} Italic`) : weightName
  /** 이름 ID 1 가족 안의 스타일 이름 (스타일 연결: Regular·Italic·Bold·Bold Italic) */
  const styleName = linked ? subfamily : italic ? 'Italic' : 'Regular'
  const ko = base.familyNameKo
  return {
    ...base,
    familyName: linked ? base.familyName : `${base.familyName} ${weightName}`,
    familyNameKo: ko && !linked ? `${ko} ${weightName}` : ko,
    styleName,
    fullName: `${base.familyName} ${subfamily}`,
    fullNameKo: ko ? `${ko} ${subfamily}` : undefined,
    postScriptName: postScriptName(base.familyName, subfamily),
    typographicFamily: base.familyName,
    typographicFamilyKo: ko,
    typographicSubfamily: subfamily,
  }
}

/**
 * 프로젝트로 글꼴 파일을 만듭니다. (Web Worker 안에서 부르는 것을 전제로 합니다)
 * @param cache 미리보기용 작은 글꼴을 편집하면서 거듭 만들 때 이어 쓸 윤곽 캐시
 */
export async function buildFont(
  project: FontProject,
  request: BuildRequest,
  onProgress?: (progress: BuildProgress) => void,
  cache?: ComponentCache,
  /** WOFF2용 brotli 압축기 (시험에서 바꿔 끼움) */
  brotli: (data: Uint8Array) => Promise<Uint8Array> = brotliCompress,
): Promise<BuildResult> {
  const started = performance.now()
  const composer = new Composer(project, cache)
  const { advance } = project.metrics
  const codes = glyphCodes(request.chars)
  const total = codes.length
  const glyphs: GlyphSpec[] = [
    notdef(advance),
    // 빈칸과 줄바꿈 없는 빈칸(U+00A0, 웹의 &nbsp;)이 같은 글리프를 씀
    { name: 'space', unicodes: [32, 0xa0], advance: Math.round(advance * 0.28), contours: [] },
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

  const member = request.member
  const names = member ? familyMemberNames(project, member.weightClass) : fontNamesOf(project)
  const otf = buildOtf(glyphs, names, {
    unitsPerEm: UNITS_PER_EM,
    ascender: ASCENDER,
    descender: DESCENDER,
    weightClass: member?.weightClass ?? weightClassOf(project.style.weight),
    italicAngle: -project.style.slant,
  })

  let woff: ArrayBuffer | undefined
  let woff2: ArrayBuffer | undefined
  if (request.woff || request.woff2) onProgress?.({ phase: 'compress', done: total, total })
  if (request.woff) woff = await sfntToWoff(otf)
  if (request.woff2) woff2 = await sfntToWoff2(otf, brotli)
  return {
    otf,
    woff,
    woff2,
    glyphCount: glyphs.length,
    syllableCount,
    durationMs: Math.round(performance.now() - started),
  }
}
