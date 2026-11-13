import { For, createMemo } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import type { RenderItem } from '../api/engine-protocol.ts'
import { createRenderedGlyphs } from '../model/rendered.ts'
import { GlyphView } from './GlyphView.tsx'

const meta = {
  title: 'entities/font/GlyphView',
  component: GlyphView,
} satisfies Meta

export default meta
// 스토리 안에서 상태를 만들어 그리므로 속성(args)을 받지 않습니다.
type Story = StoryObj

/** 조합 워커가 기본 프리셋으로 만든 윤곽 */
export const Composed: Story = {
  render: () => {
    const items = createMemo<RenderItem[]>(() =>
      [...'빛나는한글'].map((char) => ({ type: 'char', char })),
    )
    const glyphs = createRenderedGlyphs(items)
    return (
      <div
        style={{
          display: 'grid',
          'grid-template-columns': 'repeat(5, 120px)',
          gap: '12px',
          color: 'var(--c-glow)',
        }}
      >
        <For each={[...'빛나는한글']}>
          {(char, i) => <GlyphView glyph={glyphs()?.[i()]} label={char} guides />}
        </For>
      </div>
    )
  },
}

/** 워커 응답 전 자리표시 */
export const Placeholder: Story = {
  render: () => (
    <div style={{ width: '120px' }}>
      <GlyphView glyph={undefined} />
    </div>
  ),
}
