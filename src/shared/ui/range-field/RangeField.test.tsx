import { fireEvent, render, screen } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'
import { RangeField } from './RangeField.tsx'

describe('RangeField', () => {
  it('레이블·값 글자(aria-valuetext)를 알리고 숫자로 넘깁니다', () => {
    const onInput = vi.fn()
    render(() => (
      <RangeField
        label="굵기"
        value={76}
        min={30}
        max={180}
        onInput={onInput}
        format={(v) => `${v} 단위`}
      />
    ))
    const slider = screen.getByRole('slider', { name: '굵기' })
    expect(slider).toHaveAttribute('aria-valuetext', '76 단위')
    fireEvent.input(slider, { target: { value: '90' } })
    expect(onInput).toHaveBeenCalledWith(90)
  })
})
