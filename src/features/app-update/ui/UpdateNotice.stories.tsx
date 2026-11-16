import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { UpdateNoticeView } from './UpdateNotice.tsx'

const meta = {
  title: 'features/app-update/UpdateNotice',
  component: UpdateNoticeView,
  args: { failed: true, blocked: false, onReload: () => {}, onForceReload: () => {} },
} satisfies Meta<typeof UpdateNoticeView>

export default meta
type Story = StoryObj<typeof meta>

/** 앱 파일(화면 조각·워커)을 받지 못했을 때 */
export const Failed: Story = {}

/** 저장하지 못한 변경이 있어 새로 고치지 않았을 때 */
export const Blocked: Story = { args: { blocked: true } }
