import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { StatusMessage } from './StatusMessage.tsx'

const meta = {
  title: 'shared/StatusMessage',
  component: StatusMessage,
  args: { message: '음절 조합: 4,096 / 11,223자' },
} satisfies Meta<typeof StatusMessage>

export default meta
type Story = StoryObj<typeof meta>

export const Progress: Story = {}
export const Success: Story = {
  args: { tone: 'success', message: '글리프 11,225개를 1.1초 만에 만들었습니다.' },
}
export const Alert: Story = {
  args: {
    kind: 'alert',
    tone: 'danger',
    message: '글꼴 파일을 만들지 못했습니다. 잠시 뒤 다시 눌러 주세요.',
  },
}
