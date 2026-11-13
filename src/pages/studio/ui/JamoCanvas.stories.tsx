import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { createEditor } from '../model/editor.ts'
import { JamoCanvas } from './JamoCanvas.tsx'

const meta = {
  title: 'pages/studio/JamoCanvas',
  component: JamoCanvas,
  render: () => <JamoCanvas editor={createEditor('L0')} />,
} satisfies Meta

export default meta
// 스토리 안에서 상태를 만들어 그리므로 속성(args)을 받지 않습니다.
type Story = StoryObj

/** ㄱ 초성: 판에 Tab으로 들어가 화살표·스페이스·Enter로 그릴 수 있습니다. */
export const Lead: Story = {}

/** 자동으로 만들어지는 ㄲ: 점선은 ㄱ 두 개로 만든 뼈대 */
export const Derived: Story = { render: () => <JamoCanvas editor={createEditor('L1')} /> }
