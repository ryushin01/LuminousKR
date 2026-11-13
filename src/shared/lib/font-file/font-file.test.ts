// @vitest-environment node
import { parse } from 'opentype.js/dist/opentype.mjs'
import { describe, expect, it } from 'vitest'
import type { Contour } from '../geometry/index.ts'
import { buildOtf, type GlyphSpec } from './build-otf.ts'
import { readSfntTables, sfntToWoff, zlibDecompress } from './woff.ts'

const square = (x0: number, y0: number, x1: number, y1: number): Contour => ({
  start: { x: x0, y: y0 },
  segments: [
    { type: 'L', x: x1, y: y0 },
    { type: 'L', x: x1, y: y1 },
    { type: 'L', x: x0, y: y1 },
    { type: 'L', x: x0, y: y0 },
  ],
})

const GLYPHS: GlyphSpec[] = [
  { name: '.notdef', advance: 1000, contours: [square(100, 0, 900, 700)] },
  { name: 'space', unicode: 32, advance: 280, contours: [] },
  { name: 'uniAC00', unicode: 0xac00, advance: 1000, contours: [square(100, -50, 900, 800)] },
]

function build() {
  return buildOtf(
    GLYPHS,
    {
      familyName: 'Test Modular',
      familyNameKo: '시험 모듈',
      styleName: 'Regular',
      postScriptName: 'TestModular-Regular',
      version: '1.000',
    },
    { unitsPerEm: 1000, ascender: 880, descender: -120, weightClass: 400, italicAngle: 0 },
  )
}

describe('OTF 만들기', () => {
  it('CFF 글꼴(OTTO)을 만들고 다시 읽을 수 있습니다', () => {
    const otf = build()
    expect(new TextDecoder().decode(new Uint8Array(otf, 0, 4))).toBe('OTTO')
    const font = parse(otf)
    expect(font.glyphs.length).toBe(3)
    expect(font.charToGlyph('가').name).toBe('uniAC00')
    expect(font.charToGlyph('가').advanceWidth).toBe(1000)
  })

  it('영문·한국어 이름과 PostScript 이름을 기록합니다', () => {
    const font = parse(build())
    expect(font.names.windows.fontFamily).toMatchObject({ en: 'Test Modular', ko: '시험 모듈' })
    expect(font.names.windows.postScriptName?.en).toBe('TestModular-Regular')
  })

  it('OS/2에 한국어 코드 페이지와 설치 가능(fsType 0)을 적습니다', () => {
    const font = parse(build())
    const os2 = font.tables.os2 as Record<string, number>
    expect(os2.ulCodePageRange1! & (1 << 19)).toBeTruthy()
    expect(os2.fsType).toBe(0)
    expect(os2.usWeightClass).toBe(400)
  })

  it('첫 글리프가 .notdef가 아니면 거부합니다', () => {
    expect(() =>
      buildOtf(
        GLYPHS.slice(1),
        { familyName: 'X', styleName: 'R', postScriptName: 'X-R', version: '1.000' },
        { unitsPerEm: 1000, ascender: 880, descender: -120, weightClass: 400, italicAngle: 0 },
      ),
    ).toThrow()
  })
})

describe('WOFF 감싸기', () => {
  it('머리말과 표를 규격대로 쓰고, 압축을 풀면 원래 표와 같습니다', async () => {
    const otf = build()
    const woff = await sfntToWoff(otf)
    const view = new DataView(woff)
    expect(view.getUint32(0)).toBe(0x774f4646) // wOFF
    expect(view.getUint32(4)).toBe(0x4f54544f) // OTTO
    expect(view.getUint32(8)).toBe(woff.byteLength)
    const { tables } = readSfntTables(otf)
    expect(view.getUint16(12)).toBe(tables.length)

    for (let i = 0; i < tables.length; i++) {
      const at = 44 + i * 20
      const offset = view.getUint32(at + 4)
      const compLength = view.getUint32(at + 8)
      const origLength = view.getUint32(at + 12)
      expect(offset % 4).toBe(0)
      const stored = new Uint8Array(woff, offset, compLength)
      const restored = compLength < origLength ? await zlibDecompress(stored) : stored
      expect([...restored]).toEqual([...tables[i]!.data])
    }
  })
})
