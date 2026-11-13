import { Show } from 'solid-js'
import { type CapStyle, type JoinStyle, editProject, fontProject } from '@/entities/font'
import { RangeField } from '@/shared/ui/range-field'
import { Segmented } from '@/shared/ui/segmented'
import styles from './StylePanel.module.css'

const CAPS: { value: CapStyle; label: string; description: string }[] = [
  { value: 'round', label: '둥근 끝', description: '획 끝을 반원으로 둥글게' },
  { value: 'square', label: '각진 끝', description: '획 끝을 굵기의 절반만큼 네모로 늘임' },
  { value: 'butt', label: '잘린 끝', description: '획 끝을 뼈대 끝에서 바로 자름' },
]

const JOINS: { value: JoinStyle; label: string; description: string }[] = [
  { value: 'round', label: '둥근 꺾임', description: '꺾이는 곳을 둥글게' },
  { value: 'miter', label: '뾰족 꺾임', description: '꺾이는 곳을 뾰족하게' },
  { value: 'bevel', label: '깎은 꺾임', description: '꺾이는 곳의 모서리를 비스듬히 깎음' },
]

/**
 * 획 스타일: 바꾸면 11,172자 전체에 한꺼번에 적용됩니다.
 * 슬라이더를 끄는 동안의 변경은 되돌리기 한 번으로 묶습니다.
 */
export function StylePanel(props: { showMetrics?: boolean }) {
  const style = () => fontProject.style
  const metrics = () => fontProject.metrics
  return (
    <div class={styles.panel}>
      <RangeField
        label="굵기"
        value={style().weight}
        min={30}
        max={180}
        onInput={(v) => editProject((d) => void (d.style.weight = v), { coalesce: 'style-weight' })}
        format={(v) => `${v} 단위`}
        hint="세로획 굵기입니다 (1em = 1000 단위)."
      />
      <RangeField
        label="가로획 대비"
        value={Math.round(style().contrast * 100)}
        min={30}
        max={100}
        onInput={(v) =>
          editProject((d) => void (d.style.contrast = v / 100), { coalesce: 'style-contrast' })
        }
        format={(v) => `${v}%`}
        hint="가로획을 세로획보다 얼마나 가늘게 할지 정합니다."
      />
      <RangeField
        label="기울기"
        value={style().slant}
        min={0}
        max={15}
        onInput={(v) => editProject((d) => void (d.style.slant = v), { coalesce: 'style-slant' })}
        format={(v) => `${v}도`}
      />
      <Segmented
        legend="획 끝 모양"
        size="small"
        value={style().cap}
        onChange={(v) => editProject((d) => void (d.style.cap = v))}
        options={CAPS}
      />
      <Segmented
        legend="꺾이는 곳 모양"
        size="small"
        value={style().join}
        onChange={(v) => editProject((d) => void (d.style.join = v))}
        options={JOINS}
      />
      <Show when={props.showMetrics}>
        <RangeField
          label="글자 너비"
          value={metrics().advance}
          min={800}
          max={1100}
          step={10}
          onInput={(v) =>
            editProject((d) => void (d.metrics.advance = v), { coalesce: 'metrics-advance' })
          }
          format={(v) => `${v} 단위`}
        />
        <RangeField
          label="글자 높이"
          value={metrics().height}
          min={700}
          max={960}
          step={10}
          onInput={(v) =>
            editProject((d) => void (d.metrics.height = v), { coalesce: 'metrics-height' })
          }
          format={(v) => `${v} 단위`}
          hint="획 바깥까지 포함한 글자 몸의 높이입니다."
        />
        <RangeField
          label="좌우 여백"
          value={metrics().sideBearing}
          min={0}
          max={120}
          step={2}
          onInput={(v) =>
            editProject((d) => void (d.metrics.sideBearing = v), { coalesce: 'metrics-side' })
          }
          format={(v) => `${v} 단위`}
        />
      </Show>
    </div>
  )
}
