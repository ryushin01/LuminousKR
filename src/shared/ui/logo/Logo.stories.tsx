import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { LogoMark } from './Logo.tsx'

const meta = {
  title: 'shared/LogoMark',
  component: LogoMark,
  args: { size: 96 },
} satisfies Meta<typeof LogoMark>

export default meta
type Story = StoryObj<typeof meta>

/** 어둠 속에서 고리처럼 새어 나오는 일식의 빛 */
export const Default: Story = {}
