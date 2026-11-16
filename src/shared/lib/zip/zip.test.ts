// @vitest-environment node
import { inflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { crc32, createZip } from './zip.ts'

/** 중앙 디렉터리를 읽어 파일 이름과 내용(풀어서)을 돌려줍니다. */
function readZip(zip: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
  const end = zip.length - 22
  expect(view.getUint32(end, true)).toBe(0x06054b50)
  const count = view.getUint16(end + 10, true)
  let at = view.getUint32(end + 16, true)
  const files = new Map<string, Uint8Array>()
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50)
    const method = view.getUint16(at + 10, true)
    const crc = view.getUint32(at + 16, true)
    const packedSize = view.getUint32(at + 20, true)
    const nameLength = view.getUint16(at + 28, true)
    const local = view.getUint32(at + 42, true)
    const name = new TextDecoder().decode(zip.subarray(at + 46, at + 46 + nameLength))
    const localName = view.getUint16(local + 26, true)
    const body = zip.subarray(local + 30 + localName, local + 30 + localName + packedSize)
    const data = method === 8 ? new Uint8Array(inflateRawSync(body)) : body
    expect(crc32(data)).toBe(crc)
    files.set(name, data)
    at += 46 + nameLength
  }
  return files
}

describe('ZIP 작성기', () => {
  it('CRC-32가 표준 값과 같습니다', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
    expect(crc32(new Uint8Array())).toBe(0)
  })

  it('줄어드는 파일은 deflate로, 아니면 그대로 넣고 한글 이름을 UTF-8로 씁니다', async () => {
    const repeated = new TextEncoder().encode('빛나는한글 '.repeat(2000))
    const random = new Uint8Array(64).map((_, i) => (i * 97 + 13) % 251)
    const zip = await createZip([
      { name: '루미너스 모듈-Bold.otf', data: repeated },
      { name: 'noise.bin', data: random },
    ])
    const files = readZip(zip)
    expect([...files.keys()]).toEqual(['루미너스 모듈-Bold.otf', 'noise.bin'])
    expect(files.get('루미너스 모듈-Bold.otf')).toEqual(repeated)
    expect(files.get('noise.bin')).toEqual(random)
    expect(zip.length).toBeLessThan(repeated.length / 10)
    // 일반 목적 비트 11(UTF-8 이름)
    expect(new DataView(zip.buffer).getUint16(6, true) & (1 << 11)).toBeTruthy()
  })
})
