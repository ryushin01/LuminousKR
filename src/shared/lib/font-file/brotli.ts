/**
 * WOFF2에 쓰는 brotli 압축. WASM 압축기(brotli-wasm, 약 1 MB)를 WOFF2를 처음 만들 때 한 번 받아 씁니다
 * (첫 화면 전송량에는 들지 않음). 브라우저 내장 CompressionStream('brotli')은 품질을 정할 수 없어(Chromium에는
 * 아예 없음) 쓰지 않습니다. 그래서 어느 브라우저에서나 같은 파일이 나옵니다.
 *
 * 품질 9: 11,172자 OTF(3.8 MB)에서 147 KB로, 품질 11(127 KB)보다 15% 크지만 100배쯤 빠릅니다
 * (Node 기준 0.1초 vs 13초. WASM은 더 느려 품질 11은 수십 초가 걸림). WOFF(zlib, 214 KB)보다 32% 작습니다.
 */
import { markWorkerRestart } from '@/shared/lib/worker-rpc'

export const BROTLI_QUALITY = 9

type BrotliModule = { compress(data: Uint8Array, options?: { quality?: number }): Uint8Array }

/**
 * 압축기를 처음 쓸 때 load로 받아 두고 다시 씁니다.
 * 받지 못하면 앱 파일 오류(ChunkLoadError, 새 버전 안내)로 실패하고 워커를 새로 띄우라고 표시합니다.
 * brotli-wasm은 초기화 Promise를 모듈을 처음 평가할 때 한 번만 만들어, 같은 워커에서는 다시 불러도 같은 실패가
 * 돌아오기 때문입니다(새 워커에서 모듈부터 다시 받아야 함).
 */
export function createBrotliCompressor(load: () => Promise<BrotliModule>) {
  let loading: Promise<BrotliModule> | undefined
  return async function compress(data: Uint8Array): Promise<Uint8Array> {
    loading ??= load()
    let brotli: BrotliModule
    try {
      brotli = await loading
    } catch (cause) {
      const error = new Error('WOFF2 압축기(WASM)를 받지 못했습니다.', { cause })
      error.name = 'ChunkLoadError'
      throw markWorkerRestart(error)
    }
    return brotli.compress(data, { quality: BROTLI_QUALITY })
  }
}

export const brotliCompress = createBrotliCompressor(() =>
  import('brotli-wasm').then((module) => module.default as Promise<BrotliModule>),
)
