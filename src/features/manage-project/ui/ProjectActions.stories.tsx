import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { ProjectActions } from './ProjectActions.tsx'

const meta = {
  title: 'features/manage-project/ProjectActions',
  component: ProjectActions,
} satisfies Meta<typeof ProjectActions>

export default meta
type Story = StoryObj<typeof meta>

export const Full: Story = {}
export const Compact: Story = { args: { compact: true } }
