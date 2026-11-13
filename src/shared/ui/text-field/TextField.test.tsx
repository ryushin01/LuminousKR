import { render, screen } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TextField } from './TextField.tsx'

describe('TextField', () => {
  it('레이블과 입력칸이 연결되고, 입력한 값을 넘깁니다', async () => {
    const user = userEvent.setup()
    const onInput = vi.fn()
    render(() => <TextField label="글꼴 이름" value="" onInput={onInput} hint="영문으로" />)
    const input = screen.getByRole('textbox', { name: '글꼴 이름' })
    expect(input).toHaveAccessibleDescription('영문으로')
    await user.type(input, 'L')
    expect(onInput).toHaveBeenCalledWith('L')
  })

  it('오류가 없으면 aria-invalid를 붙이지 않습니다', () => {
    render(() => <TextField label="버전" value="" onInput={() => {}} />)
    expect(screen.getByRole('textbox', { name: '버전' })).not.toHaveAttribute('aria-invalid')
  })

  it('오류가 있으면 aria-invalid와 설명·오류 메시지 연결을 함께 둡니다', () => {
    render(() => (
      <TextField
        label="버전"
        value="v1"
        onInput={() => {}}
        hint="예: 1.000"
        error="숫자로 입력해 주세요."
      />
    ))
    const input = screen.getByRole('textbox', { name: '버전' })
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('예: 1.000 숫자로 입력해 주세요.')
    expect(input).toHaveAccessibleErrorMessage('숫자로 입력해 주세요.')
  })

  it('필수 칸은 레이블에 (필수)를 보여 줍니다', () => {
    render(() => <TextField label="스타일 이름" required value="" onInput={() => {}} />)
    // jsdom의 접근 이름 계산은 인라인 요소 앞 빈칸을 줄이므로 빈칸 유무와 관계없이 찾습니다.
    expect(screen.getByRole('textbox', { name: /^스타일 이름\s?\(필수\)$/ })).toBeRequired()
  })
})
