import { render, screen } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UpdateNoticeView, reloadApp } from './UpdateNotice.tsx'

const font = vi.hoisted(() => ({
  flushProjectSave: vi.fn(() => true),
  inPlaceUnreadableOnlyHere: vi.fn(() => false),
}))
vi.mock('@/entities/font', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  ...font,
}))

describe('UpdateNoticeView', () => {
  it('평소에는 빈 경고 영역만 DOM에 둡니다', () => {
    render(() => (
      <UpdateNoticeView
        failed={false}
        blocked={null}
        onReload={() => {}}
        onForceReload={() => {}}
      />
    ))
    expect(screen.getByRole('alert')).toBeEmptyDOMElement()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('앱 파일을 받지 못하면 까닭과 새로 고침 버튼을 보여 줍니다', async () => {
    const user = userEvent.setup()
    const onReload = vi.fn()
    render(() => (
      <UpdateNoticeView failed blocked={null} onReload={onReload} onForceReload={() => {}} />
    ))
    expect(screen.getByRole('alert')).toHaveTextContent(
      '새 버전이 나왔거나 연결이 끊겼을 수 있습니다',
    )
    await user.click(screen.getByRole('button', { name: '새로 고침' }))
    expect(onReload).toHaveBeenCalledOnce()
  })

  it.each([
    ['changes', '자동 저장하지 못한 변경이 있어 새로 고치지 않았습니다', '변경을 버리고 새로 고침'],
    ['unreadable', '이 탭에만 남은 원래 작업', '원래 작업을 버리고 새로 고침'],
    ['both', '자동 저장하지 못한 변경과 이 탭에만 남은 원래 작업', '모두 버리고 새로 고침'],
  ] as const)(
    '새로 고치면 잃는 것(%s)이 있어 새로 고치지 않았으면 알리고, 버리고 새로 고칠 수 있게 합니다',
    async (block, text, discard) => {
      const user = userEvent.setup()
      const onForceReload = vi.fn()
      render(() => (
        <UpdateNoticeView
          failed
          blocked={block}
          onReload={() => {}}
          onForceReload={onForceReload}
        />
      ))
      expect(screen.getByRole('alert')).toHaveTextContent(text)
      expect(screen.queryByRole('button', { name: '새로 고침' })).toBeNull()
      await user.click(screen.getByRole('button', { name: discard }))
      expect(onForceReload).toHaveBeenCalledOnce()
    },
  )
})

describe('reloadApp', () => {
  afterEach(() => {
    font.flushProjectSave.mockReturnValue(true)
    font.inPlaceUnreadableOnlyHere.mockReturnValue(false)
    vi.unstubAllGlobals()
  })

  const stubReload = () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { ...location, reload })
    return reload
  }

  it('기다리던 저장을 쓰고 잃을 것이 없으면 새로 고칩니다', () => {
    const reload = stubReload()
    expect(reloadApp()).toBeNull()
    expect(font.flushProjectSave).toHaveBeenCalled()
    expect(reload).toHaveBeenCalledOnce()
  })

  it.each([
    { saved: false, onlyHere: false, loss: 'changes' },
    { saved: true, onlyHere: true, loss: 'unreadable' },
    { saved: false, onlyHere: true, loss: 'both' },
  ] as const)(
    '잃을 것($loss)이 있으면 새로 고치지 않고 까닭을 돌려주며, 그 까닭을 버리기로 하면 새로 고칩니다',
    ({ saved, onlyHere, loss }) => {
      const reload = stubReload()
      font.flushProjectSave.mockReturnValue(saved)
      font.inPlaceUnreadableOnlyHere.mockReturnValue(onlyHere)
      expect(reloadApp()).toBe(loss)
      expect(reload).not.toHaveBeenCalled()
      expect(reloadApp(loss)).toBeNull()
      expect(reload).toHaveBeenCalledOnce()
    },
  )

  it('버리기로 한 뒤 새로 생긴 잃을 것은 버리지 않고 늘어난 까닭으로 다시 확인받습니다', () => {
    const reload = stubReload()
    font.inPlaceUnreadableOnlyHere.mockReturnValue(true)
    expect(reloadApp()).toBe('unreadable')
    // 알린 뒤 편집을 이어 가다 저장에 실패함
    font.flushProjectSave.mockReturnValue(false)
    expect(reloadApp('unreadable')).toBe('both')
    expect(reload).not.toHaveBeenCalled()
    expect(reloadApp('both')).toBeNull()
    expect(reload).toHaveBeenCalledOnce()
  })

  it('버리기로 한 것보다 잃을 것이 줄었으면(저장됨) 그대로 새로 고칩니다', () => {
    const reload = stubReload()
    expect(reloadApp('changes')).toBeNull()
    expect(reload).toHaveBeenCalledOnce()
  })
})
