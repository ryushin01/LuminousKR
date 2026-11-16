import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Button } from '../button/Button.tsx'
import { NoticeActions, NoticeCard, NoticeMessage } from './NoticeCard.tsx'

const meta = {
  title: 'shared/NoticeCard',
  component: NoticeCard,
} satisfies Meta<typeof NoticeCard>

export default meta
type Story = StoryObj<typeof meta>

/** 결과 알림(status) */
export const Status: Story = {
  args: { active: true, children: undefined },
  render: () => (
    <NoticeCard active>
      <NoticeMessage role="status">다른 탭에서 바뀐 작업을 불러왔습니다.</NoticeMessage>
    </NoticeCard>
  ),
}

/** 경고(alert)와 버튼 줄 */
export const AlertWithActions: Story = {
  args: { active: true, children: undefined },
  render: () => (
    <NoticeCard active>
      <NoticeMessage role="alert" tone="danger">
        자동 저장하지 못했습니다. 프로젝트 파일(.json)로 저장해 두세요.
      </NoticeMessage>
      <NoticeActions>
        <Button size="small" variant="secondary">
          보관한 작업 받기
        </Button>
      </NoticeActions>
    </NoticeCard>
  ),
}
