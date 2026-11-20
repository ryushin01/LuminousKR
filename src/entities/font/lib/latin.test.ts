// @vitest-environment node
import { parse } from 'opentype.js/dist/opentype.mjs'
import { describe, expect, it } from 'vitest'
import { type Contour, cubicPoint } from '@/shared/lib/geometry'
import { LATIN_CHARS, latinWidth } from '../model/latin.ts'
import { createPresetProject } from '../model/preset.ts'
import { buildFont, glyphCodes } from './build-font.ts'
import { Composer, isComposable } from './composer.ts'
import { LATIN_ASCENT, LATIN_DESCENT, latinAdvance, latinFrame, toFontUnits } from './outline.ts'
import { insideContours } from './test-helpers.ts'

/** 곡선 위 점까지 따져 본 윤곽의 범위 */
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

const code = (char: string) => char.charCodeAt(0)

describe('영문 글리프 만들기', () => {
  it('ASCII 인쇄 글자 94자를 조합하고, 빈칸·지움 문자·한자는 조합하지 않습니다', () => {
    expect(LATIN_CHARS.every((char) => isComposable(code(char)))).toBe(true)
    expect([0x20, 0x7f, 0x4e00].some(isComposable)).toBe(false)
  })

  it('뼈대 틀은 정사각 비율이고, 가로획 바깥이 어센더·디센더에 닿습니다', () => {
    const project = createPresetProject()
    const frame = latinFrame(project.metrics, project.style)
    const span = frame.yTop - frame.yBottom
    expect(frame.x1 - frame.x0).toBeCloseTo(span)
    const half = (project.style.weight * project.style.contrast) / 2
    expect(frame.yTop + half).toBeCloseTo(LATIN_ASCENT)
    expect(frame.yBottom - half).toBeCloseTo(LATIN_DESCENT)
  })

  it('기본 굵기에서 H는 기준선부터 대문자 높이까지, x는 x높이 500까지, p·l은 디센더·어센더까지 그려집니다', () => {
    const composer = new Composer(createPresetProject())
    const box = (char: string) => trueBounds(composer.glyphContours(code(char)))
    expect(box('H').y0).toBeCloseTo(0, -1)
    expect(box('H').y1).toBeCloseTo(717, -1)
    expect(box('x').y0).toBeCloseTo(0, -1)
    expect(box('x').y1).toBeCloseTo(500, -1)
    expect(box('p').y0).toBeCloseTo(LATIN_DESCENT, -1)
    expect(box('l').y1).toBeCloseTo(LATIN_ASCENT, -1)
  })

  it('94자 모두 윤곽이 있고, 글자 너비와 어센더·디센더 안에 들어갑니다', () => {
    const composer = new Composer(createPresetProject())
    for (const char of LATIN_CHARS) {
      const contours = composer.glyphContours(code(char))
      expect(contours.length, char).toBeGreaterThan(0)
      const box = trueBounds(contours)
      expect(box.x0, char).toBeGreaterThan(0)
      expect(box.x1, char).toBeLessThan(composer.glyphAdvance(code(char)))
      expect(box.y0, char).toBeGreaterThanOrEqual(LATIN_DESCENT - 2)
      expect(box.y1, char).toBeLessThanOrEqual(LATIN_ASCENT + 2)
    }
  })

  it('M의 사선 위아래와 V 꼭짓점 아래는 비어 있고, 기둥은 채워져 있습니다', () => {
    for (const style of [{}, { weight: 30 }, { cap: 'butt', join: 'miter' }] as const) {
      const project = createPresetProject()
      Object.assign(project.style, style)
      const frame = latinFrame(project.metrics, project.style)
      const contours = new Composer(project).glyphContours(code('M'))
      // 기둥과 사선 사이의 좁은 틈(안쪽 각 약 29°)이 메워지면 안 됩니다.
      for (const empty of [
        { x: 0.38, y: 0.4 },
        { x: 0.15, y: 0.6 },
        { x: 0.61, y: 0.6 },
        { x: 0.38, y: 0.8 },
      ]) {
        expect(insideContours(contours, toFontUnits(frame, empty)), JSON.stringify(empty)).toBe(
          false,
        )
      }
      expect(insideContours(contours, toFontUnits(frame, { x: 0.03, y: 0.5 }))).toBe(true)
    }
  })

  it('글자 너비는 뼈대 너비 × 틀 높이 + 세로획 굵기 + 좌우 여백 둘이고, 한글은 그대로입니다', () => {
    const project = createPresetProject()
    const composer = new Composer(project)
    const frame = latinFrame(project.metrics, project.style)
    const width = latinWidth(project, 'H')
    const expected = Math.round(
      width * (frame.yTop - frame.yBottom) + project.style.weight + 2 * project.metrics.sideBearing,
    )
    expect(composer.glyphAdvance(code('H'))).toBe(expected)
    expect(latinAdvance(project.metrics, project.style, width)).toBe(expected)
    expect(composer.glyphAdvance(0xac00)).toBe(project.metrics.advance)
  })

  it('고친 그림과 너비를 쓰고, 다 지운 글자는 윤곽이 없습니다', () => {
    const project = createPresetProject()
    project.latin.I = { drawing: { strokes: [] } }
    project.latin.H = { width: 0.9 }
    const composer = new Composer(project)
    expect(composer.glyphContours(code('I'))).toEqual([])
    expect(composer.glyphAdvance(code('H'))).toBeGreaterThan(
      new Composer(createPresetProject()).glyphAdvance(code('H')),
    )
  })

  it('기울기를 주면 영문도 한글처럼 기웁니다', () => {
    const upright = trueBounds(new Composer(createPresetProject()).glyphContours(code('l')))
    const project = createPresetProject()
    project.style.slant = 12
    const slanted = trueBounds(new Composer(project).glyphContours(code('l')))
    expect(slanted.x1 - slanted.x0).toBeGreaterThan(upright.x1 - upright.x0 + 100)
  })
})

