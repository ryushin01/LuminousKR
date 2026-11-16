import { render, screen } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assetLoadFailed, resetAssetLoadFailureForTest } from '@/shared/lib/app-update'
import { RouteError } from './RouteError.tsx'

const font = vi.hoisted(() => ({
  flushProjectSave: vi.fn(() => true),
  inPlaceUnreadableOnlyHere: vi.fn(() => false),
}))
vi.mock('@/entities/font', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  ...font,
}))

describe('RouteError', () => {
  afterEach(() => {
    resetAssetLoadFailureForTest()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    font.flushProjectSave.mockReturnValue(true)
    font.inPlaceUnreadableOnlyHere.mockReturnValue(false)
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

  it('저장하지 못한 변경이 있으면 새로 고치지 않고 알리며, 버리고 새로 고칠 수 있게 합니다', async () => {
    const user = userEvent.setup()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const reload = vi.fn()
    vi.stubGlobal('location', { ...location, reload })
    font.flushProjectSave.mockReturnValue(false)
    render(() => <RouteError error={new Error('x')} reset={() => {}} />)
    expect(screen.getByRole('alert')).toBeEmptyDOMElement()
    await user.click(screen.getByRole('button', { name: '새로 고침' }))
    expect(reload).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('자동 저장하지 못한 변경이 있어')
    await user.click(screen.getByRole('button', { name: '변경을 버리고 새로 고침' }))
    expect(reload).toHaveBeenCalledOnce()
  })

  it('이 탭에만 남은 원래 작업이 있으면 새로 고치지 않고 받아 두라고 알립니다', async () => {
    const user = userEvent.setup()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const reload = vi.fn()
    vi.stubGlobal('location', { ...location, reload })
    font.inPlaceUnreadableOnlyHere.mockReturnValue(true)
    render(() => <RouteError error={new Error('x')} reset={() => {}} />)
    await user.click(screen.getByRole('button', { name: '새로 고침' }))
    expect(reload).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      "이 탭에만 남은 원래 작업(열지 못하고 보관하지도 못한 저장)이 있어 새로 고치지 않았습니다. 화면 아래 안내의 '원래 작업 받기'로",
    )
    await user.click(screen.getByRole('button', { name: '원래 작업을 버리고 새로 고침' }))
    expect(reload).toHaveBeenCalledOnce()
  })

  it('버리기로 한 뒤 저장하지 못한 변경이 새로 생겼으면, 버리지 않고 늘어난 까닭을 알려 다시 확인받습니다', async () => {
    const user = userEvent.setup()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const reload = vi.fn()
    vi.stubGlobal('location', { ...location, reload })
    font.inPlaceUnreadableOnlyHere.mockReturnValue(true)
    render(() => <RouteError error={new Error('x')} reset={() => {}} />)
    await user.click(screen.getByRole('button', { name: '새로 고침' }))
    font.flushProjectSave.mockReturnValue(false)
    await user.click(screen.getByRole('button', { name: '원래 작업을 버리고 새로 고침' }))
    expect(reload).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      '자동 저장하지 못한 변경과 이 탭에만 남은 원래 작업',
    )
    await user.click(screen.getByRole('button', { name: '모두 버리고 새로 고침' }))
    expect(reload).toHaveBeenCalledOnce()
  })
})
