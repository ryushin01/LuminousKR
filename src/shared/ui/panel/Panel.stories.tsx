import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Button } from '../button/Button.tsx'
import { Panel } from './Panel.tsx'

const meta = {
  title: 'shared/Panel',
  component: Panel,
} satisfies Meta<typeof Panel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    title: '획 스타일',
    description: '바꾸면 11,172자 전체에 한꺼번에 적용됩니다.',
    children: <p>패널 내용</p>,
  },
}

export const WithActions: Story = {
  args: {
    title: '프로젝트 파일',
    number: '3',
    actions: <Button size="small">프로젝트 저장</Button>,
    children: <p>그린 획과 설정을 .json으로 저장합니다.</p>,
  },
}
