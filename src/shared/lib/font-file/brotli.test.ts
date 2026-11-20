// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { BROTLI_QUALITY, createBrotliCompressor } from './brotli.ts'

describe('WOFF2용 brotli 압축기', () => {
  it('WASM을 받지 못하면 앱 파일 오류(ChunkLoadError)로, 워커를 새로 띄우라는 표시와 함께 실패합니다', async () => {
    const compress = createBrotliCompressor(() => Promise.reject(new TypeError('Failed to fetch')))
    const failure = await compress(new Uint8Array([1, 2, 3])).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(Error)
    expect(failure).toMatchObject({ name: 'ChunkLoadError', restartWorker: true })
  })

  it('한 번 받은 압축기는 다시 받지 않고, 품질 9로 압축합니다', async () => {
    const compressed = new Uint8Array([9])
    const module = { compress: vi.fn(() => compressed) }
    const load = vi.fn(async () => module)
    const compress = createBrotliCompressor(load)
    const input = new Uint8Array([1, 2, 3])
    expect(await compress(input)).toBe(compressed)
    await compress(input)
    expect(load).toHaveBeenCalledTimes(1)
    expect(module.compress).toHaveBeenCalledWith(input, { quality: 9 })
    expect(BROTLI_QUALITY).toBe(9)
  })
})