describe('영문을 넣은 글꼴 파일', () => {
  it('전체 글꼴에 영문·숫자·문장부호 94자가 들어가고, 끄면 한글만 넣습니다', () => {
    expect(glyphCodes()).toHaveLength(94 + 51 + 11_172)
    expect(glyphCodes(undefined, false)).toHaveLength(51 + 11_172)
    expect(glyphCodes('a가A')).toEqual([code('A'), code('a'), 0xac00])
    expect(glyphCodes('a가A', false)).toEqual([0xac00])
  })

  it('영문 글리프는 글자마다 너비가 다르고, OS/2 x높이·대문자 높이는 x·H 윤곽에서 잽니다', async () => {
    const project = createPresetProject()
    const result = await buildFont(project, { chars: 'Hxil가', woff: false })
    expect(result.glyphCount).toBe(2 + 5)
    const font = parse(result.otf)
    const composer = new Composer(project)
    expect(font.charToGlyph('H').name).toBe('uni0048')
    expect(font.charToGlyph('H').advanceWidth).toBe(composer.glyphAdvance(code('H')))
    expect(font.charToGlyph('i').advanceWidth).toBeLessThan(font.charToGlyph('H').advanceWidth)
    expect(font.charToGlyph('가').advanceWidth).toBe(project.metrics.advance)
    expect(font.tables.os2.sxHeight).toBeCloseTo(500, -1)
    expect(font.tables.os2.sCapHeight).toBeCloseTo(717, -1)
  })

  it('다 지운 영문 글자는 글꼴에 넣지 않아, 쓰는 곳에서 다른 글꼴로 보이게 합니다', async () => {
    const project = createPresetProject()
    project.latin.A = { drawing: { strokes: [] } }
    const result = await buildFont(project, { chars: 'AB', woff: false })
    expect(result.glyphCount).toBe(2 + 1)
    const font = parse(result.otf)
    expect(font.charToGlyph('A').name).toBe('.notdef')
    expect(font.charToGlyph('B').name).toBe('uni0042')
  })

  it('영문을 빼고 한글만 넣을 수 있습니다', async () => {
    const result = await buildFont(createPresetProject(), {
      chars: 'AB가',
      woff: false,
      latin: false,
    })
    expect(result.glyphCount).toBe(2 + 1)
  })
})
