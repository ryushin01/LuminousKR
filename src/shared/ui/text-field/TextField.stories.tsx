import { createSignal } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { TextField } from './TextField.tsx'

const meta = {
  title: 'shared/TextField',
  component: TextField,
} satisfies Meta

export default meta
// 스토리 안에서 상태를 만들어 그리므로 속성(args)을 받지 않습니다.
type Story = StoryObj

export const Default: Story = {
  render: () => {
    const [value, setValue] = createSignal('Luminous Modular')
    return (
      <TextField
        label="글꼴 이름 (영문)"
        required
        value={value()}
        onInput={setValue}
        hint="운영체제 글꼴 목록에 보이는 기본 이름입니다."
      />
    )
  },
}

/** 잘못된 값: 원인과 고치는 방법을 함께 알림 */
export const WithError: Story = {
  render: () => (
    <TextField
      label="버전"
      required
      value="v1"
      onInput={() => {}}
      error="버전은 1.000처럼 숫자, 점, 소수 세 자리 이내로 입력해 주세요."
    />
  ),
}

export const Multiline: Story = {
  render: () => {
    const [value, setValue] = createSignal('다람쥐 헌 쳇바퀴에 타고파')
    return <TextField label="미리 볼 글" multiline rows={3} value={value()} onInput={setValue} />
  },
}
