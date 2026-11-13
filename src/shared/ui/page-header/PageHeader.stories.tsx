import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { PageHeader } from './PageHeader.tsx'

const meta = {
  title: 'shared/PageHeader',
  component: PageHeader,
  parameters: { layout: 'fullscreen' },
  args: {
    number: '02',
    label: '작업실',
    title: '자모의 뼈대를 그립니다',
    lead: '획의 가운데 선만 그리면 굵기는 조합기가 입힙니다.',
  },
} satisfies Meta<typeof PageHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
