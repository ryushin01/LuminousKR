// @vitest-environment node
import { Font, Glyph, parse } from 'opentype.js/dist/opentype.mjs'
import { describe, expect, it } from 'vitest'
import type { Contour } from '../geometry/index.ts'
import { buildOtf, contoursToPath, type GlyphSpec } from './build-otf.ts'
import { subroutinizeCff } from './cff-subrs.ts'
import { readSfntTables } from './woff.ts'

const square = (x0: number, y0: number, size: number): Contour => ({
  start: { x: x0, y: y0 },
  segments: [
    { type: 'L', x: x0 + size, y: y0 },
    { type: 'L', x: x0 + size, y: y0 + size },
    { type: 'L', x: x0, y: y0 + size },
    { type: 'L', x: x0, y: y0 },
  ],
})

/** 곡선이 든 윤곽 (rrcurveto) */
const lens = (x0: number, y0: number): Contour => ({
  start: { x: x0, y: y0 },
  segments: [
    { type: 'C', x1: x0 + 40, y1: y0 + 90, x2: x0 + 160, y2: y0 + 90, x: x0 + 200, y: y0 },
    { type: 'C', x1: x0 + 160, y1: y0 - 90, x2: x0 + 40, y2: y0 - 90, x: x0, y: y0 },
  ],
})

const NAMES = {
  familyName: 'Test Modular',
  styleName: 'Regular',
  postScriptName: 'TestModular-Regular',
  version: '1.000',
}
const METRICS = {
  unitsPerEm: 1000,
  ascender: 880,
  descender: -120,
  weightClass: 400,
  italicAngle: 0,
}

const notdef: GlyphSpec = { name: '.notdef', advance: 1000, contours: [square(100, 0, 700)] }
const space: GlyphSpec = { name: 'space', unicodes: [32], advance: 280, contours: [] }

/** 자모 조각처럼 같은 자리의 같은 윤곽이 여러 글리프에 되풀이되는 글꼴 */
function repeatingGlyphs(count: number): GlyphSpec[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `uni${(0xac00 + i).toString(16).toUpperCase()}`,
    unicode: 0xac00 + i,
    advance: 1000,
    contours: [square(80, 80, 300), lens(500, 600), square(120 + (i % 7) * 40, 500, 90)],
  }))
}

/** opentype.js가 쓴 그대로의 글꼴(서브루틴 없음) */
function plainOtf(glyphs: GlyphSpec[]): ArrayBuffer {
  return new Font({
    familyName: 'Test Modular',
    styleName: 'Regular',
    unitsPerEm: 1000,
    ascender: 880,
    descender: -120,
    glyphs: glyphs.map(
      (spec) =>
        new Glyph({
          name: spec.name,
          unicode: spec.unicode,
          unicodes: spec.unicodes,
          advanceWidth: spec.advance,
          path: contoursToPath(spec.contours),
        }),
    ),
  }).toArrayBuffer()
}

/** 시험 글꼴의 CFF 표 */
const cffOf = (otf: ArrayBuffer) =>
  readSfntTables(otf).tables.find((table) => table.tag === 0x43464620)!.data

/** opentype.js로 다시 읽은 글리프 윤곽(명령 차례와 좌표)이 GlyphSpec 윤곽과 같은지 봅니다. */
function expectSameOutlines(otf: ArrayBuffer, glyphs: GlyphSpec[]) {
  const font = parse(otf)
  glyphs.forEach((spec, index) => {
    const parsed = font.glyphs.get(index)
    expect(parsed.advanceWidth, spec.name).toBe(spec.advance)
    const commands = (path: { commands: Record<string, unknown>[] }) =>
      path.commands.map((cmd) => JSON.stringify(cmd))
    expect(commands(parsed.path), spec.name).toEqual(commands(contoursToPath(spec.contours)))
  })
}

describe('CFF 서브루틴', () => {
  it('되풀이되는 윤곽을 전역 서브루틴으로 옮겨도 모든 글리프의 윤곽·너비는 그대로입니다', () => {
    const glyphs = [notdef, space, ...repeatingGlyphs(40)]
    expectSameOutlines(buildOtf(glyphs, NAMES, METRICS), glyphs)
  })

  it('되풀이되는 윤곽은 서브루틴에 한 번만 담아 CFF 표가 줄어듭니다', () => {
    const glyphs = [notdef, space, ...repeatingGlyphs(40)]
    const plain = cffOf(plainOtf(glyphs))
    const packed = subroutinizeCff(plain)
    // 40글리프의 같은 네모·렌즈 두 윤곽(글리프마다 약 40바이트)이 한 번씩만 남습니다.
    expect(packed.byteLength).toBeLessThan(plain.byteLength * 0.7)
    // buildOtf는 이미 옮겨 두므로, 다시 돌려도 더 옮길 것이 없습니다.
    const built = cffOf(buildOtf(glyphs, NAMES, METRICS))
    expect([...subroutinizeCff(built)]).toEqual([...built])
  })

  it('되풀이되는 윤곽이 없으면 서브루틴 없이 윤곽을 그대로 둡니다', () => {
    const glyphs = [notdef, space]
    const plain = cffOf(plainOtf(glyphs))
    expect([...subroutinizeCff(plain)]).toEqual([...plain])
  })

  it('서브루틴이 1,240개를 넘어 바이어스가 1131이 되어도 맞게 부릅니다', () => {
    // 서로 다른 윤곽 1,300개가 두 번씩 나오도록: 글리프 2,600개
    const glyphs: GlyphSpec[] = [notdef]
    for (let i = 0; i < 1300; i++) {
      const contour = square(10 + (i % 50) * 13, 10 + Math.floor(i / 50) * 31, 20)
      for (const copy of [0, 1]) {
        const code = 0xac00 + i * 2 + copy
        glyphs.push({
          name: `uni${code.toString(16).toUpperCase()}`,
          unicode: code,
          advance: 1000,
          contours: [contour],
        })
      }
    }
    expectSameOutlines(buildOtf(glyphs, NAMES, METRICS), glyphs)
  })
})
