import { For } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Icon, type IconName } from './Icon.tsx'

const NAMES: IconName[] = [
  'menu', 'close', 'undo', 'redo', 'trash', 'line', 'curve', 'ellipse', 'pointer', 'grid', 'download',
  'upload', 'play', 'pause', 'arrowUp', 'arrowDown', 'arrowLeft', 'arrowRight', 'check', 'sparkle',
  'reset', 'file', 'external', 'plus',
] // prettier-ignore

const meta = {
  title: 'shared/Icon',
  component: Icon,
} satisfies Meta

export default meta
// 스토리 안에서 상태를 만들어 그리므로 속성(args)을 받지 않습니다.
type Story = StoryObj

/** 아이콘은 꾸밈이라 늘 aria-hidden입니다. 이름은 감싸는 버튼에 줍니다. */
export const Gallery: Story = {
  render: () => (
    <ul
      style={{
        display: 'grid',
        'grid-template-columns': 'repeat(6, 1fr)',
        gap: '16px',
        'list-style': 'none',
        padding: 0,
      }}
    >
      <For each={NAMES}>
        {(name) => (
          <li
            style={{ display: 'grid', 'justify-items': 'center', gap: '6px', 'font-size': '12px' }}
          >
            <Icon name={name} size={24} />
            {name}
          </li>
        )}
      </For>
    </ul>
  ),
}
