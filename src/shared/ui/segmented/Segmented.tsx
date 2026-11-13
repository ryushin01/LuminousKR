import { For, type JSX, createUniqueId } from 'solid-js'
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

/** 하나만 고르는 버튼 묶음. 네이티브 라디오라 화살표 키 이동이 기본으로 됩니다. */
export function Segmented<T extends string>(props: SegmentedProps<T>) {
  const name = createUniqueId()
  return (
    <fieldset class={styles.group} disabled={props.disabled}>
      <legend class={props.hideLegend ? 'visually-hidden' : styles.legend}>{props.legend}</legend>
      <div class={`${styles.options} ${props.size === 'small' ? styles.small : ''}`}>
        <For each={props.options}>
          {(option) => (
            <label class={styles.option} title={option.description}>
              <input
                class={styles.input}
                type="radio"
                name={name}
                value={option.value}
                checked={props.value === option.value}
                aria-label={option.accessibleLabel}
                onChange={() => props.onChange(option.value)}
              />
              <span class={styles.face}>{option.label}</span>
            </label>
          )}
        </For>
      </div>
    </fieldset>
  )
}
