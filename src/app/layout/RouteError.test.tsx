import { render, screen } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assetLoadFailed, resetAssetLoadFailureForTest } from '@/shared/lib/app-update'
import { RouteError } from './RouteError.tsx'

describe('RouteError', () => {
  afterEach(() => {
    resetAssetLoadFailureForTest()
    vi.restoreAllMocks()
  })

  it('화면 조각을 받지 못했으면 새로 고침만 안내하고 앱 전체에 알립니다', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(() => (
      <RouteError
        error={new TypeError('Failed to fetch dynamically imported module: /assets/studio.js')}
        reset={() => {}}
      />
    ))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      '화면을 불러오지 못했습니다',
    )
    expect(screen.getByRole('button', { name: '새로 고침' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull()
    expect(assetLoadFailed()).toBe(true)
  })

  it('그 밖의 오류는 다시 시도할 수 있고, 원인은 콘솔에 남깁니다', async () => {
    const user = userEvent.setup()
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const reset = vi.fn()
    const error = new Error('글리프 계산 오류')
    render(() => <RouteError error={error} reset={reset} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      '화면을 그리다 문제가 생겼습니다',
    )
    await user.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(reset).toHaveBeenCalledOnce()
    expect(logged).toHaveBeenCalledWith(error)
    expect(assetLoadFailed()).toBe(false)
  })
})
