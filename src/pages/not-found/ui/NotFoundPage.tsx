import { For } from 'solid-js'
import { A } from '@solidjs/router'
import { NAV_ITEMS } from '@/shared/config'
import { usePageTitle } from '@/shared/lib/page'
import { PageHeader } from '@/shared/ui/page-header'
import styles from './NotFoundPage.module.css'

export function NotFoundPage() {
  usePageTitle('없는 화면')
  return (
    <div class={styles.page}>
      <PageHeader
        number="404"
        label="없는 화면"
        title="빛이 닿지 않는 곳입니다"
        lead="주소가 바뀌었거나 잘못 입력되었습니다. 아래에서 가려던 화면을 골라 주세요."
      />
      <nav class={styles.nav} aria-label="다른 화면으로">
        <ul class={styles.list}>
          <For each={NAV_ITEMS}>
            {(item) => (
              <li>
                <A href={item.path} end={item.path === '/'} class={styles.link}>
                  <span class={`${styles.number} numeric`}>{item.number}</span>
                  {item.label}
                </A>
              </li>
            )}
          </For>
        </ul>
      </nav>
    </div>
  )
}
