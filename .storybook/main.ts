import type { StorybookConfig } from 'storybook-solidjs-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.tsx'],
  addons: ['@storybook/addon-a11y'],
  framework: { name: 'storybook-solidjs-vite', options: {} },
  staticDirs: ['../public'],
  core: { disableTelemetry: true },
}

export default config
