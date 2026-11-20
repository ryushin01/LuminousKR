// @vitest-environment node
import { brotliCompressSync } from 'node:zlib'
import { parse } from 'opentype.js/dist/opentype.mjs'
import { describe, expect, it } from 'vitest'
import { type Contour, type Point, cubicPoint } from '@/shared/lib/geometry'
import { SYLLABLE_BASE, composeCode } from '@/shared/lib/hangul'
import { ALL_JAMO_KEYS, homeLayout } from '../model/layout.ts'
import { createPresetProject } from '../model/preset.ts'
import type { FontProject } from '../model/types.ts'
import {
  buildFont,
  glyphCodes,
  postScriptName,
  sanitizeLatinName,
  weightClassOf,
} from './build-font.ts'
import { ComponentCache, Composer, placedStrokesFor } from './composer.ts'
import { bodyFrame, expandStrokes, pathsBounds, pathsToContours, toFontUnits } from './outline.ts'
import type { PlacedStroke } from './resolve.ts'
import { insideContours } from './test-helpers.ts'

const line = (x0: number, y0: number, x1: number, y1: number): PlacedStroke => ({
  kind: 'path',
  points: [
    { x: x0, y: y0 },
    { x: x1, y: y1 },
  ],
  closed: false,
  smooth: false,
})

/** 곡선 위의 점을 촘촘히 찍어 실제 윤곽 경계를 잽니다 (조절점은 곡선 밖에 있을 수 있음). */
function trueBounds(contours: Contour[]) {
  const xs: number[] = []
  const ys: number[] = []
  for (const c of contours) {
    let from = c.start
    for (const s of c.segments) {
      if (s.type === 'L') {
        xs.push(s.x)
        ys.push(s.y)
      } else {
        for (let i = 1; i <= 16; i++) {
          const p = cubicPoint(
            [from, { x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }, { x: s.x, y: s.y }],
            i / 16,
          )
          xs.push(p.x)
          ys.push(p.y)
        }
      }
      from = { x: s.x, y: s.y }
    }
  }
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }
}

function projectWith(patch: Partial<FontProject['style']>): FontProject {
  const project = createPresetProject()
  project.style = { ...project.style, ...patch }
  return project
}

describe('뼈대에 굵기 입히기', () => {
  it('세로획 폭은 굵기 값과 같고, 가로획 높이는 굵기 × 대비입니다', () => {
    const project = projectWith({ weight: 80, contrast: 0.5, cap: 'butt' })
    const frame = bodyFrame(project.metrics, project.style)
    const vertical = pathsBounds(
      expandStrokes([line(0.5, 0.1, 0.5, 0.9)], project.style, frame),
      project.style,
    )!
    const horizontal = pathsBounds(
      expandStrokes([line(0.1, 0.5, 0.9, 0.5)], project.style, frame),
      project.style,
    )!
    expect(vertical.x1 - vertical.x0).toBeCloseTo(80, 0)
    expect(horizontal.y1 - horizontal.y0).toBeCloseTo(40, 0)
  })

  it('작은 틀에 줄여 넣어도 획 두께는 그대로입니다 (뼈대 방식)', () => {
    const project = projectWith({ weight: 70, contrast: 1, cap: 'butt' })
    const frame = bodyFrame(project.metrics, project.style)
    const big = pathsBounds(
      expandStrokes([line(0.5, 0, 0.5, 1)], project.style, frame),
      project.style,
    )!
    const small = pathsBounds(
      expandStrokes([line(0.2, 0.7, 0.2, 0.8)], project.style, frame),
      project.style,
    )!
    expect(big.x1 - big.x0).toBeCloseTo(small.x1 - small.x0, 0)
  })

  it('겹친 획은 하나의 윤곽으로 합칩니다', () => {
    const project = projectWith({ weight: 60 })
    const frame = bodyFrame(project.metrics, project.style)
    const plus = expandStrokes(
      [line(0.5, 0.1, 0.5, 0.9), line(0.1, 0.5, 0.9, 0.5)],
      project.style,
      frame,
    )
    expect(plus).toHaveLength(1)
  })

  it('굵기보다 조금만 떨어진 두 획 사이의 좁은 틈도 메우지 않습니다', () => {
    const project = projectWith({ weight: 60, contrast: 1, cap: 'butt' })
    const frame = bodyFrame(project.metrics, project.style)
    // 두 가로획의 가운데 선 사이를 굵기 + 4단위로 (바깥 사이 틈 4단위)
    const gap = (60 + 4) / (frame.yTop - frame.yBottom)
    const paths = expandStrokes(
      [line(0.1, 0.5, 0.9, 0.5), line(0.1, 0.5 + gap, 0.9, 0.5 + gap)],
      project.style,
      frame,
    )
    const contours = pathsToContours(paths, project.style)
    expect(contours).toHaveLength(2)
    const bounds = contours.map((c) => trueBounds([c])).sort((a, b) => a.y0 - b.y0)
    expect(bounds[1]!.y0 - bounds[0]!.y1).toBeGreaterThanOrEqual(3)
  })

  it('닫힌 획(ㅁ)은 바깥 윤곽과 구멍 둘이 됩니다', () => {
    const project = projectWith({ weight: 60 })
    const frame = bodyFrame(project.metrics, project.style)
    const box: PlacedStroke = {
      kind: 'path',
      points: [
        { x: 0.2, y: 0.2 },
        { x: 0.8, y: 0.2 },
        { x: 0.8, y: 0.8 },
        { x: 0.2, y: 0.8 },
      ],
      closed: true,
      smooth: false,
    }
    expect(pathsToContours(expandStrokes([box], project.style, frame), project.style)).toHaveLength(
      2,
    )
  })
})

