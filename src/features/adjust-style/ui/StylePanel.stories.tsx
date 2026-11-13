import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { StylePanel } from './StylePanel.tsx'

const meta = {
  title: 'features/adjust-style/StylePanel',
  component: StylePanel,
  decorators: [
    (Story) => (
      <div style={{ 'max-width': '360px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StylePanel>

export default meta
type Story = StoryObj<typeof meta>

export const Stroke: Story = {}
export const WithMetrics: Story = { args: { showMetrics: true } }
