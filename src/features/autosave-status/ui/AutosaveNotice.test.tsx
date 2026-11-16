import { render, screen } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AutosaveNotice, type AutosaveNoticeProps } from './AutosaveNotice.tsx'

const base: AutosaveNoticeProps = {
  synced: false,
  failure: null,
  keptCount: 0,
  inPlace: null,
  pausedByOtherTab: false,
  onDownloadKept: () => {},
  onDiscardKept: () => {},
  onDownloadInPlace: () => {},
  onDiscardInPlace: () => {},
  onReload: () => {},
}

describe('AutosaveNotice', () => {
  afterEach(() => vi.restoreAllMocks())

  it('알림이 없어도 상태·경고 영역은 처음부터 비어 있는 채로 DOM에 있습니다', () => {
    render(() => <AutosaveNotice {...base} />)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(screen.getByRole('alert')).toBeEmptyDOMElement()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('다른 탭에서 불러온 것은 상태로, 저장 실패는 경고로 원인과 할 일을 알립니다', () => {
    render(() => <AutosaveNotice {...base} synced failure="quota" />)
    expect(screen.getByRole('status')).toHaveTextContent('다른 탭에서 바뀐 작업을 불러왔습니다')
    expect(screen.getByRole('alert')).toHaveTextContent('저장 공간이 가득 찼습니다')
    expect(screen.getByRole('alert')).toHaveTextContent('프로젝트 파일(.json)로 저장해 두세요')
  })

  it('보관한 원문은 하나씩 받고(여럿이면 번호), 한꺼번에 지울 수 있습니다', async () => {
    const user = userEvent.setup()
    const onDownloadKept = vi.fn()
    const onDiscardKept = vi.fn()
    render(() => (
      <AutosaveNotice
        {...base}
        keptCount={2}
        onDownloadKept={onDownloadKept}
        onDiscardKept={onDiscardKept}
      />
    ))
    expect(screen.getByRole('alert')).toHaveTextContent('따로 보관했으니 받아 두세요')
    await user.click(screen.getByRole('button', { name: '보관한 작업 2 받기' }))
    expect(onDownloadKept).toHaveBeenCalledWith(1)
    await user.click(screen.getByRole('button', { name: '보관한 작업 지우기' }))
    expect(onDiscardKept).toHaveBeenCalledOnce()
  })

  it('보관하지 못한 원문은 받기와 버리기를 따로 두고, 버려야 저장을 다시 켠다고 알립니다', async () => {
    const user = userEvent.setup()
    const onDownloadInPlace = vi.fn()
    const onDiscardInPlace = vi.fn()
    render(() => (
      <AutosaveNotice
        {...base}
        inPlace="paused"
        onDownloadInPlace={onDownloadInPlace}
        onDiscardInPlace={onDiscardInPlace}
      />
    ))
    expect(screen.getByRole('alert')).toHaveTextContent(
      "'원래 작업 버리기'를 누르면 다시 저장합니다",
    )
    await user.click(screen.getByRole('button', { name: '원래 작업 받기' }))
    expect(onDownloadInPlace).toHaveBeenCalledOnce()
    expect(onDiscardInPlace).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '원래 작업 버리기' }))
    expect(onDiscardInPlace).toHaveBeenCalledOnce()
  })

  it('보관하지 못한 원문을 다른 탭이 덮어썼으면, 이 탭을 닫으면 사라진다고 알립니다', () => {
    render(() => <AutosaveNotice {...base} inPlace="memory" />)
    expect(screen.getByRole('alert')).toHaveTextContent('이 탭을 닫으면 사라지니')
    expect(screen.getByRole('alert')).not.toHaveTextContent('자동 저장을 멈췄습니다')
  })

  it('다른 탭이 읽지 못하는 형식으로 저장하면 덮어쓰지 않으려고 멈췄다고 알리고 새로 고침을 줍니다', async () => {
    const user = userEvent.setup()
    const onReload = vi.fn()
    render(() => <AutosaveNotice {...base} pausedByOtherTab onReload={onReload} />)
    expect(screen.getByRole('alert')).toHaveTextContent('이 탭의 자동 저장을 멈췄습니다')
    await user.click(screen.getByRole('button', { name: '새로 고침' }))
    expect(onReload).toHaveBeenCalledOnce()
  })
})