describe('음절 조합', () => {
  it('여섯 배치의 음절이 모두 윤곽을 가집니다', () => {
    const composer = new Composer(createPresetProject())
    for (const char of '가고과각곡곽닭쀍힣') {
      expect(composer.glyphContours(char.codePointAt(0)!).length).toBeGreaterThan(0)
    }
  })

  it('윤곽은 글자 너비와 높이 안에 들어갑니다', () => {
    const project = createPresetProject()
    const composer = new Composer(project)
    for (const char of '갉뚫쀍힣왜') {
      const bounds = trueBounds(composer.glyphContours(char.codePointAt(0)!))
      expect(bounds.x0).toBeGreaterThanOrEqual(0)
      expect(bounds.x1).toBeLessThanOrEqual(project.metrics.advance)
      expect(bounds.y1 - bounds.y0).toBeLessThanOrEqual(project.metrics.height + 2)
    }
  })

  it('좁은 틀의 ㅅ(쌍시옷 ㅆ)도 두 다리 사이가 메워지지 않습니다', () => {
    // 다리 사이 각이 30°보다 좁아도 곡선 맞춤이 틈 끝을 '바늘'로 보고 지우면 안 됩니다(1.5.0까지의 결함).
    for (const weight of [30, 76]) {
      const project = createPresetProject()
      project.style.weight = weight
      const frame = bodyFrame(project.metrics, project.style)
      const contours = new Composer(project).glyphContours('싸'.codePointAt(0)!)
      const legs = placedStrokesFor(project, 'L10', 'A').filter(
        (s) => s.kind === 'path' && s.points.length === 3,
      )
      expect(legs).toHaveLength(2)
      for (const stroke of legs) {
        if (stroke.kind !== 'path') continue
        const [left, apex, right] = stroke.points as [Point, Point, Point]
        // 꼭대기에서 두 발 가운데로 60% 내려온 점: 다리 사이의 빈 곳
        const gap = {
          x: apex.x + 0.6 * ((left.x + right.x) / 2 - apex.x),
          y: apex.y + 0.6 * ((left.y + right.y) / 2 - apex.y),
        }
        expect(insideContours(contours, toFontUnits(frame, gap)), `굵기 ${weight}`).toBe(false)
      }
    }
  })

  it('한글·영문이 아닌 글자(한자 등)는 빈 윤곽입니다', () => {
    expect(new Composer(createPresetProject()).glyphContours('一'.codePointAt(0)!)).toEqual([])
  })

  it('쌍자음 ㄲ은 ㄱ 획을 두 번 씁니다', () => {
    const project = createPresetProject()
    expect(placedStrokesFor(project, 'L1', 'A')).toHaveLength(
      placedStrokesFor(project, 'L0', 'A').length * 2,
    )
  })

  it('배치 변형(벌)을 그리면 그 배치에서만 기본 획 대신 씁니다', () => {
    const project = createPresetProject()
    project.jamo.L0!.variants = {
      B: {
        strokes: [
          { id: 'v', kind: 'path', points: [{ x: 0.5, y: 0.5 }], closed: false, smooth: false },
        ],
      },
    }
    expect(placedStrokesFor(project, 'L0', 'B')).toHaveLength(1)
    expect(placedStrokesFor(project, 'L0', 'A').length).toBeGreaterThan(0)
    // 받침 ㄱ은 초성 ㄱ의 기본 획을 쓰므로 초성의 배치 변형을 이어받지 않습니다.
    expect(placedStrokesFor(project, 'T1', 'E')).toEqual(
      placedStrokesFor(createPresetProject(), 'T1', 'E'),
    )
  })

  it('지운 자모(빈 그림)는 빈 윤곽이 됩니다', () => {
    const project = createPresetProject()
    project.jamo.L0 = { base: { strokes: [] } }
    expect(placedStrokesFor(project, 'L0', 'A')).toEqual([])
  })
})

