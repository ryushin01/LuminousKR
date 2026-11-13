import { For, createMemo } from 'solid-js'
import {
  LAYOUT_INFO,
  type RenderItem,
  createRenderedGlyphs,
  layoutsOf,
  parseJamoKey,
  sampleSyllable,
} from '@/entities/font'
import { GlyphView } from '@/entities/font'
import { formatNumber } from '@/shared/lib/format'
import type { Editor } from '../model/editor.ts'
import styles from './LayoutPreview.module.css'

/** 이 자모가 들어가는 음절 수 (초성 588, 중성 532, 종성 399) */
const SYLLABLES_PER_ROLE = { L: 21 * 28, V: 19 * 28, T: 19 * 21 } as const

/** 지금 자모가 배치마다 어떻게 놓이는지 음절로 보여 주고, 누르면 그 배치를 고칩니다. */
export function LayoutPreview(props: { editor: Editor }) {
  // eslint-disable-next-line solid/reactivity -- 편집기 객체는 화면마다 한 번 만들어지고 바뀌지 않습니다.
  const editor = props.editor
  const layouts = () => layoutsOf(editor.key())
  const items = createMemo<RenderItem[]>(() =>
    layouts().map((layout) => ({ type: 'char', char: sampleSyllable(editor.key(), layout) })),
  )
  const glyphs = createRenderedGlyphs(items)
  return (
    <div class={styles.wrap}>
      <ul class={styles.list}>
        <For each={layouts()}>
          {(layout, index) => {
            const char = () => sampleSyllable(editor.key(), layout)
            return (
              <li>
                <button
                  type="button"
                  class={styles.cell}
                  aria-pressed={editor.layout() === layout ? 'true' : 'false'}
                  onClick={() => editor.selectLayout(layout)}
                >
                  <GlyphView glyph={glyphs()?.[index()]} class={styles.glyph} />
                  <span class={styles.caption}>
                    {char()}
                    <span class="visually-hidden">
                      {' '}
                      — {LAYOUT_INFO[layout].sample} 모양 배치 고치기
                    </span>
                  </span>
                </button>
              </li>
            )
          }}
        </For>
      </ul>
      <p class={styles.note}>
        이 자모는 11,172자 가운데{' '}
        <strong class="numeric">
          {formatNumber(SYLLABLES_PER_ROLE[parseJamoKey(editor.key()).role])}자
        </strong>
        에 들어갑니다.
      </p>
    </div>
  )
}
