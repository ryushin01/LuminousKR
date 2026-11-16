import type { StorybookConfig } from 'storybook-solidjs-vite'
import type { PluginOption } from 'vite'

/** 앱 빌드에만 쓰는 플러그인 */
const APP_ONLY_PLUGINS = new Set(['luminous-csp'])

/**
 * 프로젝트 vite.config.ts에서 앱 빌드 전용 플러그인을 뺍니다.
 * 앱의 CSP(script-src 'self')가 미리보기 iframe에 붙으면 Storybook의 인라인 설정 스크립트(설정값, 문서 언어 ko)가 막힙니다.
 */
function withoutAppOnlyPlugins(plugins: PluginOption[] = []): PluginOption[] {
  return plugins
    .map((plugin) => (Array.isArray(plugin) ? withoutAppOnlyPlugins(plugin) : plugin))
    .filter(
      (plugin) =>
        !(
          plugin &&
          typeof plugin === 'object' &&
          'name' in plugin &&
          APP_ONLY_PLUGINS.has(plugin.name)
        ),
    )
}

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.tsx'],
  addons: ['@storybook/addon-a11y'],
  framework: { name: 'storybook-solidjs-vite', options: {} },
  staticDirs: ['../public'],
  core: { disableTelemetry: true },
  viteFinal: (config) => ({ ...config, plugins: withoutAppOnlyPlugins(config.plugins) }),
}

export default config
