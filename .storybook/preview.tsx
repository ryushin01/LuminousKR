import type { Preview } from 'storybook-solidjs-vite'
import '../src/app/styles/index.css'

const preview: Preview = {
  parameters: {
    layout: 'padded',
    backgrounds: { disable: true },
    // 스토리마다 axe 접근성 검사를 돌리고 위반은 오류로 봅니다.
    a11y: { test: 'error' },
  },
  decorators: [
    (Story) => (
      <div
        lang="ko"
        style={{
          padding: '16px',
          background: 'var(--c-void)',
          color: 'var(--c-text)',
          'min-height': '100%',
        }}
      >
        <Story />
      </div>
    ),
  ],
}

export default preview
