import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { ConstellationProgress } from './ConstellationProgress.tsx'

const meta = {
  title: 'pages/export/ConstellationProgress',
  component: ConstellationProgress,
  args: { done: 4096, complete: false },
  argTypes: { done: { control: { type: 'range', min: 0, max: 11223, step: 1 } } },
  decorators: [
    (Story) => (
      <div style={{ 'max-width': '720px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ConstellationProgress>

export default meta
type Story = StoryObj<typeof meta>

/** 조합된 음절이 별처럼 켜지는 진행 그림 (꾸밈, 진행 정도는 <progress>로 따로 알림) */
export const Halfway: Story = {}
export const Complete: Story = { args: { complete: true } }