describe('글꼴 파일 만들기', () => {
  it('굵기를 OS/2 굵기 등급으로 바꿉니다', () => {
    expect(weightClassOf(20)).toBe(100)
    expect(weightClassOf(76)).toBe(400)
    expect(weightClassOf(130)).toBe(700)
    expect(weightClassOf(400)).toBe(900)
  })

  it('운영체제가 받아들이는 이름만 남깁니다', () => {
    expect(sanitizeLatinName('루미너스 Modular!', 'X')).toBe('Modular')
    expect(sanitizeLatinName('한글만', 'Fallback')).toBe('Fallback')
    expect(postScriptName('Luminous Modular', 'Regular')).toBe('LuminousModular-Regular')
  })

  it('전체 글꼴에는 영문·숫자·문장부호 94자, 낱자 51자, 음절 11,172자가 들어갑니다', () => {
    const codes = glyphCodes()
    expect(codes).toHaveLength(94 + 11_223)
    expect(codes.filter((c) => c >= SYLLABLE_BASE)).toHaveLength(11_172)
  })

  it('입력한 글자만 담은 작은 글꼴을 만들고 다시 읽을 수 있습니다', async () => {
    const progress: string[] = []
    const result = await buildFont(
      createPresetProject(),
      { chars: '빛나는 한글 ㄱ A', woff: true },
      (p) => progress.push(p.phase),
    )
    expect(result.glyphCount).toBe(2 + 7)
    expect(result.syllableCount).toBe(5)
    expect(progress).toContain('encode')
    expect(result.woff!.byteLength).toBeLessThan(result.otf.byteLength)
    const font = parse(result.otf)
    expect(font.charToGlyph('빛').name).toBe('uniBE5B')
    expect(font.charToGlyph('ㄱ').name).toBe('uni3131')
    expect(font.charToGlyph('A').name).toBe('uni0041')
    expect(font.names.windows.fontFamily).toMatchObject({
      en: 'Luminous Modular',
      ko: '루미너스 모듈',
    })
  })

  it('WOFF2를 고르면 받은 brotli 압축기로 감싼 파일을 함께 만듭니다', async () => {
    const brotli = async (data: Uint8Array) => new Uint8Array(brotliCompressSync(data))
    const result = await buildFont(
      createPresetProject(),
      { chars: '빛나는 한글', woff: false, woff2: true },
      undefined,
      undefined,
      brotli,
    )
    expect(result.woff).toBeUndefined()
    const signature = new TextDecoder().decode(new Uint8Array(result.woff2!, 0, 4))
    expect(signature).toBe('wOF2')
    expect(result.woff2!.byteLength).toBeLessThan(result.otf.byteLength)
  })
})

