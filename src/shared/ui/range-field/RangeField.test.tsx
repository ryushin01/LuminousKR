import { render, screen } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { RangeField } from './RangeField.tsx'

function Example(props: { onInput: (value: number) => void; disabled?: boolean }) {
  const [value, setValue] = createSignal(76)
  return (
    <RangeField
      label="굵기"
      value={value()}
      min={30}
      max={180}
      disabled={props.disabled}
      onInput={(v) => {
        setValue(v)
        props.onInput(v)
      }}
      format={(v) => `${v} 단위`}
      hint="세로획 굵기입니다."
    />
  )
}

describe('RangeField (Ark UI 슬라이더)', () => {
  it('레이블·값 글자(aria-valuetext)·도움말을 알립니다', () => {
    render(() => <Example onInput={vi.fn()} />)
    const slider = screen.getByRole('slider', { name: '굵기' })
    expect(slider).toHaveAttribute('aria-valuenow', '76')
    expect(slider).toHaveAttribute('aria-valuemin', '30')
    expect(slider).toHaveAttribute('aria-valuemax', '180')
    expect(slider).toHaveAttribute('aria-valuetext', '76 단위')
    expect(slider).toHaveAccessibleDescription('세로획 굵기입니다.')
    expect(screen.getByText('76 단위')).toBeVisible()
  })

  it('Tab으로 손잡이에 가서 화살표·PageUp·Home·End로 값을 옮기고 숫자로 넘깁니다', async () => {
    const user = userEvent.setup()
    const onInput = vi.fn()
    render(() => <Example onInput={onInput} />)
    await user.tab()
    const slider = screen.getByRole('slider', { name: '굵기' })
    expect(slider).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(onInput).toHaveBeenLastCalledWith(77)
    expect(slider).toHaveAttribute('aria-valuetext', '77 단위')
    // PageUp은 큰 칸(한 칸의 10배)만큼 올리고 그 큰 칸의 눈금에 맞춥니다.
    await user.keyboard('{PageUp}')
    expect(onInput).toHaveBeenLastCalledWith(90)
    await user.keyboard('{End}')
    expect(onInput).toHaveBeenLastCalledWith(180)
    await user.keyboard('{Home}')
    expect(onInput).toHaveBeenLastCalledWith(30)
  })

  it('끄면 Tab 순서에서 빠지고 값이 바뀌지 않습니다', async () => {
    const user = userEvent.setup()
    const onInput = vi.fn()
    render(() => <Example onInput={onInput} disabled />)
    const slider = screen.getByRole('slider', { name: '굵기' })
    expect(slider).toHaveAttribute('aria-disabled', 'true')
    await user.tab()
    expect(slider).not.toHaveFocus()
    expect(onInput).not.toHaveBeenCalled()
  })
})
