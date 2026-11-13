/**
 * sfnt(OTF/TTF) 파일을 WOFF 1.0으로 감쌉니다. (W3C WOFF File Format 1.0)
 * 표마다 zlib으로 압축하고, 압축해도 줄지 않는 표는 그대로 둡니다.
 * 압축은 웹 표준 CompressionStream('deflate' = zlib 형식)을 씁니다.
 */

const WOFF_SIGNATURE = 0x774f4646 // 'wOFF'
const WOFF_HEADER_SIZE = 44
const WOFF_DIRECTORY_ENTRY_SIZE = 20
const SFNT_HEADER_SIZE = 12
const SFNT_DIRECTORY_ENTRY_SIZE = 16

type SfntTable = { tag: number; checksum: number; data: Uint8Array }

export function readSfntTables(sfnt: ArrayBuffer): { flavor: number; tables: SfntTable[] } {
  const view = new DataView(sfnt)
  const flavor = view.getUint32(0)
  const numTables = view.getUint16(4)
  const tables: SfntTable[] = []
  for (let i = 0; i < numTables; i++) {
    const at = SFNT_HEADER_SIZE + i * SFNT_DIRECTORY_ENTRY_SIZE
    const offset = view.getUint32(at + 8)
    const length = view.getUint32(at + 12)
    tables.push({
      tag: view.getUint32(at),
      checksum: view.getUint32(at + 4),
      data: new Uint8Array(sfnt, offset, length),
    })
  }
  tables.sort((a, b) => a.tag - b.tag)
  return { flavor, tables }
}

type ByteTransform = {
  writable: WritableStream<BufferSource>
  readable: ReadableStream<Uint8Array>
}

async function pipeThrough(data: Uint8Array, transform: ByteTransform): Promise<Uint8Array> {
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(data)
      controller.close()
    },
  })
  // CompressionStream은 BufferSource를 받으므로 Uint8Array 스트림에 그대로 이어도 됩니다.
  const reader = source
    .pipeThrough(transform as unknown as ReadableWritablePair<Uint8Array, Uint8Array>)
    .getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    total += value.byteLength
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

export function zlibCompress(data: Uint8Array): Promise<Uint8Array> {
  return pipeThrough(data, new CompressionStream('deflate'))
}

export function zlibDecompress(data: Uint8Array): Promise<Uint8Array> {
  return pipeThrough(data, new DecompressionStream('deflate'))
}

const pad4 = (n: number) => (n + 3) & ~3

export async function sfntToWoff(
  sfnt: ArrayBuffer,
  version = { major: 1, minor: 0 },
): Promise<ArrayBuffer> {
  const { flavor, tables } = readSfntTables(sfnt)
  const compressed = await Promise.all(
    tables.map(async (table) => {
      const packed = await zlibCompress(table.data)
      return packed.byteLength < table.data.byteLength ? packed : table.data
    }),
  )

  let offset = WOFF_HEADER_SIZE + tables.length * WOFF_DIRECTORY_ENTRY_SIZE
  const offsets: number[] = []
  for (const data of compressed) {
    offsets.push(offset)
    offset += pad4(data.byteLength)
  }
  const totalLength = offset
  const totalSfntSize =
    SFNT_HEADER_SIZE +
    tables.length * SFNT_DIRECTORY_ENTRY_SIZE +
    tables.reduce((sum, t) => sum + pad4(t.data.byteLength), 0)

  const out = new ArrayBuffer(totalLength)
  const view = new DataView(out)
  const bytes = new Uint8Array(out)
  view.setUint32(0, WOFF_SIGNATURE)
  view.setUint32(4, flavor)
  view.setUint32(8, totalLength)
  view.setUint16(12, tables.length)
  view.setUint16(14, 0)
  view.setUint32(16, totalSfntSize)
  view.setUint16(20, version.major)
  view.setUint16(22, version.minor)
  // 메타데이터·비공개 블록 없음 (24~43은 0)

  tables.forEach((table, i) => {
    const at = WOFF_HEADER_SIZE + i * WOFF_DIRECTORY_ENTRY_SIZE
    const data = compressed[i]!
    view.setUint32(at, table.tag)
    view.setUint32(at + 4, offsets[i]!)
    view.setUint32(at + 8, data.byteLength)
    view.setUint32(at + 12, table.data.byteLength)
    view.setUint32(at + 16, table.checksum)
    bytes.set(data, offsets[i]!)
  })
  return out
}
