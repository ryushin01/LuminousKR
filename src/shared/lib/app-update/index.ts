import { createSignal } from 'solid-js'

/**
 * 앱 파일(화면 조각·워커·CSS)을 받지 못한 일을 앱 전체에 알립니다.
 * GitHub Pages는 배포할 때 이전 파일을 남기지 않아, 배포 전에 연 탭이 아직 받지 않은 조각을 찾으면 404가 됩니다.
 * 연결이 끊겨도 같은 일이 생기며, 어느 쪽이든 새로 고치면 풀립니다.
 */
const [failed, setFailed] = createSignal(false)

/** 앱 파일을 받지 못한 적이 있는지 (새로 고칠 때까지 유지) */
export const assetLoadFailed = failed

export function reportAssetLoadFailure(): void {
  setFailed(true)
}

/** 브라우저마다 다른 '동적 조각을 받지 못함' 오류 문구 (Chromium, Safari, Firefox, Vite CSS 미리 받기) */
const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Failed to load module script/i

/** 앱 파일(화면 조각·워커)을 받지 못해 생긴 오류인지 */
export function isAssetLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  // WorkerLoadError: 워커 스크립트를 받지 못함(shared/lib/worker-rpc)
  return (
    error.name === 'WorkerLoadError' ||
    error.name === 'ChunkLoadError' ||
    CHUNK_ERROR.test(error.message)
  )
}

/** 테스트용: 알림 상태를 처음으로 */
export function resetAssetLoadFailureForTest(): void {
  setFailed(false)
}
