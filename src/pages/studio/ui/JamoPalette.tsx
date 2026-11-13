import { For, createMemo, createSignal, createUniqueId } from 'solid-js'
import {
  ALL_JAMO_KEYS,
  type JamoKey,
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
  parseJamoKey,
} from '@/entities/font'
import { Tabs } from '@/shared/ui/tabs'
import { boxToSvg } from '../lib/canvas-geometry.ts'
import type { Editor } from '../model/editor.ts'
import styles from './JamoPalette.module.css'

const ROLES: readonly Role[] = ['L', 'V', 'T']

export function jamoStatus(key: JamoKey): string {
  const entry = fontProject.jamo[key]
  const variants = Object.keys(entry?.variants ?? {}).length
  const base = entry?.base ? '직접' : isDerivable(key) ? '자동' : '비어 있음'
  return variants > 0 ? `${base} · 벌 ${variants}` : base
}

/** 편집할 자모를 고르는 판. 초성·중성·종성 탭 안에 라디오 단추로 둡니다. */
export function JamoPalette(props: { editor: Editor }) {
  // eslint-disable-next-line solid/reactivity -- 편집기 객체는 화면마다 한 번 만들어지고 바뀌지 않습니다.
  const editor = props.editor
  const name = createUniqueId()
  const [role, setRole] = createSignal<Role>(parseJamoKey(editor.key()).role)

  const items = createMemo<RenderItem[]>(() =>
    ALL_JAMO_KEYS.map((key) => ({ type: 'jamo', key, layout: homeLayout(key) })),
  )
  const thumbs = createRenderedGlyphs(items)

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
                checked={editor.key() === key}
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

  return (
    <Tabs
      label="자모 갈래"
      selected={role()}
      onSelect={setRole}
      items={ROLES.map((r) => ({
        id: r,
        label: (
          <>
            {ROLE_LABEL[r]} <span class={styles.count}>{r === 'L' ? 19 : r === 'V' ? 21 : 27}</span>
          </>
        ),
        panel: panel(r),
      }))}
    />
  )
}
