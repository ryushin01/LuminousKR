import { render, screen, waitFor } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { createSignal } from 'solid-js'
import { describe, expect, it } from 'vitest'
import { Tabs } from './Tabs.tsx'

function Example() {
  const [selected, setSelected] = createSignal<'a' | 'b' | 'c'>('a')
  return (
    <Tabs
      label="자모 갈래"
      selected={selected()}
      onSelect={setSelected}
      items={[
        { id: 'a', label: '초성', panel: () => <p>초성 목록</p> },
        { id: 'b', label: '중성', panel: () => <p>중성 목록</p> },
        { id: 'c', label: '종성', panel: () => <p>종성 목록</p> },
      ]}
    />
  )
}

describe('Tabs (APG 탭)', () => {
  it('선택 상태를 true/false로 모두 밝히고 패널과 연결합니다', () => {
    render(() => <Example />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false'])
    const panel = screen.getByRole('tabpanel', { name: '초성' })
    expect(panel).toHaveAttribute('tabindex', '0')
    expect(tabs[0]).toHaveAttribute('aria-controls', panel.id)
    expect(screen.getByText('중성 목록').closest('[role="tabpanel"]')).not.toBeVisible()
  })

  // Ark(zag)는 다음 화면 그리기 때 초점·선택을 옮기므로 waitFor로 기다립니다.
  it('화살표·Home·End로 탭을 옮기고, 선택된 탭만 Tab 순서에 남깁니다', async () => {
    const user = userEvent.setup()
    render(() => <Example />)
    await user.tab()
    expect(screen.getByRole('tab', { name: '초성' })).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    await waitFor(() => expect(screen.getByRole('tab', { name: '중성' })).toHaveFocus())
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: '중성' })).toHaveAttribute('aria-selected', 'true'),
    )
    expect(screen.getByRole('tab', { name: '초성' })).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('tabpanel', { name: '중성' })).toBeVisible()
    await user.keyboard('{End}')
    await waitFor(() => expect(screen.getByRole('tab', { name: '종성' })).toHaveFocus())
    await user.keyboard('{ArrowRight}')
    await waitFor(() => expect(screen.getByRole('tab', { name: '초성' })).toHaveFocus())
    await user.keyboard('{Home}{ArrowLeft}')
    await waitFor(() => expect(screen.getByRole('tab', { name: '종성' })).toHaveFocus())
  })
})
