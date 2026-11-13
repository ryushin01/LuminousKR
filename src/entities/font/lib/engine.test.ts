// @vitest-environment node
import { parse } from 'opentype.js/dist/opentype.mjs'
import { describe, expect, it } from 'vitest'
import { type Contour, cubicPoint } from '@/shared/lib/geometry'
import { SYLLABLE_BASE } from '@/shared/lib/hangul'
import { createPresetProject } from '../model/preset.ts'
import type { FontProject } from '../model/types.ts'
import {
  buildFont,
  glyphCodes,
  postScriptName,
  sanitizeLatinName,
  weightClassOf,
} from './build-font.ts'
import { Composer, placedStrokesFor } from './composer.ts'
import { bodyFrame, expandStrokes, pathsBounds, pathsToContours } from './outline.ts'
import type { PlacedStroke } from './resolve.ts'

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

  it('한글이 아닌 글자는 빈 윤곽입니다', () => {
    expect(new Composer(createPresetProject()).glyphContours('A'.codePointAt(0)!)).toEqual([])
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

  it('전체 글꼴에는 낱자 51자와 음절 11,172자가 들어갑니다', () => {
    const codes = glyphCodes()
    expect(codes).toHaveLength(11_223)
    expect(codes.filter((c) => c >= SYLLABLE_BASE)).toHaveLength(11_172)
  })

  it('입력한 글자만 담은 작은 글꼴을 만들고 다시 읽을 수 있습니다', async () => {
    const progress: string[] = []
    const result = await buildFont(
      createPresetProject(),
      { chars: '빛나는 한글 ㄱ A', woff: true },
      (p) => progress.push(p.phase),
    )
    expect(result.glyphCount).toBe(2 + 6)
    expect(result.syllableCount).toBe(5)
    expect(progress).toContain('encode')
    expect(result.woff!.byteLength).toBeLessThan(result.otf.byteLength)
    const font = parse(result.otf)
    expect(font.charToGlyph('빛').name).toBe('uniBE5B')
    expect(font.charToGlyph('ㄱ').name).toBe('uni3131')
    expect(font.names.windows.fontFamily).toMatchObject({
      en: 'Luminous Modular',
      ko: '루미너스 모듈',
    })
  })
})
