// @vitest-environment node
import { brotliCompressSync, brotliDecompressSync, constants } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import type { Contour } from '../geometry/index.ts'
import { buildOtf, type GlyphSpec } from './build-otf.ts'
import { writeSfnt } from './sfnt.ts'
import { readSfntTables } from './woff.ts'
import { encodeUIntBase128, sfntToWoff2 } from './woff2.ts'

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

const buildTestOtf = () =>
  buildOtf(
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

/** 시험에서는 Node의 brotli로 압축합니다(브라우저는 내장 압축이나 WASM). */
const nodeBrotli = async (data: Uint8Array) =>
  new Uint8Array(brotliCompressSync(data, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }))

const tag = (text: string) =>
  [...text].reduce((value, ch) => value * 256 + ch.charCodeAt(0), 0) >>> 0
const tagText = (value: number) =>
  String.fromCharCode(value >>> 24, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff)

/** 규격 4.1절 알려진 태그 표의 앞부분(이 시험의 글꼴에 나오는 것) */
const KNOWN_INDEX: Record<string, number> = {
  cmap: 0, head: 1, hhea: 2, hmtx: 3, maxp: 4, name: 5, 'OS/2': 6, post: 7, 'CFF ': 13,
} // prettier-ignore

type DecodedEntry = { flags: number; tag: string; origLength: number }

/** 시험용 WOFF2 풀기(변환 없는 표만): 디렉터리를 읽고 brotli 덩어리를 풀어 표마다 나눕니다. */
function decodeWoff2(file: ArrayBuffer) {
  const view = new DataView(file)
  const bytes = new Uint8Array(file)
  const header = {
    signature: view.getUint32(0),
    flavor: view.getUint32(4),
    length: view.getUint32(8),
    numTables: view.getUint16(12),
    reserved: view.getUint16(14),
    totalSfntSize: view.getUint32(16),
    totalCompressedSize: view.getUint32(20),
    meta: [view.getUint32(28), view.getUint32(32), view.getUint32(36)],
    priv: [view.getUint32(40), view.getUint32(44)],
  }
  let at = 48
  const readBase128 = () => {
    let value = 0
    for (let i = 0; i < 5; i++) {
      const byte = bytes[at++]!
      value = value * 128 + (byte & 0x7f)
      if (!(byte & 0x80)) return value
    }
    throw new Error('UIntBase128가 5바이트를 넘습니다')
  }
  const entries: DecodedEntry[] = []
  for (let i = 0; i < header.numTables; i++) {
    const flags = bytes[at++]!
    const index = flags & 0x3f
    let name: string
    if (index === 63) {
      name = tagText(view.getUint32(at))
      at += 4
    } else {
      name = Object.keys(KNOWN_INDEX).find((key) => KNOWN_INDEX[key] === index) ?? `#${index}`
    }
    entries.push({ flags, tag: name, origLength: readBase128() })
  }
  const block = bytes.subarray(at, at + header.totalCompressedSize)
  const stream = new Uint8Array(brotliDecompressSync(block))
  const tables = new Map<string, Uint8Array>()
  let offset = 0
  for (const entry of entries) {
    tables.set(entry.tag, stream.subarray(offset, offset + entry.origLength))
    offset += entry.origLength
  }
  return {
    header,
    entries,
    tables,
    streamLength: stream.byteLength,
    blockEnd: at + header.totalCompressedSize,
  }
}

describe('UIntBase128', () => {
  it('큰 자리부터, 마지막 바이트만 최상위 비트를 끄고, 앞자리 0 없이 가장 짧게 씁니다', () => {
    expect(encodeUIntBase128(0)).toEqual([0x00])
    expect(encodeUIntBase128(127)).toEqual([0x7f])
    expect(encodeUIntBase128(128)).toEqual([0x81, 0x00])
    expect(encodeUIntBase128(16383)).toEqual([0xff, 0x7f])
    expect(encodeUIntBase128(16384)).toEqual([0x81, 0x80, 0x00])
    expect(encodeUIntBase128(0xffffffff)).toEqual([0x8f, 0xff, 0xff, 0xff, 0x7f])
  })

  it('32비트를 넘거나 음수·소수는 거부합니다', () => {
    expect(() => encodeUIntBase128(2 ** 32)).toThrow(RangeError)
    expect(() => encodeUIntBase128(-1)).toThrow(RangeError)
    expect(() => encodeUIntBase128(1.5)).toThrow(RangeError)
  })
})

describe('WOFF2 감싸기', () => {
  it('머리말과 디렉터리를 규격대로 쓰고, 풀면 원래 표와 같습니다(head는 11번 비트만 켬)', async () => {
    const otf = buildTestOtf()
    const woff2 = await sfntToWoff2(otf, nodeBrotli)
    const { header, entries, tables, streamLength, blockEnd } = decodeWoff2(woff2)
    const original = readSfntTables(otf).tables

    expect(header.signature).toBe(0x774f4632) // wOF2
    expect(header.flavor).toBe(0x4f54544f) // OTTO
    expect(header.length).toBe(woff2.byteLength)
    expect(woff2.byteLength % 4).toBe(0)
    expect(woff2.byteLength - blockEnd).toBeLessThan(4)
    expect(header.numTables).toBe(original.length)
    expect(header.reserved).toBe(0)
    expect(header.meta).toEqual([0, 0, 0])
    expect(header.priv).toEqual([0, 0])
    const padded = original.reduce((sum, t) => sum + ((t.data.byteLength + 3) & ~3), 0)
    expect(header.totalSfntSize).toBe(12 + 16 * original.length + padded)
    expect(streamLength).toBe(original.reduce((sum, t) => sum + t.data.byteLength, 0))

    for (const entry of entries) {
      // 알려진 태그는 색인으로, 변환 없음(버전 0)
      expect(entry.flags).toBe(KNOWN_INDEX[entry.tag])
    }
    for (const table of original) {
      const name = tagText(table.tag)
      const restored = tables.get(name)
      expect(restored, name).toBeDefined()
      if (name === 'head') {
        const before = new DataView(table.data.buffer, table.data.byteOffset).getUint16(16)
        const after = new DataView(restored!.buffer, restored!.byteOffset).getUint16(16)
        expect(after).toBe(before | 0x0800)
        expect([...restored!.subarray(18)]).toEqual([...table.data.subarray(18)])
        expect([...restored!.subarray(0, 16)]).toEqual([...table.data.subarray(0, 16)])
      } else {
        expect([...restored!], name).toEqual([...table.data])
      }
    }
  })

  it('알려진 표에 없는 태그는 63 뒤에 태그를 그대로 적고, 서명 표(DSIG)는 뺍니다', async () => {
    const head = new Uint8Array(54)
    const sfnt = writeSfnt(0x4f54544f, [
      { tag: tag('head'), data: head },
      { tag: tag('DSIG'), data: new Uint8Array([0, 0, 0, 1, 0, 0, 0, 0]) },
      { tag: tag('Lumi'), data: new Uint8Array([1, 2, 3, 4, 5]) },
    ])
    const { header, entries, tables } = decodeWoff2(await sfntToWoff2(sfnt, nodeBrotli))
    expect(header.numTables).toBe(2)
    expect(entries.map((entry) => entry.tag)).toEqual(['Lumi', 'head'])
    expect(entries.find((entry) => entry.tag === 'Lumi')!.flags).toBe(63)
    expect([...tables.get('Lumi')!]).toEqual([1, 2, 3, 4, 5])
  })
})
