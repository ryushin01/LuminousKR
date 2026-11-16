import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { UpdateNoticeView } from './UpdateNotice.tsx'

const meta = {
  title: 'features/app-update/UpdateNotice',
  component: UpdateNoticeView,
  args: { failed: true, onReload: () => {} },
} satisfies Meta<typeof UpdateNoticeView>

export default meta
type Story = StoryObj<typeof meta>

/** 앱 파일(화면 조각·워커)을 받지 못했을 때 */
export const Failed: Story = {}
