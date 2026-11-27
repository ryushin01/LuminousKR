import { SegmentGroup } from '@ark-ui/solid/segment-group'
import { For, type JSX, Show } from 'solid-js'
import styles from './Segmented.module.css'

export type SegmentedOption<T extends string> = {
  value: T
  label: JSX.Element
  /** 글자 대신 아이콘만 보일 때의 접근 이름 */
  accessibleLabel?: string
  description?: string
}

export type SegmentedProps<T extends string> = {
  legend: string
  /** 범례를 화면에서 숨기고 보조기기에만 알릴 때 */
  hideLegend?: boolean
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  size?: 'medium' | 'small'
  disabled?: boolean
}

/**
 * 하나만 고르는 버튼 묶음(Ark UI SegmentGroup). 항목마다 숨긴 네이티브 라디오가 있어
 * 화살표 키 이동·Space 고르기가 기본으로 되고, 묶음은 role="radiogroup"으로 범례와 연결됩니다.
 * 고른 항목·초점은 Ark의 data-state="checked"·data-focus-visible로 그립니다.
 */
/** Ark가 1px로 숨겨 둔 라디오를 항목 크기로 펴고 투명하게 둡니다(인라인 스타일을 같은 키로 덮음). */
const COVER = {
  clip: 'auto',
  inset: '0',
  width: '100%',
  height: '100%',
  margin: '0',
  opacity: '0',
  cursor: 'inherit',
} satisfies JSX.CSSProperties

export function Segmented<T extends string>(props: SegmentedProps<T>) {
  const isOption = (value: string | null): value is T =>
    props.options.some((option) => option.value === value)
  return (
    <SegmentGroup.Root
      class={styles.group}
      value={props.value}
      disabled={props.disabled}
      onValueChange={(details) => {
        if (isOption(details.value) && details.value !== props.value) props.onChange(details.value)
      }}
    >
      <SegmentGroup.Label class={props.hideLegend ? 'visually-hidden' : styles.legend}>
        {props.legend}
      </SegmentGroup.Label>
      <div class={`${styles.options} ${props.size === 'small' ? styles.small : ''}`}>
        <For each={props.options}>
          {(option) => (
            <SegmentGroup.Item
              class={styles.option}
              value={option.value}
              title={option.description}
            >
              <SegmentGroup.ItemText class={styles.face}>
                <Show when={option.accessibleLabel} fallback={option.label}>
                  {(name) => (
                    <>
                      <span class={styles.faceInner} aria-hidden="true">
                        {option.label}
                      </span>
                      <span class="visually-hidden">{name()}</span>
                    </>
                  )}
                </Show>
              </SegmentGroup.ItemText>
              {/* 숨긴 라디오를 항목 전체에 투명하게 덮어, 누르는 자리가 보이는 단추와 같게 합니다(기존과 같음). */}
              <SegmentGroup.ItemHiddenInput style={COVER} />
            </SegmentGroup.Item>
          )}
        </For>
      </div>
    </SegmentGroup.Root>
  )
}
