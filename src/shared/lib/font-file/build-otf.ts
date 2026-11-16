import { Font, Glyph, Path } from 'opentype.js/dist/opentype.mjs'
import { contoursBounds, type Contour } from '../geometry/index.ts'
import { tidySfnt } from './sfnt.ts'

export type GlyphSpec = {
  name: string
  unicode?: number
  /** 같은 글리프를 쓰는 글자가 여럿일 때 (빈칸 U+0020과 줄바꿈 없는 빈칸 U+00A0 등) */
  unicodes?: number[]
  advance: number
  contours: readonly Contour[]
}

export type FontNames = {
  /** 영문 글꼴 이름 (ASCII). 운영체제 글꼴 목록의 기본 이름입니다. */
  familyName: string
  /** 한국어 글꼴 이름. Windows 이름 레코드(언어 0x0412)에 함께 넣습니다. */
  familyNameKo?: string
  styleName: string
  /** 공백 없는 ASCII 이름 (예: LuminousModular-Regular) */
  postScriptName: string
  version: string
  designer?: string
  description?: string
  license?: string
  licenseURL?: string
  copyright?: string
}

export type FontMetrics = {
  unitsPerEm: number
  ascender: number
  descender: number
  /** 100~900 */
  weightClass: number
  /** 기울기(도). 오른쪽으로 기울면 음수입니다(post.italicAngle 규칙). */
  italicAngle: number
}

/** 윤곽선을 opentype.js Path로 옮깁니다. 마지막 직선이 시작점으로 돌아오면 생략합니다. */
export function contoursToPath(contours: readonly Contour[]): Path {
  const path = new Path()
  for (const contour of contours) {
    const { start, segments } = contour
    if (segments.length === 0) continue
    path.commands.push({ type: 'M', x: start.x, y: start.y })
    segments.forEach((seg, i) => {
      const isLast = i === segments.length - 1
      if (seg.type === 'L') {
        if (
          isLast &&
          Math.round(seg.x) === Math.round(start.x) &&
          Math.round(seg.y) === Math.round(start.y)
        )
          return
        path.commands.push({ type: 'L', x: seg.x, y: seg.y })
      } else {
        path.commands.push({
          type: 'C',
          x1: seg.x1,
          y1: seg.y1,
          x2: seg.x2,
          y2: seg.y2,
          x: seg.x,
          y: seg.y,
        })
      }
    })
    path.commands.push({ type: 'Z' })
  }
  return path
}

/** OS/2 ulCodePageRange1의 949 한국어(완성형) 비트 */
const CODEPAGE_KOREAN_WANSUNG = 1 << 19
/** OS/2 fsSelection 7번 비트: 줄 높이를 typo 값(sTypoAscender 등)으로 (OS/2 4판부터) */
const USE_TYPO_METRICS = 1 << 7

/** 모든 글리프 윤곽(조절점 포함)의 세로 범위 */
function verticalExtent(glyphs: readonly GlyphSpec[]): { yMin: number; yMax: number } {
  let yMin = 0
  let yMax = 0
  for (const glyph of glyphs) {
    const bounds = contoursBounds(glyph.contours)
    if (!bounds) continue
    yMin = Math.min(yMin, bounds.y0)
    yMax = Math.max(yMax, bounds.y1)
  }
  return { yMin, yMax }
}

/**
 * 글리프 목록으로 OpenType(CFF) 글꼴 파일을 만듭니다.
 * 첫 글리프는 .notdef여야 합니다.
 */
export function buildOtf(
  glyphs: readonly GlyphSpec[],
  names: FontNames,
  metrics: FontMetrics,
): ArrayBuffer {
  if (glyphs[0]?.name !== '.notdef') throw new Error('첫 글리프는 .notdef여야 합니다.')

  const font = new Font({
    familyName: names.familyName,
    styleName: names.styleName,
    postScriptName: names.postScriptName,
    unitsPerEm: metrics.unitsPerEm,
    ascender: metrics.ascender,
    descender: metrics.descender,
    designer: names.designer,
    description: names.description,
    license: names.license,
    licenseURL: names.licenseURL,
    copyright: names.copyright,
    manufacturer: 'LuminousKR',
    manufacturerURL: 'https://github.com/ryushin01/LuminousKR',
    version: `Version ${names.version}`,
    weightClass: metrics.weightClass,
    italicAngle: metrics.italicAngle,
    glyphs: glyphs.map(
      (spec) =>
        new Glyph({
          name: spec.name,
          unicode: spec.unicode ?? spec.unicodes?.[0],
          unicodes: spec.unicodes,
          advanceWidth: spec.advance,
          path: contoursToPath(spec.contours),
        }),
    ),
  })

  if (names.familyNameKo) {
    const windows = font.names.windows
    windows.fontFamily = { ...windows.fontFamily, ko: names.familyNameKo }
    windows.fullName = { ...windows.fullName, ko: `${names.familyNameKo} ${names.styleName}` }
  }

  const half = Math.round(metrics.unitsPerEm / 2)
  const extent = verticalExtent(glyphs)
  Object.assign(font.tables.os2!, {
    // 4판: USE_TYPO_METRICS를 켜 Windows·macOS·웹이 모두 typo 값(글자 몸 1em)으로 줄 높이를 정하게 함
    version: 4,
    fsSelection: ((font.tables.os2!.fsSelection as number) | USE_TYPO_METRICS) >>> 0,
    // Windows의 잘림 기준은 글자 몸과 실제 글리프 범위 가운데 큰 쪽(기울인 글리프가 잘리지 않게)
    usWinAscent: Math.max(metrics.ascender, Math.ceil(extent.yMax)),
    usWinDescent: Math.max(-metrics.descender, Math.ceil(-extent.yMin)),
    achVendID: 'LMKR',
    fsType: 0, // 설치 가능한 글꼴 (사용 제한 없음)
    ulCodePageRange1: CODEPAGE_KOREAN_WANSUNG,
    sxHeight: half,
    sCapHeight: Math.round(metrics.ascender * 0.8),
    usDefaultChar: 0,
    usBreakChar: 32,
    yStrikeoutSize: Math.round(metrics.unitsPerEm * 0.05),
    yStrikeoutPosition: Math.round((metrics.ascender + metrics.descender) / 2),
  })
  font.tables.post = {
    ...(font.tables.post ?? {}),
    underlinePosition: Math.round(metrics.descender * 0.6),
    underlineThickness: Math.round(metrics.unitsPerEm * 0.05),
  }

  // 이름 표를 Windows(유니코드) 레코드만 빈 값 없이 다시 쓰고, Apple 전용 ltag 표를 뺍니다.
  return tidySfnt(font.toArrayBuffer())
}
