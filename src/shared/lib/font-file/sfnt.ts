/**
 * sfnt(OTF) 표 다시 묶기와 이름(name) 표 정리.
 *
 * opentype.js 2.0은 비운 이름(저작권·상표·디자이너 주소 등)을 공백 한 칸으로 채우고, 유니코드·Mac 플랫폼
 * 이름도 함께 쓰며 그 때문에 Apple 전용 ltag 표를 넣습니다. 글꼴 검사기(fontbakery)는 이를 모두 실패로 보므로,
 * 이름 표를 Windows(유니코드) 레코드만, 빈 값은 빼고 다시 쓰고 ltag를 뺍니다.
 */
import { readSfntTables } from './woff.ts'

export type SfntTable = { tag: number; data: Uint8Array }

export type NameRecord = {
  platformID: number
  encodingID: number
  languageID: number
  nameID: number
  value: string
}

const tag = (text: string) =>
  [...text].reduce((value, char) => (value << 8) | char.charCodeAt(0), 0) >>> 0

const TAG_HEAD = tag('head')
const TAG_NAME = tag('name')
const TAG_LTAG = tag('ltag')

/** 표 체크섬: 4바이트 큰 끝 정수의 합 (모자란 끝은 0으로 채움) */
export function tableChecksum(data: Uint8Array): number {
  let sum = 0
  const full = data.length & ~3
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  for (let i = 0; i < full; i += 4) sum = (sum + view.getUint32(i)) >>> 0
  if (full < data.length) {
    let last = 0
    for (let i = 0; i < 4; i++) last = (last << 8) | (data[full + i] ?? 0)
    sum = (sum + (last >>> 0)) >>> 0
  }
  return sum
}

const pad4 = (n: number) => (n + 3) & ~3

/**
 * 표들로 sfnt 파일을 씁니다. 표 디렉터리는 태그 순서, 표는 4바이트 경계에 맞추고,
 * head.checkSumAdjustment(글꼴 전체 체크섬이 0xB1B0AFBA가 되게 하는 값)를 다시 계산합니다.
 */
export function writeSfnt(flavor: number, input: readonly SfntTable[]): ArrayBuffer {
  const tables = [...input].sort((a, b) => a.tag - b.tag)
  const count = tables.length
  const headerSize = 12 + count * 16
  const total = tables.reduce((sum, t) => sum + pad4(t.data.byteLength), headerSize)
  const out = new ArrayBuffer(total)
  const view = new DataView(out)
  const bytes = new Uint8Array(out)

  let power = 1
  let log = 0
  while (power * 2 <= count) {
    power *= 2
    log += 1
  }
  view.setUint32(0, flavor)
  view.setUint16(4, count)
  view.setUint16(6, power * 16)
  view.setUint16(8, log)
  view.setUint16(10, count * 16 - power * 16)

  let offset = headerSize
  let headOffset = -1
  tables.forEach((table, i) => {
    const data = table.data.slice()
    // 전체 체크섬을 다시 계산하므로 head의 조정 값은 0으로 두고 셉니다.
    if (table.tag === TAG_HEAD) {
      new DataView(data.buffer).setUint32(8, 0)
      headOffset = offset
    }
    const at = 12 + i * 16
    view.setUint32(at, table.tag)
    view.setUint32(at + 4, tableChecksum(data))
    view.setUint32(at + 8, offset)
    view.setUint32(at + 12, data.byteLength)
    bytes.set(data, offset)
    offset += pad4(data.byteLength)
  })
  if (headOffset >= 0) {
    view.setUint32(headOffset + 8, (0xb1b0afba - tableChecksum(bytes)) >>> 0)
  }
  return out
}

function decodeUtf16(bytes: Uint8Array): string {
  let text = ''
  for (let i = 0; i + 1 < bytes.length; i += 2)
    text += String.fromCharCode((bytes[i]! << 8) | bytes[i + 1]!)
  return text
}

function encodeUtf16(text: string): Uint8Array {
  const out = new Uint8Array(text.length * 2)
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    out[i * 2] = code >> 8
    out[i * 2 + 1] = code & 0xff
  }
  return out
}

/** 이름 표를 읽습니다. 유니코드·Windows 플랫폼은 UTF-16BE, Mac 플랫폼은 1바이트 글자로 봅니다. */
export function parseNameTable(data: Uint8Array): NameRecord[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const count = view.getUint16(2)
  const storage = view.getUint16(4)
  const records: NameRecord[] = []
  for (let i = 0; i < count; i++) {
    const at = 6 + i * 12
    const platformID = view.getUint16(at)
    const length = view.getUint16(at + 8)
    const offset = view.getUint16(at + 10)
    const raw = data.subarray(storage + offset, storage + offset + length)
    records.push({
      platformID,
      encodingID: view.getUint16(at + 2),
      languageID: view.getUint16(at + 4),
      nameID: view.getUint16(at + 6),
      value: platformID === 1 ? String.fromCharCode(...raw) : decodeUtf16(raw),
    })
  }
  return records
}

/** 이름 표(형식 0)를 씁니다. 레코드는 플랫폼·인코딩·언어·이름 번호 순서로 정렬합니다. */
export function buildNameTable(input: readonly NameRecord[]): Uint8Array {
  const records = [...input].sort(
    (a, b) =>
      a.platformID - b.platformID ||
      a.encodingID - b.encodingID ||
      a.languageID - b.languageID ||
      a.nameID - b.nameID,
  )
  const strings = records.map((r) => encodeUtf16(r.value))
  const storage = 6 + records.length * 12
  const size = strings.reduce((sum, s) => sum + s.length, storage)
  const out = new Uint8Array(size)
  const view = new DataView(out.buffer)
  view.setUint16(0, 0)
  view.setUint16(2, records.length)
  view.setUint16(4, storage)
  let offset = 0
  records.forEach((record, i) => {
    const at = 6 + i * 12
    const text = strings[i]!
    view.setUint16(at, record.platformID)
    view.setUint16(at + 2, record.encodingID)
    view.setUint16(at + 4, record.languageID)
    view.setUint16(at + 6, record.nameID)
    view.setUint16(at + 8, text.length)
    view.setUint16(at + 10, offset)
    out.set(text, storage + offset)
    offset += text.length
  })
  return out
}

/** 쓸 이름: Windows 플랫폼(3)·유니코드 BMP(1) 레코드 가운데 비어 있지 않은 것 */
export function keepWindowsNames(records: readonly NameRecord[]): NameRecord[] {
  return records.filter((r) => r.platformID === 3 && r.encodingID === 1 && r.value.trim() !== '')
}

/**
 * opentype.js가 쓴 글꼴을 정리합니다.
 * 이름 표는 Windows(유니코드) 레코드만 빈 값 없이 다시 쓰고, Apple 전용 ltag 표를 뺍니다.
 */
export function tidySfnt(sfnt: ArrayBuffer): ArrayBuffer {
  const { flavor, tables } = readSfntTables(sfnt)
  const next: SfntTable[] = []
  for (const table of tables) {
    if (table.tag === TAG_LTAG) continue
    if (table.tag === TAG_NAME) {
      next.push({
        tag: TAG_NAME,
        data: buildNameTable(keepWindowsNames(parseNameTable(table.data))),
      })
    } else {
      next.push({ tag: table.tag, data: table.data })
    }
  }
  return writeSfnt(flavor, next)
}
