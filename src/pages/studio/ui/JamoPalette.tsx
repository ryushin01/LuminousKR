import { For, createMemo, createSignal, createUniqueId } from 'solid-js'
import {
  ALL_JAMO_KEYS,
  ASCENDER,
  type JamoKey,
  LATIN_ASCENT,
  LATIN_CHARS,
  LATIN_DESCENT,
  type RenderItem,
  type Role,
  ROLE_LABEL,
  bodyFrame,
  createRenderedGlyphs,
  fontProject,
  frameBox,
  homeLayout,
  isDerivable,
  jamoChar,
  jamoName,
  latinGroup,
  latinLabel,
  parseJamoKey,
} from '@/entities/font'
import { Tabs } from '@/shared/ui/tabs'
import { boxToSvg } from '../lib/canvas-geometry.ts'
import type { Editor } from '../model/editor.ts'
import styles from './JamoPalette.module.css'

const ROLES: readonly Role[] = ['L', 'V', 'T']

/** 판의 탭: 초성·중성·종성, 영문(대·소문자 52자), 숫자·기호(42자) */
type PaletteTab = Role | 'letters' | 'symbols'

const LETTERS = LATIN_CHARS.filter((c) => latinGroup(c) === 'upper' || latinGroup(c) === 'lower')
/** 숫자를 앞에, 기호는 번호 차례로 */
const SYMBOLS = [
  ...LATIN_CHARS.filter((c) => latinGroup(c) === 'digit'),
  ...LATIN_CHARS.filter((c) => latinGroup(c) === 'symbol'),
]
const LATIN_TABS = { letters: LETTERS, symbols: SYMBOLS } as const

/** 영문 칸 그림의 세로 범위 (어센더~디센더에 조금 여유) */
const LATIN_TOP = ASCENDER - LATIN_ASCENT - 40
const LATIN_SIZE = LATIN_ASCENT - LATIN_DESCENT + 80

export function latinStatus(char: string): string {
  const entry = fontProject.latin[char]
  const drawing = entry?.drawing
  const base = drawing ? (drawing.strokes.length === 0 ? '비어 있음' : '직접') : '기본'
  return entry?.width === undefined ? base : `${base} · 너비`
}

export function jamoStatus(key: JamoKey): string {
  const entry = fontProject.jamo[key]
  const variants = Object.keys(entry?.variants ?? {}).length
  const base = entry?.base ? '직접' : isDerivable(key) ? '자동' : '비어 있음'
  return variants > 0 ? `${base} · 벌 ${variants}` : base
}

/**
 * 편집할 자모·글자를 고르는 판. 초성·중성·종성과 영문, 숫자·기호 탭 안에 라디오 단추로 둡니다
 * (모든 탭이 한 라디오 묶음이라 지금 고친 것 하나만 골라져 있음).
 */
