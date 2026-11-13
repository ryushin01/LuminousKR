import { For, Show, createUniqueId } from 'solid-js'
import styles from './SelectField.module.css'

export type SelectOption<T extends string> = { value: T; label: string }

export type SelectFieldProps<T extends string> = {
  label: string
  value: T
  options: readonly SelectOption<T>[]
  onChange: (value: T) => void
  hint?: string
}

export function SelectField<T extends string>(props: SelectFieldProps<T>) {
  const id = createUniqueId()
  const hintId = `${id}-hint`
  return (
    <div class={styles.field}>
      <label class={styles.label} for={id}>
        {props.label}
      </label>
      <select
        id={id}
        class={styles.control}
        value={props.value}
        aria-describedby={props.hint ? hintId : undefined}
        onChange={(event) => props.onChange(event.currentTarget.value as T)}
      >
        <For each={props.options}>
          {(option) => <option value={option.value}>{option.label}</option>}
        </For>
      </select>
      <Show when={props.hint}>
        <p id={hintId} class={styles.hint}>
          {props.hint}
        </p>
      </Show>
    </div>
  )
}
