import { createSignal } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Icon } from '../icon/Icon.tsx'
import { Segmented } from './Segmented.tsx'

const meta = {
  title: 'shared/Segmented',
  component: Segmented,
} satisfies Meta

export default meta
// 스토리 안에서 상태를 만들어 그리므로 속성(args)을 받지 않습니다.
type Story = StoryObj

export const Caps: Story = {
  render: () => {
    const [value, setValue] = createSignal<'round' | 'square' | 'butt'>('round')
    return (
      <Segmented
        legend="획 끝 모양"
        value={value()}
        onChange={setValue}
        options={[
          { value: 'round', label: '둥근 끝' },
          { value: 'square', label: '각진 끝' },
          { value: 'butt', label: '잘린 끝' },
        ]}
      />
    )
  },
}

export const Tools: Story = {
  render: () => {
    const [value, setValue] = createSignal<'line' | 'curve' | 'ellipse'>('line')
    return (
      <Segmented
        legend="그리기 도구"
        value={value()}
        onChange={setValue}
        options={[
          {
            value: 'line',
            label: (
              <>
                <Icon name="line" size={18} />
                직선
              </>
            ),
          },
          {
            value: 'curve',
            label: (
              <>
                <Icon name="curve" size={18} />
                곡선
              </>
            ),
          },
          {
            value: 'ellipse',
            label: (
              <>
                <Icon name="ellipse" size={18} />원
              </>
            ),
          },
        ]}
      />
    )
  },
}
