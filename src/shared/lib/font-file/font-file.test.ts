// @vitest-environment node
import { parse } from 'opentype.js/dist/opentype.mjs'
import { describe, expect, it } from 'vitest'
import type { Contour } from '../geometry/index.ts'
import { buildOtf, type GlyphSpec } from './build-otf.ts'
import { buildNameTable, parseNameTable, tableChecksum, tidySfnt, writeSfnt } from './sfnt.ts'
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
  { name: 'space', unicodes: [32, 0xa0], advance: 280, contours: [] },
  { name: 'uniAC00', unicode: 0xac00, advance: 1000, contours: [square(100, -150, 900, 920)] },
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

const tagOf = (text: string) =>
  [...text].reduce((value, char) => (value << 8) | char.charCodeAt(0), 0) >>> 0

describe('글꼴 파일 규격 (fontbakery·OTS 기준)', () => {
  it('이름 표는 Windows(유니코드) 레코드만, 빈 값 없이 쓰고 Apple 전용 ltag 표를 넣지 않습니다', () => {
    const { tables } = readSfntTables(build())
    expect(tables.some((t) => t.tag === tagOf('ltag'))).toBe(false)
    const name = tables.find((t) => t.tag === tagOf('name'))!
    const records = parseNameTable(name.data)
    expect(records.length).toBeGreaterThan(0)
    for (const record of records) {
      expect(record.platformID).toBe(3)
      expect(record.encodingID).toBe(1)
      expect(record.value.trim()).not.toBe('')
      expect(record.value).toBe(record.value.trim())
    }
    const ids = (lang: number) => records.filter((r) => r.languageID === lang).map((r) => r.nameID)
    expect(ids(0x409)).toEqual(expect.arrayContaining([1, 2, 3, 4, 5, 6, 16, 17]))
    expect(records.find((r) => r.languageID === 0x412 && r.nameID === 1)?.value).toBe('시험 모듈')
    // 디자이너 주소·상표 등 비운 이름은 쓰지 않습니다.
    expect(ids(0x409)).not.toContain(7)
    expect(ids(0x409)).not.toContain(12)
  })

  it('표 체크섬과 글꼴 전체 체크섬(checkSumAdjustment)이 맞습니다', () => {
    const otf = build()
    const view = new DataView(otf)
    const count = view.getUint16(4)
    for (let i = 0; i < count; i++) {
      const at = 12 + i * 16
      const tag = view.getUint32(at)
      const offset = view.getUint32(at + 8)
      const length = view.getUint32(at + 12)
      const data = new Uint8Array(otf.slice(offset, offset + length))
      // head는 조정 값을 0으로 두고 셉니다.
      if (tag === tagOf('head')) new DataView(data.buffer).setUint32(8, 0)
      expect(view.getUint32(at + 4)).toBe(tableChecksum(data))
      expect(offset % 4).toBe(0)
    }
    expect(tableChecksum(new Uint8Array(otf))).toBe(0xb1b0afba)
  })

  it('빈칸과 줄바꿈 없는 빈칸(U+00A0)이 같은 글리프를 씁니다', () => {
    const font = parse(build())
    expect(font.charToGlyph('\u00a0').name).toBe('space')
    expect(font.charToGlyph(' ').name).toBe('space')
  })

  it('OS/2 4판에 USE_TYPO_METRICS를 켜고, Windows 잘림 기준은 글자 몸과 글리프 범위 가운데 큰 쪽입니다', () => {
    const os2 = parse(build()).tables.os2 as Record<string, number>
    expect(os2.version).toBe(4)
    expect(os2.fsSelection! & (1 << 7)).toBeTruthy()
    expect(os2.sTypoAscender).toBe(880)
    expect(os2.sTypoDescender).toBe(-120)
    // 시험 글리프가 위 920·아래 −150까지 그려져 있습니다.
    expect(os2.usWinAscent).toBe(920)
    expect(os2.usWinDescent).toBe(150)
  })

  it('표를 다시 묶어도 내용은 그대로이고, 이름 표를 다시 써도 같은 레코드를 읽습니다', () => {
    const otf = build()
    const again = tidySfnt(otf)
    const before = readSfntTables(otf).tables.map((t) => [t.tag, [...t.data].join()])
    const after = readSfntTables(again).tables.map((t) => [t.tag, [...t.data].join()])
    // head는 checkSumAdjustment만 다를 수 있어 빼고 비교합니다.
    const head = tagOf('head')
    expect(after.filter(([tag]) => tag !== head)).toEqual(before.filter(([tag]) => tag !== head))

    const records = [
      { platformID: 3, encodingID: 1, languageID: 0x409, nameID: 1, value: 'Family' },
      { platformID: 3, encodingID: 1, languageID: 0x412, nameID: 1, value: '가족' },
    ]
    expect(parseNameTable(buildNameTable(records))).toEqual(records)
    const empty = writeSfnt(0x4f54544f, [])
    expect(new DataView(empty).getUint16(4)).toBe(0)
  })
})

describe('이름 표 쓰기', () => {
  const record = (nameID: number, value: string, languageID = 0x0409) => ({
    platformID: 3,
    encodingID: 1,
    languageID,
    nameID,
    value,
  })

  it('같은 문자열은 한 번만 담고 위치를 함께 씁니다', () => {
    const records = [record(5, 'Version 1.000'), record(5, 'Version 1.000', 0x0412)]
    const table = buildNameTable(records)
    // 머리말 6 + 레코드 2 × 12 + 문자열 한 벌(13자 × 2바이트)
    expect(table.length).toBe(6 + 2 * 12 + 26)
    expect(parseNameTable(table)).toEqual(records)
  })

  it('문자열 위치가 16비트를 넘으면 값이 돌아 다른 이름을 가리키지 않도록 거부합니다', () => {
    // 2만 자 문자열 둘 다음의 위치는 80,000바이트라 16비트(65,535)에 담기지 않습니다.
    const records = [
      record(10, 'a'.repeat(20_000)),
      record(13, 'b'.repeat(20_000)),
      record(16, 'Family'),
    ]
    expect(() => buildNameTable(records)).toThrow(RangeError)
    // 같은 값이면 한 번만 담으므로 담깁니다.
    const same = [
      record(10, 'a'.repeat(20_000)),
      record(13, 'a'.repeat(20_000)),
      record(16, 'Family'),
    ]
    expect(parseNameTable(buildNameTable(same))).toEqual(same)
  })

  it('문자열 하나의 길이가 16비트를 넘어도 거부합니다', () => {
    expect(() => buildNameTable([record(13, 'c'.repeat(40_000))])).toThrow(RangeError)
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
