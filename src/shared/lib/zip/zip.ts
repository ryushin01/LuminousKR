/**
 * 작은 ZIP 작성기 (PKWARE APPNOTE 형식, 외부 라이브러리 없음).
 * 파일마다 deflate(웹 표준 CompressionStream('deflate-raw'))로 줄이고, 줄지 않으면 그대로(저장) 넣습니다.
 * 파일 이름은 UTF-8(일반 목적 비트 11)로 씁니다.
 */

export type ZipEntry = { name: string; data: Uint8Array }

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

/** CRC-32 (ZIP·PNG와 같은 다항식) */
export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** ZIP 안의 시각(MS-DOS 형식) */
function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear())
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  }
}

const METHOD_STORE = 0
const METHOD_DEFLATE = 8
const FLAG_UTF8 = 1 << 11

/** 파일들을 ZIP 하나로 묶습니다. */
export async function createZip(
  entries: readonly ZipEntry[],
  modified: Date = new Date(),
): Promise<Uint8Array> {
  const encoder = new TextEncoder()
  const stamp = dosDateTime(modified)
  const prepared = await Promise.all(
    entries.map(async (entry) => {
      const name = encoder.encode(entry.name)
      const packed = await deflateRaw(entry.data)
      const deflated = packed.length < entry.data.length
      return {
        name,
        crc: crc32(entry.data),
        size: entry.data.length,
        method: deflated ? METHOD_DEFLATE : METHOD_STORE,
        body: deflated ? packed : entry.data,
      }
    }),
  )

  const localSize = prepared.reduce((sum, e) => sum + 30 + e.name.length + e.body.length, 0)
  const centralSize = prepared.reduce((sum, e) => sum + 46 + e.name.length, 0)
  const out = new Uint8Array(localSize + centralSize + 22)
  const view = new DataView(out.buffer)
  let at = 0
  const offsets: number[] = []

  for (const e of prepared) {
    offsets.push(at)
    view.setUint32(at, 0x04034b50, true)
    view.setUint16(at + 4, 20, true) // 풀 때 필요한 판
    view.setUint16(at + 6, FLAG_UTF8, true)
    view.setUint16(at + 8, e.method, true)
    view.setUint16(at + 10, stamp.time, true)
    view.setUint16(at + 12, stamp.date, true)
    view.setUint32(at + 14, e.crc, true)
    view.setUint32(at + 18, e.body.length, true)
    view.setUint32(at + 22, e.size, true)
    view.setUint16(at + 26, e.name.length, true)
    view.setUint16(at + 28, 0, true)
    out.set(e.name, at + 30)
    out.set(e.body, at + 30 + e.name.length)
    at += 30 + e.name.length + e.body.length
  }

  const centralStart = at
  prepared.forEach((e, i) => {
    view.setUint32(at, 0x02014b50, true)
    view.setUint16(at + 4, 20, true) // 만든 판
    view.setUint16(at + 6, 20, true) // 풀 때 필요한 판
    view.setUint16(at + 8, FLAG_UTF8, true)
    view.setUint16(at + 10, e.method, true)
    view.setUint16(at + 12, stamp.time, true)
    view.setUint16(at + 14, stamp.date, true)
    view.setUint32(at + 16, e.crc, true)
    view.setUint32(at + 20, e.body.length, true)
    view.setUint32(at + 24, e.size, true)
    view.setUint16(at + 28, e.name.length, true)
    // 덧붙임·주석 길이, 디스크 번호, 내부·외부 속성은 0
    view.setUint32(at + 42, offsets[i]!, true)
    out.set(e.name, at + 46)
    at += 46 + e.name.length
  })

  view.setUint32(at, 0x06054b50, true)
  view.setUint16(at + 8, prepared.length, true)
  view.setUint16(at + 10, prepared.length, true)
  view.setUint32(at + 12, at - centralStart, true)
  view.setUint32(at + 16, centralStart, true)
  return out
}
