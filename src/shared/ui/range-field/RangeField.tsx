import { Show, createUniqueId } from 'solid-js'
import styles from './RangeField.module.css'

export type RangeFieldProps = {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onInput: (value: number) => void
  /** 화면과 보조기기에 보여 줄 값 (예: "76 단위") */
  format?: (value: number) => string
  hint?: string
  disabled?: boolean
}

export function RangeField(props: RangeFieldProps) {
  const id = createUniqueId()
  const hintId = `${id}-hint`
  const text = () => (props.format ? props.format(props.value) : String(props.value))
  return (
    <div class={styles.field}>
      <div class={styles.top}>
        <label class={styles.label} for={id}>
          {props.label}
        </label>
        <output class={`${styles.output} numeric`} for={id}>
          {text()}
        </output>
      </div>
      <input
        id={id}
        class={styles.range}
        type="range"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        disabled={props.disabled}
        aria-valuetext={text()}
        aria-describedby={props.hint ? hintId : undefined}
        style={{ '--fill': `${((props.value - props.min) / (props.max - props.min || 1)) * 100}%` }}
        onInput={(event) => props.onInput(Number(event.currentTarget.value))}
      />
      <Show when={props.hint}>
        <p id={hintId} class={styles.hint}>
          {props.hint}
        </p>
      </Show>
    </div>
  )
}
