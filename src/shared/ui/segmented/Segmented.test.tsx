import { render, screen } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { Segmented } from './Segmented.tsx'

type Cap = 'round' | 'square' | 'butt'

function Example(props: { onChange: (value: Cap) => void; disabled?: boolean }) {
  const [value, setValue] = createSignal<Cap>('round')
  return (
    <Segmented
      legend="획 끝 모양"
      value={value()}
      disabled={props.disabled}
      onChange={(v) => {
        setValue(v)
        props.onChange(v)
      }}
      options={[
        { value: 'round', label: '둥근 끝' },
        { value: 'square', label: '각진 끝' },
        { value: 'butt', label: <span>✂</span>, accessibleLabel: '잘린 끝' },
      ]}
    />
  )
}

describe('Segmented (Ark UI SegmentGroup)', () => {
  it('범례로 이름 붙은 라디오 묶음이고, 아이콘 항목은 접근 이름을 씁니다', () => {
    render(() => <Example onChange={vi.fn()} />)
    expect(screen.getByRole('radiogroup', { name: '획 끝 모양' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '둥근 끝' })).toBeChecked()
    expect(screen.getByRole('radio', { name: '잘린 끝' })).not.toBeChecked()
  })

  it('누르거나 화살표 키로 고릅니다', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(() => <Example onChange={onChange} />)
    await user.click(screen.getByText('각진 끝'))
    expect(onChange).toHaveBeenLastCalledWith('square')
    expect(screen.getByRole('radio', { name: '각진 끝' })).toBeChecked()
    await user.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith('butt')
    expect(screen.getByRole('radio', { name: '잘린 끝' })).toBeChecked()
  })

  it('끄면 고를 수 없습니다', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(() => <Example onChange={onChange} disabled />)
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled()
    await user.click(screen.getByText('각진 끝'))
    expect(onChange).not.toHaveBeenCalled()
  })
})
