import { createSignal } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Tabs } from './Tabs.tsx'

const meta = {
  title: 'shared/Tabs',
  component: Tabs,
} satisfies Meta

export default meta
// 스토리 안에서 상태를 만들어 그리므로 속성(args)을 받지 않습니다.
type Story = StoryObj

export const JamoGroups: Story = {
  render: () => {
    const [selected, setSelected] = createSignal<'L' | 'V' | 'T'>('L')
    return (
      <Tabs
        label="자모 갈래"
        selected={selected()}
        onSelect={setSelected}
        items={[
          {
            id: 'L',
            label: '초성',
            panel: () => <p>ㄱ ㄲ ㄴ ㄷ ㄸ ㄹ ㅁ ㅂ ㅃ ㅅ ㅆ ㅇ ㅈ ㅉ ㅊ ㅋ ㅌ ㅍ ㅎ</p>,
          },
          {
            id: 'V',
            label: '중성',
            panel: () => <p>ㅏ ㅐ ㅑ ㅒ ㅓ ㅔ ㅕ ㅖ ㅗ ㅘ ㅙ ㅚ ㅛ ㅜ ㅝ ㅞ ㅟ ㅠ ㅡ ㅢ ㅣ</p>,
          },
          {
            id: 'T',
            label: '종성',
            panel: () => (
              <p>
                ㄱ ㄲ ㄳ ㄴ ㄵ ㄶ ㄷ ㄹ ㄺ ㄻ ㄼ ㄽ ㄾ ㄿ ㅀ ㅁ ㅂ ㅄ ㅅ ㅆ ㅇ ㅈ ㅊ ㅋ ㅌ ㅍ ㅎ
              </p>
            ),
          },
        ]}
      />
    )
  },
}
