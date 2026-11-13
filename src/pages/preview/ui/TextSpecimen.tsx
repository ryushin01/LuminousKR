import { Show, createSignal } from 'solid-js'
import { createPreviewFont } from '@/entities/font'
import { formatBytes, formatNumber } from '@/shared/lib/format'
import { RangeField } from '@/shared/ui/range-field'
import { Segmented } from '@/shared/ui/segmented'
import { StatusMessage } from '@/shared/ui/status-message'
import { TextField } from '@/shared/ui/text-field'
import { SAMPLES, SAMPLE_IDS, type SampleId } from '../model/samples.ts'
import styles from './TextSpecimen.module.css'

/**
 * 글 견본: 입력한 글에 쓰인 글자만 담은 OTF를 워커에서 만들어 FontFace로 등록하고,
 * 브라우저가 그 글꼴 파일로 직접 글을 그리게 합니다 (줄바꿈·자간까지 실제와 같음).
 */
export function TextSpecimen() {
  const [sample, setSample] = createSignal<SampleId>('squirrel')
  const [text, setText] = createSignal(SAMPLES.squirrel.text)
  const [size, setSize] = createSignal(56)
  const [lineHeight, setLineHeight] = createSignal(150)
  const font = createPreviewFont(text)

  const choose = (id: SampleId) => {
    setSample(id)
    setText(SAMPLES[id].text)
  }

  const status = () => {
    if (font.state() === 'building') return '미리보기 글꼴을 만드는 중입니다…'
    if (font.state() === 'error')
      return '미리보기 글꼴을 만들지 못했습니다. 글을 조금 바꾸면 다시 만듭니다.'
    const glyphs = Math.max(0, font.glyphCount() - 2)
    return `이 글에 쓰인 한글 ${formatNumber(glyphs)}자를 담은 글꼴 파일(${formatBytes(font.bytes())})로 그렸습니다.`
  }

  return (
    <div class={styles.wrap}>
      <Segmented
        legend="견본 글"
        value={sample()}
        onChange={choose}
        size="small"
        options={SAMPLE_IDS.map((id) => ({ value: id, label: SAMPLES[id].label }))}
      />
      <TextField
        label="미리 볼 글"
        multiline
        rows={3}
        value={text()}
        maxLength={2000}
        onInput={setText}
        hint="한글 음절과 낱자(ㄱ, ㅏ …)는 만든 글꼴로, 영문·숫자·문장부호는 운영체제 글꼴로 보입니다."
      />
      <div class={styles.controls}>
        <RangeField
          label="글자 크기"
          value={size()}
          min={16}
          max={160}
          onInput={setSize}
          format={(v) => `${v}px`}
        />
        <RangeField
          label="줄 간격"
          value={lineHeight()}
          min={100}
          max={240}
          step={5}
          onInput={setLineHeight}
          format={(v) => `${v}%`}
        />
      </div>
      <figure class={styles.figure}>
        <p
          lang="ko"
          class={styles.specimen}
          classList={{ [styles.pending!]: font.state() === 'building' }}
          style={{
            'font-family': font.family()
              ? `"${font.family()}", var(--font-body)`
              : 'var(--font-body)',
            'font-size': `${size()}px`,
            'line-height': String(lineHeight() / 100),
          }}
        >
          {text()}
        </p>
        <Show when={SAMPLES[sample()].source && text() === SAMPLES[sample()].text}>
          <figcaption class={styles.source}>{SAMPLES[sample()].source}</figcaption>
        </Show>
      </figure>
      <StatusMessage message={status()} tone={font.state() === 'error' ? 'danger' : 'neutral'} />
    </div>
  )
}