/** 같은 씨앗이면 같은 수열을 주는 작은 난수 (mulberry32) */
function random(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('판을 넘어 이어 쓰는 윤곽 캐시', () => {
  const codes = [
    ...Array.from({ length: 19 }, (_, lead) => composeCode(lead, lead % 21, lead % 28)),
    ...Array.from({ length: 21 }, (_, vowel) => composeCode(vowel % 19, vowel, (vowel * 5) % 28)),
    // 각: ㄱ의 D 배치(세로 모음 + 받침). 아래에서 바꾸는 L0 변형(벌)을 실제로 쓰는 음절
    composeCode(0, 0, 1),
    0x3131,
    0x3134,
    0x314f,
    0x3158,
  ]

  it('편집을 거듭해도 캐시로 만든 윤곽이 처음부터 만든 것과 같습니다', () => {
    const next = random(20261116)
    const cache = new ComponentCache({ syllables: true })
    let project = createPresetProject()
    for (let step = 0; step < 14; step++) {
      project = structuredClone(project)
      const kind = step % 4
      if (kind === 0) project.style.weight = 40 + Math.round(next() * 120)
      else if (kind === 1) {
        // 기본 자모의 점 하나를 옮김
        const keys = Object.keys(project.jamo) as (keyof typeof project.jamo)[]
        const entry = project.jamo[keys[Math.floor(next() * keys.length)]!]!
        const stroke = entry.base!.strokes[0]!
        if (stroke.kind === 'path') stroke.points[0] = { x: next(), y: next() }
        else stroke.cx = 0.3 + next() * 0.4
      } else if (kind === 2) {
        // 배치 변형(벌) 하나를 그림
        project.jamo.L0!.variants = {
          D: {
            strokes: [
              {
                id: `v${step}`,
                kind: 'path',
                points: [
                  { x: 0.1, y: 0.1 },
                  { x: next(), y: 0.9 },
                ],
                closed: false,
                smooth: next() > 0.5,
              },
            ],
          },
        }
      } else {
        project.metrics.sideBearing = Math.round(next() * 100)
      }
      const cached = new Composer(project, cache)
      const fresh = new Composer(project)
      for (const code of codes)
        expect(cached.glyphContours(code)).toEqual(fresh.glyphContours(code))
      for (const key of ALL_JAMO_KEYS) {
        expect(cached.jamoContours(key, homeLayout(key))).toEqual(
          fresh.jamoContours(key, homeLayout(key)),
        )
      }
    }
  })

  it('점 하나를 옮기면 그 자모가 들어간 조각만 다시 만들고 나머지는 그대로 씁니다', () => {
    const cache = new ComponentCache({ syllables: true })
    const before = createPresetProject()
    const first = new Composer(before, cache)
    for (const key of ALL_JAMO_KEYS) first.jamoContours(key, homeLayout(key))
    const kept = new Map([...cache.components].map(([id, entry]) => [id, entry.component]))

    const after = structuredClone(before)
    const stroke = after.jamo.L2!.base!.strokes[0]! // ㄴ
    if (stroke.kind === 'path') stroke.points[0] = { x: 0.2, y: 0.1 }
    const second = new Composer(after, cache)
    for (const key of ALL_JAMO_KEYS) second.jamoContours(key, homeLayout(key))

    const rebuilt = [...cache.components]
      .filter(([id, entry]) => kept.get(id) !== entry.component)
      .map(([id]) => id)
    // ㄴ 초성과, ㄴ으로 만드는 받침 ㄴ·ㄵ·ㄶ만 다시 만듭니다.
    expect(rebuilt.sort()).toEqual(['L2@A', 'T4@D', 'T5@D', 'T6@D'].sort())
  })
})

describe('굵기 여러 벌(한 가족)의 이름과 스타일 연결', () => {
  const nameOf = (font: ReturnType<typeof parse>, id: string, lang = 'en') =>
    (font.names.windows as Record<string, Record<string, string>>)[id]?.[lang]

  async function member(weightClass: number, slant = 0) {
    const project = createPresetProject()
    project.style.slant = slant
    const { otf } = await buildFont(project, { chars: '가', woff: false, member: { weightClass } })
    return parse(otf)
  }

  it('Regular·Bold 밖의 굵기는 이름 ID 1이 "가족 이름 굵기", 16·17이 가족과 굵기입니다', async () => {
    const font = await member(300)
    expect(nameOf(font, 'fontFamily')).toBe('Luminous Modular Light')
    expect(nameOf(font, 'fontSubfamily')).toBe('Regular')
    expect(nameOf(font, 'preferredFamily')).toBe('Luminous Modular')
    expect(nameOf(font, 'preferredSubfamily')).toBe('Light')
    expect(nameOf(font, 'fullName')).toBe('Luminous Modular Light')
    expect(nameOf(font, 'postScriptName')).toBe('LuminousModular-Light')
    expect(nameOf(font, 'fontFamily', 'ko')).toBe('루미너스 모듈 Light')
    expect(nameOf(font, 'preferredFamily', 'ko')).toBe('루미너스 모듈')
    const os2 = font.tables.os2 as Record<string, number>
    expect(os2.usWeightClass).toBe(300)
    expect(os2.fsSelection! & (1 << 6)).toBeTruthy() // REGULAR
    expect(os2.fsSelection! & (1 << 5)).toBe(0) // BOLD 아님
  })

  it('기울기가 있으면 벌 이름에도 Italic을 넣어 똑바른 벌과 구별하고, 이탤릭 비트와 맞춥니다', async () => {
    const os2 = (font: ReturnType<typeof parse>) => font.tables.os2 as Record<string, number>
    const head = (font: ReturnType<typeof parse>) => font.tables.head as Record<string, number>

    const regular = await member(400, 10)
    expect(nameOf(regular, 'fontFamily')).toBe('Luminous Modular')
    expect(nameOf(regular, 'fontSubfamily')).toBe('Italic')
    expect(nameOf(regular, 'preferredSubfamily')).toBe('Italic')
    expect(nameOf(regular, 'fullName')).toBe('Luminous Modular Italic')
    expect(nameOf(regular, 'postScriptName')).toBe('LuminousModular-Italic')
    expect(os2(regular).fsSelection! & 1).toBe(1) // ITALIC
    expect(os2(regular).fsSelection! & (1 << 6)).toBe(0) // REGULAR 아님
    expect(head(regular).macStyle! & 2).toBe(2)

    const bold = await member(700, 10)
    expect(nameOf(bold, 'fontSubfamily')).toBe('Bold Italic')
    expect(nameOf(bold, 'postScriptName')).toBe('LuminousModular-BoldItalic')
    expect(os2(bold).fsSelection! & ((1 << 5) | 1)).toBe((1 << 5) | 1) // BOLD + ITALIC

    const light = await member(300, 10)
    expect(nameOf(light, 'fontFamily')).toBe('Luminous Modular Light')
    expect(nameOf(light, 'fontSubfamily')).toBe('Italic')
    expect(nameOf(light, 'preferredSubfamily')).toBe('Light Italic')
    expect(nameOf(light, 'fullName')).toBe('Luminous Modular Light Italic')
    expect(nameOf(light, 'postScriptName')).toBe('LuminousModular-LightItalic')
    expect(nameOf(light, 'fullName', 'ko')).toBe('루미너스 모듈 Light Italic')

    // 똑바른 벌의 이름은 그대로입니다.
    expect(nameOf(await member(300), 'postScriptName')).toBe('LuminousModular-Light')
  })

  it('Bold는 같은 가족의 굵은 짝(BOLD 비트·macStyle)이고, Black은 굵은 짝이 아닙니다', async () => {
    const bold = await member(700)
    expect(nameOf(bold, 'fontFamily')).toBe('Luminous Modular')
    expect(nameOf(bold, 'fontSubfamily')).toBe('Bold')
    expect((bold.tables.os2 as Record<string, number>).fsSelection! & (1 << 5)).toBeTruthy()
    expect((bold.tables.head as Record<string, number>).macStyle! & 1).toBe(1)

    const black = await member(900)
    expect(nameOf(black, 'fontFamily')).toBe('Luminous Modular Black')
    expect((black.tables.os2 as Record<string, number>).fsSelection! & (1 << 5)).toBe(0)
    // opentype.js는 굵기 600 이상이면 macStyle에 굵게를 켜므로 고쳐 둡니다.
    expect((black.tables.head as Record<string, number>).macStyle! & 1).toBe(0)
  })
})
