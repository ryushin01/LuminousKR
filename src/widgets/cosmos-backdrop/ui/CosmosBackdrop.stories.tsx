import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { CosmosBackdrop } from './CosmosBackdrop.tsx'

const meta = {
  title: 'widgets/CosmosBackdrop',
  component: CosmosBackdrop,
  parameters: { layout: 'fullscreen' },
  args: { dim: 1, paused: false },
  render: (args) => (
    <div style={{ position: 'relative', isolation: 'isolate', height: '480px' }}>
      <CosmosBackdrop {...args} />
      <p style={{ padding: '24px', 'font-size': '14px' }}>
        꾸밈용 WebGL 배경 (보조기기에서는 숨김)
      </p>
    </div>
  ),
} satisfies Meta<typeof CosmosBackdrop>

export default meta
type Story = StoryObj<typeof meta>

export const Moving: Story = {}
export const Dimmed: Story = { args: { dim: 0.42 } }
export const Paused: Story = { args: { paused: true } }
