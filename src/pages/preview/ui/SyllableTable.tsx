import { For, createMemo, createSignal, createUniqueId } from 'solid-js'
import { GlyphView, type RenderItem, createRenderedGlyphs } from '@/entities/font'
import {
  LEAD_NAMES,
  LEADS,
  TAILS,
  TAIL_COUNT,
  VOWELS,
  VOWEL_COUNT,
  composeSyllable,
} from '@/shared/lib/hangul'
import { SelectField } from '@/shared/ui/select-field'
import styles from './SyllableTable.module.css'

const VOWEL_INDEXES = Array.from({ length: VOWEL_COUNT }, (_, i) => i)
const TAIL_INDEXES = Array.from({ length: TAIL_COUNT }, (_, i) => i)

/** 초성 하나를 고르면 그 초성의 588자(중성 21 × 종성 28)를 표로 보여 줍니다. 19개를 넘기면 11,172자 전부입니다. */
export function SyllableTable() {
  const captionId = createUniqueId()
  const [lead, setLead] = createSignal(0)
  const items = createMemo<RenderItem[]>(() =>
    VOWEL_INDEXES.flatMap((v) =>
      TAIL_INDEXES.map((t) => ({ type: 'char' as const, char: composeSyllable(lead(), v, t) })),
    ),
  )
  const glyphs = createRenderedGlyphs(items)

  return (
    <div class={styles.wrap}>
      <div class={styles.picker}>
        <SelectField
          label="초성"
          value={String(lead())}
          onChange={(v) => setLead(Number(v))}
          options={LEADS.map((char, i) => ({
            value: String(i),
            label: `${char} (${LEAD_NAMES[i]})`,
          }))}
          hint="초성을 바꿔 가며 19개를 모두 보면 11,172자 전부입니다."
        />
      </div>
      <div class={styles.scroll} role="region" aria-labelledby={captionId} tabindex="0">
        <table class={styles.table}>
          <caption id={captionId} class={styles.caption}>
            초성 {LEADS[lead()]} 음절 588자 (가로: 종성, 세로: 중성)
          </caption>
          <thead>
            <tr>
              <th scope="col" class={styles.corner}>
                <span class="visually-hidden">중성 \ 종성</span>
              </th>
              <For each={TAIL_INDEXES}>
                {(t) => (
                  <th scope="col" class={styles.colHead}>
                    {t === 0 ? <span title="받침 없음">없음</span> : TAILS[t]}
                  </th>
                )}
              </For>
            </tr>
          </thead>
          <tbody>
            <For each={VOWEL_INDEXES}>
              {(v) => (
                <tr>
                  <th scope="row" class={styles.rowHead}>
                    {VOWELS[v]}
                  </th>
                  <For each={TAIL_INDEXES}>
                    {(t) => (
                      <td class={styles.cell}>
                        <GlyphView glyph={glyphs()?.[v * TAIL_COUNT + t]} class={styles.glyph} />
                        <span class="visually-hidden">{composeSyllable(lead(), v, t)}</span>
                      </td>
                    )}
                  </For>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </div>
  )
}
