import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { LogoMark } from './Logo.tsx'

const meta = {
  title: 'shared/LogoMark',
  component: LogoMark,
  args: { size: 96 },
} satisfies Meta<typeof LogoMark>

export default meta
type Story = StoryObj<typeof meta>

/** 글자 틀 위의 뼈대 획(ㄴ)과 일식처럼 새어 나오는 빛 한 점 */
export const Default: Story = {}
