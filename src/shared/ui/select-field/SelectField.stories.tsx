import { createSignal } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { SelectField } from './SelectField.tsx'

const meta = {
  title: 'shared/SelectField',
  component: SelectField,
} satisfies Meta

export default meta
// 스토리 안에서 상태를 만들어 그리므로 속성(args)을 받지 않습니다.
type Story = StoryObj

export const Grid: Story = {
  render: () => {
    const [value, setValue] = createSignal('24')
    return (
      <SelectField
        label="격자"
        value={value()}
        onChange={setValue}
        hint="점을 찍을 때 맞출 칸 수입니다."
        options={[
          { value: '12', label: '12칸 (굵은 모듈)' },
          { value: '24', label: '24칸' },
          { value: '48', label: '48칸 (세밀하게)' },
        ]}
      />
    )
  },
}
