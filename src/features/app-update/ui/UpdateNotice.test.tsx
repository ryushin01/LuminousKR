import { render, screen } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { UpdateNoticeView } from './UpdateNotice.tsx'

describe('UpdateNoticeView', () => {
  it('평소에는 빈 경고 영역만 DOM에 둡니다', () => {
    render(() => <UpdateNoticeView failed={false} onReload={() => {}} />)
    expect(screen.getByRole('alert')).toBeEmptyDOMElement()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('앱 파일을 받지 못하면 까닭과 새로 고침 버튼을 보여 줍니다', async () => {
    const user = userEvent.setup()
    const onReload = vi.fn()
    render(() => <UpdateNoticeView failed onReload={onReload} />)
    expect(screen.getByRole('alert')).toHaveTextContent(
      '새 버전이 나왔거나 연결이 끊겼을 수 있습니다',
    )
    await user.click(screen.getByRole('button', { name: '새로 고침' }))
    expect(onReload).toHaveBeenCalledOnce()
  })
})
