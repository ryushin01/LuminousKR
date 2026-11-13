import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { createImporter } from '../model/importer.ts'
import { UploadPanel } from './UploadPanel.tsx'

const meta = {
  title: 'pages/import/UploadPanel',
  component: UploadPanel,
  render: () => (
    <div style={{ 'max-width': '560px' }}>
      <UploadPanel importer={createImporter()} />
    </div>
  ),
} satisfies Meta

export default meta
type Story = StoryObj

/** 파일 고르기 버튼(키보드)과 끌어다 놓기, 인식 방식 */
export const Default: Story = {}
