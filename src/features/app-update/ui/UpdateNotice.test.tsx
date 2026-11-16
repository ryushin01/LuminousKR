import { render, screen } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UpdateNoticeView, reloadApp } from './UpdateNotice.tsx'

const font = vi.hoisted(() => ({
  flushProjectSave: vi.fn(() => true),
  inPlaceUnreadableState: vi.fn((): 'paused' | 'memory' | null => null),
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
    font.inPlaceUnreadableState.mockReturnValue(null)
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

  it('원래 작업이 원래 자리에 있으면(자동 저장을 멈춘 상태) 새로 고쳐도 잃지 않으므로 막지 않습니다', () => {
    const reload = stubReload()
    font.inPlaceUnreadableState.mockReturnValue('paused')
    expect(reloadApp()).toBeNull()
    expect(reload).toHaveBeenCalledOnce()
  })

  it.each([
    { saved: false, inPlace: null, block: 'changes' },
    { saved: true, inPlace: 'memory', block: 'unreadable' },
    { saved: false, inPlace: 'memory', block: 'both' },
  ] as const)(
    '잃을 것($block)이 있으면 새로 고치지 않고 까닭을 돌려주며, force면 버리고 새로 고칩니다',
    ({ saved, inPlace, block }) => {
      const reload = stubReload()
      font.flushProjectSave.mockReturnValue(saved)
      font.inPlaceUnreadableState.mockReturnValue(inPlace)
      expect(reloadApp()).toBe(block)
      expect(reload).not.toHaveBeenCalled()
      expect(reloadApp(true)).toBeNull()
      expect(reload).toHaveBeenCalledOnce()
    },
  )
})
