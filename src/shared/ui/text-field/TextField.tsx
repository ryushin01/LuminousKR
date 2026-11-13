import { Show, createUniqueId } from 'solid-js'
import styles from './TextField.module.css'

export type TextFieldProps = {
  label: string
  value: string
  onInput: (value: string) => void
  hint?: string
  /** 잘못된 값일 때만 넘깁니다 (빈 칸·처음 값에는 넘기지 않음). 원인과 고치는 방법을 적습니다. */
  error?: string
  required?: boolean
  multiline?: boolean
  rows?: number
  maxLength?: number
  autocomplete?: string
  inputMode?: 'text' | 'decimal' | 'numeric'
  spellcheck?: boolean
  lang?: string
}

export function TextField(props: TextFieldProps) {
  const id = createUniqueId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = () =>
    [props.hint ? hintId : '', props.error ? errorId : ''].filter(Boolean).join(' ') || undefined
  const shared = () => ({
    id,
    class: styles.control,
    value: props.value,
    required: props.required,
    maxLength: props.maxLength,
    spellcheck: props.spellcheck,
    lang: props.lang,
    'aria-invalid': props.error ? ('true' as const) : undefined,
    'aria-describedby': describedBy(),
    'aria-errormessage': props.error ? errorId : undefined,
  })
  return (
    <div class={styles.field}>
      <label class={styles.label} for={id}>
        {props.label}
        <Show when={props.required}>
          <span class={styles.required}>{' (필수)'}</span>
        </Show>
      </label>
      <Show
        when={props.multiline}
        fallback={
          <input
            {...shared()}
            type="text"
            autocomplete={props.autocomplete}
            inputMode={props.inputMode}
            onInput={(event) => props.onInput(event.currentTarget.value)}
          />
        }
      >
        <textarea
          {...shared()}
          rows={props.rows ?? 4}
          onInput={(event) => props.onInput(event.currentTarget.value)}
        />
      </Show>
      <Show when={props.hint}>
        <p id={hintId} class={styles.hint}>
          {props.hint}
        </p>
      </Show>
      <Show when={props.error}>
        <p id={errorId} class={styles.error}>
          {props.error}
        </p>
      </Show>
    </div>
  )
}
