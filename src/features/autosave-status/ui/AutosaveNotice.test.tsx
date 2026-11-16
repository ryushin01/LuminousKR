import { render, screen } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AutosaveNotice } from './AutosaveNotice.tsx'

describe('AutosaveNotice', () => {
  afterEach(() => vi.restoreAllMocks())

  it('알림이 없어도 상태·경고 영역은 처음부터 비어 있는 채로 DOM에 있습니다', () => {
    render(() => (
      <AutosaveNotice
        synced={false}
        failure={null}
        unreadable={null}
        onDownloadUnreadable={() => {}}
        onDiscardUnreadable={() => {}}
      />
    ))
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(screen.getByRole('alert')).toBeEmptyDOMElement()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('다른 탭에서 불러온 것은 상태로, 저장 실패는 경고로 원인과 할 일을 알립니다', () => {
    render(() => (
      <AutosaveNotice
        synced
        failure="quota"
        unreadable={null}
        onDownloadUnreadable={() => {}}
        onDiscardUnreadable={() => {}}
      />
    ))
    expect(screen.getByRole('status')).toHaveTextContent('다른 탭에서 바뀐 작업을 불러왔습니다')
    expect(screen.getByRole('alert')).toHaveTextContent('저장 공간이 가득 찼습니다')
    expect(screen.getByRole('alert')).toHaveTextContent('프로젝트 파일(.json)로 저장해 두세요')
  })

  it('읽지 못해 보관한 작업은 받거나 지울 수 있습니다', async () => {
    const user = userEvent.setup()
    const onDownload = vi.fn()
    const onDiscard = vi.fn()
    render(() => (
      <AutosaveNotice
        synced={false}
        failure={null}
        unreadable="kept"
        onDownloadUnreadable={onDownload}
        onDiscardUnreadable={onDiscard}
      />
    ))
    expect(screen.getByRole('alert')).toHaveTextContent('따로 보관했으니 받아 두세요')
    await user.click(screen.getByRole('button', { name: '보관한 작업 받기' }))
    expect(onDownload).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: '보관한 작업 지우기' }))
    expect(onDiscard).toHaveBeenCalledOnce()
  })

  it('보관하지 못한 원문은 자동 저장을 멈췄다고 알리고 받거나 버리게 합니다', () => {
    render(() => (
      <AutosaveNotice
        synced={false}
        failure={null}
        unreadable="unsaved"
        onDownloadUnreadable={() => {}}
        onDiscardUnreadable={() => {}}
      />
    ))
    expect(screen.getByRole('alert')).toHaveTextContent('받거나 버리기 전까지 자동 저장을 멈춥니다')
    expect(screen.getByRole('button', { name: '원래 작업 받기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '원래 작업 버리기' })).toBeInTheDocument()
  })
})
