import { createSignal } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { RangeField } from './RangeField.tsx'

const meta = {
  title: 'shared/RangeField',
  component: RangeField,
} satisfies Meta

export default meta
// 스토리 안에서 상태를 만들어 그리므로 속성(args)을 받지 않습니다.
type Story = StoryObj

export const Weight: Story = {
  render: () => {
    const [value, setValue] = createSignal(76)
    return (
      <div style={{ 'max-width': '360px' }}>
        <RangeField
          label="굵기"
          value={value()}
          min={30}
          max={180}
          onInput={setValue}
          format={(v) => `${v} 단위`}
          hint="세로획 굵기입니다 (1em = 1000 단위)."
        />
      </div>
    )
  },
}
