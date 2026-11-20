/**
 * WOFF2에 쓰는 brotli 압축. WASM 압축기(brotli-wasm, 약 1 MB)를 WOFF2를 처음 만들 때 한 번 받아 씁니다
 * (첫 화면 전송량에는 들지 않음). 브라우저 내장 CompressionStream('brotli')은 품질을 정할 수 없어(Chromium에는
 * 아예 없음) 쓰지 않습니다. 그래서 어느 브라우저에서나 같은 파일이 나옵니다.
 *
 * 품질 9: 11,172자 OTF(3.8 MB)에서 147 KB로, 품질 11(127 KB)보다 15% 크지만 100배쯤 빠릅니다
 * (Node 기준 0.1초 vs 13초. WASM은 더 느려 품질 11은 수십 초가 걸림). WOFF(zlib, 214 KB)보다 32% 작습니다.
 */
export const BROTLI_QUALITY = 9

type BrotliModule = { compress(data: Uint8Array, options?: { quality?: number }): Uint8Array }

let loading: Promise<BrotliModule> | undefined

export async function brotliCompress(data: Uint8Array): Promise<Uint8Array> {
  loading ??= import('brotli-wasm')
    .then((module) => module.default as Promise<BrotliModule>)
    .catch((error: unknown) => {
      // 받지 못했으면(배포 뒤 열린 탭 등) 다음에 다시 받아 보도록 비웁니다.
      loading = undefined
      throw error
    })
  const brotli = await loading
  return brotli.compress(data, { quality: BROTLI_QUALITY })
}
