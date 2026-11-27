import { Slider } from '@ark-ui/solid/slider'
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

/**
 * Ark UI 슬라이더(WAI-ARIA APG 슬라이더). 손잡이가 role="slider"이고 레이블과 연결되며,
 * 화살표(한 칸)·PageUp/PageDown(열 칸)·Home/End로 값을 옮깁니다.
 * 겉모양은 Ark의 data-part·data-disabled·data-dragging 속성에 CSS Modules를 연결합니다.
 */
export function RangeField(props: RangeFieldProps) {
  const hintId = `${createUniqueId()}-hint`
  const text = (value: number) => (props.format ? props.format(value) : String(value))
  return (
    <Slider.Root
      class={styles.field}
      min={props.min}
      max={props.max}
      step={props.step ?? 1}
      value={[props.value]}
      disabled={props.disabled}
      // 손잡이 너비만큼 양 끝을 안쪽으로 두면 첫 측정 전에 손잡이가 숨으므로 가운데 맞춤을 씁니다.
      thumbAlignment="center"
      getAriaValueText={(details) => text(details.value)}
      onValueChange={(details) => {
        const next = details.value[0]
        if (next !== undefined && next !== props.value) props.onInput(next)
      }}
    >
      <div class={styles.top}>
        <Slider.Label class={styles.label}>{props.label}</Slider.Label>
        <Slider.ValueText class={`${styles.output} numeric`}>{text(props.value)}</Slider.ValueText>
      </div>
      <Slider.Control class={styles.control}>
        <Slider.Track class={styles.track}>
          <Slider.Range class={styles.range} />
        </Slider.Track>
        <Slider.Thumb
          index={0}
          class={styles.thumb}
          aria-describedby={props.hint ? hintId : undefined}
        >
          <Slider.HiddenInput />
        </Slider.Thumb>
      </Slider.Control>
      <Show when={props.hint}>
        <p id={hintId} class={styles.hint}>
          {props.hint}
        </p>
      </Show>
    </Slider.Root>
  )
}
