import { render, screen } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { UpdateNoticeView } from './UpdateNotice.tsx'

describe('UpdateNoticeView', () => {
  it('평소에는 빈 경고 영역만 DOM에 둡니다', () => {
    render(() => (
      <UpdateNoticeView
        failed={false}
        blocked={false}
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
      <UpdateNoticeView failed blocked={false} onReload={onReload} onForceReload={() => {}} />
    ))
    expect(screen.getByRole('alert')).toHaveTextContent(
      '새 버전이 나왔거나 연결이 끊겼을 수 있습니다',
    )
    await user.click(screen.getByRole('button', { name: '새로 고침' }))
    expect(onReload).toHaveBeenCalledOnce()
  })

  it('저장하지 못한 변경이 있어 새로 고치지 않았으면 알리고, 변경을 버리고 새로 고칠 수 있게 합니다', async () => {
    const user = userEvent.setup()
    const onForceReload = vi.fn()
    render(() => (
      <UpdateNoticeView failed blocked onReload={() => {}} onForceReload={onForceReload} />
    ))
    expect(screen.getByRole('alert')).toHaveTextContent(
      '자동 저장하지 못한 변경이 있어 새로 고치지 않았습니다',
    )
    expect(screen.queryByRole('button', { name: '새로 고침' })).toBeNull()
    await user.click(screen.getByRole('button', { name: '변경을 버리고 새로 고침' }))
    expect(onForceReload).toHaveBeenCalledOnce()
  })
})
