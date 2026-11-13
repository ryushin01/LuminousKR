import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { TemplatePanel } from './TemplatePanel.tsx'

const meta = {
  title: 'pages/import/TemplatePanel',
  component: TemplatePanel,
  decorators: [
    (Story) => (
      <div style={{ 'max-width': '560px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta

export default meta
type Story = StoryObj

/** 받을 양식을 고르고 인쇄용 PDF를 내려받습니다 (글자는 조합기 글리프로 그림) */
export const Default: Story = {}
