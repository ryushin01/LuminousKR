import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { createEditor } from '../model/editor.ts'
import { JamoPalette } from './JamoPalette.tsx'

const meta = {
  title: 'pages/studio/JamoPalette',
  component: JamoPalette,
  render: () => (
    <div style={{ 'max-width': '300px' }}>
      <JamoPalette editor={createEditor('L0')} />
    </div>
  ),
} satisfies Meta

export default meta
// 스토리 안에서 상태를 만들어 그리므로 속성(args)을 받지 않습니다.
type Story = StoryObj

export const Default: Story = {}
