import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { AutosaveNotice } from './AutosaveNotice.tsx'

const meta = {
  title: 'features/autosave-status/AutosaveNotice',
  component: AutosaveNotice,
  args: {
    synced: false,
    failure: null,
    unreadable: false,
    onDownloadUnreadable: () => {},
    onDiscardUnreadable: () => {},
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AutosaveNotice>

export default meta
type Story = StoryObj<typeof meta>

/** 다른 탭에서 바뀐 작업을 불러왔을 때 (잠시 보였다가 사라짐) */
export const Synced: Story = { args: { synced: true } }

/** 저장 공간이 가득 차 자동 저장에 실패했을 때 */
export const QuotaFailure: Story = { args: { failure: 'quota' } }

/** 브라우저가 저장소를 막았을 때 */
export const Unavailable: Story = { args: { failure: 'unavailable' } }

/** 저장된 작업을 읽지 못해 따로 보관했을 때 */
export const Unreadable: Story = { args: { unreadable: true } }