export function JamoPalette(props: { editor: Editor }) {
  // eslint-disable-next-line solid/reactivity -- 편집기 객체는 화면마다 한 번 만들어지고 바뀌지 않습니다.
  const editor = props.editor
  const name = createUniqueId()
  const initialLatin = editor.latin()
  const [role, setRole] = createSignal<PaletteTab>(
    initialLatin === null
      ? parseJamoKey(editor.key()).role
      : LETTERS.includes(initialLatin)
        ? 'letters'
        : 'symbols',
  )
  const latinTab = () => role() === 'letters' || role() === 'symbols'

  const items = createMemo<RenderItem[]>(() =>
    ALL_JAMO_KEYS.map((key) => ({ type: 'jamo', key, layout: homeLayout(key) })),
  )
  const thumbs = createRenderedGlyphs(items)
  // 영문 칸 그림은 영문 탭을 볼 때만 그립니다(획을 고칠 때마다 94자를 다시 그리지 않게).
  const latinItems = createMemo<RenderItem[]>(() =>
    latinTab() ? LATIN_CHARS.map((char) => ({ type: 'char', char })) : [],
  )
  const latinThumbs = createRenderedGlyphs(latinItems)
  const latinViewBox = (advance: number) =>
    `${(advance - LATIN_SIZE) / 2} ${LATIN_TOP} ${LATIN_SIZE} ${LATIN_SIZE}`

  const viewBoxOf = (key: JamoKey) => {
    const frame = bodyFrame(fontProject.metrics, fontProject.style)
    const rect = boxToSvg(frame, frameBox(fontProject.layouts, key, homeLayout(key)))
    const pad = fontProject.style.weight * 0.9
    const size = Math.max(rect.width, rect.height) + pad * 2
    const cx = rect.x + rect.width / 2
    const cy = rect.y + rect.height / 2
    return `${cx - size / 2} ${cy - size / 2} ${size} ${size}`
  }

  const panel = (current: Role) => () => (
    <fieldset class={styles.fieldset}>
      <legend class="visually-hidden">편집할 {ROLE_LABEL[current]}</legend>
      <div class={styles.grid}>
        <For each={ALL_JAMO_KEYS.filter((key) => key.startsWith(current))}>
          {(key) => (
            <label class={styles.tile} title={`${jamoChar(key)} ${jamoName(key)}`}>
              <input
                class={styles.radio}
                type="radio"
                name={name}
                value={key}
                checked={editor.latin() === null && editor.key() === key}
                onChange={() => editor.selectJamo(key)}
              />
              <span class={styles.thumb}>
                <svg viewBox={viewBoxOf(key)} aria-hidden="true">
                  <path d={thumbs()?.[ALL_JAMO_KEYS.indexOf(key)]?.d ?? ''} />
                </svg>
              </span>
              <span class={styles.char}>{jamoChar(key)}</span>
              <span class={styles.status}>{jamoStatus(key)}</span>
            </label>
          )}
        </For>
      </div>
    </fieldset>
  )

  const latinPanel = (tab: 'letters' | 'symbols') => () => (
    <fieldset class={styles.fieldset}>
      <legend class="visually-hidden">편집할 {tab === 'letters' ? '영문' : '숫자·기호'}</legend>
      <div class={styles.grid}>
        <For each={LATIN_TABS[tab]}>
          {(char) => {
            const thumb = () => {
              const list = latinThumbs()
              return list && list.length === LATIN_CHARS.length
                ? list[LATIN_CHARS.indexOf(char)]
                : undefined
            }
            return (
              <label class={styles.tile} title={latinLabel(char)}>
                <input
                  class={styles.radio}
                  type="radio"
                  name={name}
                  value={char}
                  checked={editor.latin() === char}
                  onChange={() => editor.selectLatin(char)}
                />
                <span class={styles.thumb}>
                  <svg viewBox={latinViewBox(thumb()?.advance ?? 600)} aria-hidden="true">
                    <path d={thumb()?.d ?? ''} />
                  </svg>
                </span>
                <span class={styles.char} aria-hidden="true">
                  {char}
                </span>
                <span class="visually-hidden">{latinLabel(char)}</span>
                <span class={styles.status}>{latinStatus(char)}</span>
              </label>
            )
          }}
        </For>
      </div>
    </fieldset>
  )

  return (
    <Tabs
      label="자모·글자 갈래"
      selected={role()}
      onSelect={setRole}
      items={[
        ...ROLES.map((r) => ({
          id: r,
          label: (
            <>
              {ROLE_LABEL[r]}{' '}
              <span class={styles.count}>{r === 'L' ? 19 : r === 'V' ? 21 : 27}</span>
            </>
          ),
          panel: panel(r),
        })),
        {
          id: 'letters' as const,
          label: (
            <>
              영문 <span class={styles.count}>{LETTERS.length}</span>
            </>
          ),
          panel: latinPanel('letters'),
        },
        {
          id: 'symbols' as const,
          label: (
            <>
              숫자·기호 <span class={styles.count}>{SYMBOLS.length}</span>
            </>
          ),
          panel: latinPanel('symbols'),
        },
      ]}
    />
  )
}
