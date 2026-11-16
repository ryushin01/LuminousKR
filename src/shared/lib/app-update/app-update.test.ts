import { describe, expect, it } from 'vitest'
import { WorkerLoadError } from '../worker-rpc/index.ts'
import {
  assetLoadFailed,
  isAssetLoadError,
  reportAssetLoadFailure,
  resetAssetLoadFailureForTest,
} from './index.ts'

describe('앱 파일 받기 실패', () => {
  it('브라우저마다 다른 조각 받기 실패와 워커 받기 실패를 알아봅니다', () => {
    const messages = [
      'Failed to fetch dynamically imported module: https://x/assets/studio-1.js', // Chromium
      'Importing a module script failed.', // Safari
      'error loading dynamically imported module: https://x/assets/a.js', // Firefox
      'Unable to preload CSS for /assets/studio-1.css', // Vite
    ]
    for (const message of messages) expect(isAssetLoadError(new TypeError(message))).toBe(true)
    expect(isAssetLoadError(new WorkerLoadError())).toBe(true)
    expect(isAssetLoadError(new Error('글리프를 만들지 못했습니다'))).toBe(false)
    expect(isAssetLoadError('Failed to fetch dynamically imported module')).toBe(false)
  })

  it('한 번 알리면 새로 고칠 때까지 남습니다', () => {
    resetAssetLoadFailureForTest()
    expect(assetLoadFailed()).toBe(false)
    reportAssetLoadFailure()
    expect(assetLoadFailed()).toBe(true)
    resetAssetLoadFailureForTest()
  })
})
