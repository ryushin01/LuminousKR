import { A } from '@solidjs/router'
import { For, Show, createMemo } from 'solid-js'
import { LAYOUT_INFO, fontProject, homeLayout, jamoLabel } from '@/entities/font'
import { formatNumber } from '@/shared/lib/format'
import { type EmptyJamo, precheckProject } from '../model/precheck.ts'
import styles from './ExportPage.module.css'

/** 작업실에서 그 자모·배치를 여는 주소 */
export function studioHref(item: Pick<EmptyJamo, 'key' | 'layout'>): string {
  const layout = item.layout === homeLayout(item.key) ? '' : `&layout=${item.layout}`
  return `/studio?jamo=${item.key}${layout}`
}

/** 비어 있는 배치가 기본 배치가 아니면 어느 배치인지 */
function layoutNote(item: EmptyJamo): string {
  if (item.layouts.includes(homeLayout(item.key))) return ''
  return ` ('${item.layouts.map((id) => LAYOUT_INFO[id].sample).join('·')}' 배치)`
}

/**
 * 내보내기 전 점검: 획이 없는 자모와 그 때문에 획이 빠지는 음절 수를 알리고, 작업실의 그 자모로 보냅니다.
 */
export function ExportCheck() {
  const check = createMemo(() => precheckProject(fontProject))
  return (
    <Show
      when={check().empty.length > 0}
      fallback={<p class={styles.checkOk}>빈 자모가 없습니다. 11,172자가 모두 그려집니다.</p>}
    >
      <p class={styles.checkNote}>
        획이 없는 자모가 <strong class="numeric">{check().empty.length}</strong>개 있어 음절{' '}
        <strong class="numeric">{formatNumber(check().affectedSyllables)}</strong>자에서 획이
        빠집니다. 그대로 만들 수도 있지만, 작업실에서 그린 뒤 만드는 것을 권합니다.
      </p>
      <ul class={styles.issues}>
        <For each={check().empty}>
          {(item) => (
            <li>
              <A class={styles.issue} href={studioHref(item)}>
                <strong>{jamoLabel(item.key)}</strong>
                {layoutNote(item)} 그리기
                <span class={`${styles.issueCount} numeric`}>{formatNumber(item.syllables)}자</span>
              </A>
            </li>
          )}
        </For>
      </ul>
    </Show>
  )
}
