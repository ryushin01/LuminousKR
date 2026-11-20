import { For, createMemo } from 'solid-js'
import {
  ASCENDER,
  LATIN_ASCENT,
  LATIN_DESCENT,
  type RenderItem,
  createRenderedGlyphs,
  fontProject,
  latinGroup,
  latinLabel,
} from '@/entities/font'
import { formatNumber } from '@/shared/lib/format'
import type { Editor } from '../model/editor.ts'
import styles from './LatinPreview.module.css'

/** 글자 사이를 보는 관례적인 앞뒤 글자: 곧은 글자(H n 1) 사이와 둥근 글자(O o 0) 사이 */
export function contextWords(char: string): [string, string] {
  switch (latinGroup(char)) {
    case 'upper':
      return [`HH${char}HH`, `OO${char}OO`]
    case 'lower':
      return [`nn${char}nn`, `oo${char}oo`]
    case 'digit':
      return [`11${char}11`, `00${char}00`]
    default:
      return [`HH${char}HH`, `nn${char}nn`]
  }
}

/** 단어 그림의 세로 범위 (어센더~디센더에 조금 여유) */
const TOP = ASCENDER - LATIN_ASCENT - 40
const HEIGHT = LATIN_ASCENT - LATIN_DESCENT + 80

/** 고르는 영문 글자를 앞뒤 글자 사이에 넣어, 글자 너비와 글자 사이를 봅니다. */
export function LatinPreview(props: { editor: Editor }) {
  // eslint-disable-next-line solid/reactivity -- 편집기 객체는 화면마다 한 번 만들어지고 바뀌지 않습니다.
  const editor = props.editor
  const words = () => contextWords(editor.latin() ?? 'H')
  const items = createMemo<RenderItem[]>(() =>
    [...words().join('')].map((char) => ({ type: 'char', char })),
  )
  const glyphs = createRenderedGlyphs(items)

  /** 단어 하나의 글리프를 글자 너비만큼 옆으로 늘어놓습니다. */
  const layout = (wordIndex: number) => {
    const list = glyphs()
    const [first, second] = words()
    if (!list || list.length !== first.length + second.length) return null
    const part = wordIndex === 0 ? list.slice(0, first.length) : list.slice(first.length)
    let x = 0
    const placed = part.map((glyph) => {
      const at = x
      x += glyph.advance
      return { d: glyph.d, x: at }
    })
    return { placed, width: x }
  }

  return (
    <div class={styles.wrap}>
      <ul class={styles.list}>
        <For each={[0, 1]}>
          {(index) => (
            <li class={styles.word}>
              <svg
                class={styles.svg}
                viewBox={`0 ${TOP} ${layout(index)?.width ?? 3000} ${HEIGHT}`}
                role="img"
                aria-label={words()[index]}
              >
                <For each={layout(index)?.placed ?? []}>
                  {(glyph) => <path d={glyph.d} transform={`translate(${glyph.x} 0)`} />}
                </For>
              </svg>
            </li>
          )}
        </For>
      </ul>
      <p class={styles.note}>
        {latinLabel(editor.latin() ?? 'H')}의 글자 너비는{' '}
        <strong class="numeric">{formatNumber(editor.latinAdvance())} 단위</strong>입니다(한글{' '}
        {formatNumber(fontProject.metrics.advance)} 단위).
      </p>
    </div>
  )
}
