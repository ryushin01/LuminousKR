/**
 * sfnt(OTF) 파일을 WOFF 2.0으로 감쌉니다. (W3C WOFF File Format 2.0)
 * 이 앱이 만드는 글꼴은 CFF라 glyf·loca 변환이 없으므로 모든 표를 '변환 없음'(변환 버전 0)으로 두고,
 * 표를 디렉터리 차례로 이어 붙여(사이에 채움 없이) brotli 한 덩어리로 압축합니다.
 * brotli 압축기는 밖에서 받습니다(브라우저는 내장 압축이나 WASM, 시험은 Node zlib).
 */
import { readSfntTables } from './woff.ts'

const WOFF2_SIGNATURE = 0x774f4632 // 'wOF2'
const HEADER_SIZE = 48
const SFNT_HEADER_SIZE = 12
const SFNT_DIRECTORY_ENTRY_SIZE = 16
const ARBITRARY_TAG = 63

const tagValue = (text: string) =>
  [...text].reduce((value, ch) => value * 256 + ch.charCodeAt(0), 0) >>> 0

const DSIG = tagValue('DSIG')
const HEAD = tagValue('head')

/** 규격 4.1절 알려진 태그(색인 0~62). 이 표에 있는 태그는 반드시 색인으로 적습니다. */
const KNOWN_TAGS = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca',
  'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea',
  'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL',
  'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar',
  'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat',
  'Gloc', 'Feat', 'Sill',
] // prettier-ignore
const KNOWN_INDEX = new Map(KNOWN_TAGS.map((name, index) => [tagValue(name), index]))

const pad4 = (n: number) => (n + 3) & ~3

/** 부호 없는 32비트 정수를 UIntBase128로: 큰 자리부터 7비트씩, 마지막 바이트만 최상위 비트를 끄고, 앞자리 0 없이 */
export function encodeUIntBase128(value: number): number[] {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new RangeError(`UIntBase128로 쓸 수 없는 값입니다: ${value}`)
  }
  const out = [value % 128]
  for (let rest = Math.floor(value / 128); rest > 0; rest = Math.floor(rest / 128)) {
    out.unshift((rest % 128) | 0x80)
  }
  return out
}

/**
 * head.flags(표의 16바이트째)의 11번 비트를 켠 사본: 압축·최적화를 거쳐 원본과 바이트가 같지 않을 수 있다는 표시로,
 * WOFF2 부호화기는 켜야 합니다. 체크섬은 받는 쪽(디코더)이 다시 계산합니다.
 */
function markLosslessModified(head: Uint8Array): Uint8Array {
  const copy = head.slice()
  const view = new DataView(copy.buffer)
  view.setUint16(16, view.getUint16(16) | (1 << 11))
  return copy
}

export async function sfntToWoff2(
  sfnt: ArrayBuffer,
  compress: (data: Uint8Array) => Promise<Uint8Array>,
  version = { major: 1, minor: 0 },
): Promise<ArrayBuffer> {
  const { flavor, tables: all } = readSfntTables(sfnt)
  // 부호화기는 서명 표(DSIG)를 빼야 합니다(바꾼 글꼴에서는 서명이 맞지 않음).
  const tables = all
    .filter((table) => table.tag !== DSIG)
    .map((table) =>
      table.tag === HEAD ? { ...table, data: markLosslessModified(table.data) } : table,
    )

  const directory: number[] = []
  for (const table of tables) {
    const index = KNOWN_INDEX.get(table.tag)
    if (index === undefined) {
      directory.push(
        ARBITRARY_TAG,
        table.tag >>> 24,
        (table.tag >>> 16) & 0xff,
        (table.tag >>> 8) & 0xff,
        table.tag & 0xff,
      )
    } else {
      directory.push(index) // 위 두 비트(변환 버전) 0 = 변환 없음
    }
    directory.push(...encodeUIntBase128(table.data.byteLength))
  }

  const stream = new Uint8Array(tables.reduce((sum, t) => sum + t.data.byteLength, 0))
  let offset = 0
  for (const table of tables) {
    stream.set(table.data, offset)
    offset += table.data.byteLength
  }
  const compressed = await compress(stream)

  const blockOffset = HEADER_SIZE + directory.length
  // 파일 끝은 4바이트 경계까지 0으로 채웁니다(규격이 허용하는 최대 3바이트).
  const length = pad4(blockOffset + compressed.byteLength)
  const totalSfntSize =
    SFNT_HEADER_SIZE +
    tables.length * SFNT_DIRECTORY_ENTRY_SIZE +
    tables.reduce((sum, t) => sum + pad4(t.data.byteLength), 0)

  const out = new ArrayBuffer(length)
  const view = new DataView(out)
  const bytes = new Uint8Array(out)
  view.setUint32(0, WOFF2_SIGNATURE)
  view.setUint32(4, flavor)
  view.setUint32(8, length)
  view.setUint16(12, tables.length)
  view.setUint16(14, 0)
  view.setUint32(16, totalSfntSize)
  view.setUint32(20, compressed.byteLength)
  view.setUint16(24, version.major)
  view.setUint16(26, version.minor)
  // 메타데이터·비공개 블록 없음 (28~47은 0)
  bytes.set(directory, HEADER_SIZE)
  bytes.set(compressed, blockOffset)
  return out
}
