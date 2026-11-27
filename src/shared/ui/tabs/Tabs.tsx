import { Tabs as ArkTabs } from '@ark-ui/solid/tabs'
import { For, type JSX } from 'solid-js'
import styles from './Tabs.module.css'

export type TabItem<T extends string> = {
  id: T
  label: JSX.Element
  panel: () => JSX.Element
}

export type TabsProps<T extends string> = {
  /** 탭 목록의 이름 (보이는 제목이 있으면 labelledBy를 씀) */
  label?: string
  labelledBy?: string
  items: readonly TabItem<T>[]
  selected: T
  onSelect: (id: T) => void
  class?: string
}

/**
 * WAI-ARIA APG 탭(자동 활성화, Ark UI Tabs).
 * 좌우 화살표·Home·End로 이동하고(끝에서 처음으로 돌아감), 선택된 탭만 Tab 키 순서에 들어갑니다.
 * 고른 탭은 Ark의 aria-selected·data-selected로 그립니다.
 */
export function Tabs<T extends string>(props: TabsProps<T>) {
  const find = (value: string | null) => props.items.find((item) => item.id === value)
  return (
    <ArkTabs.Root
      class={props.class}
      value={props.selected}
      // 자동 활성화는 아래 탭의 onFocus에서 직접 합니다. Ark(zag)의 자동 활성화는 초점 이동과
      // 선택을 서로 다른 화면 그리기 때 처리해, 이전 초점의 탭을 고르는 경우가 있었습니다.
      activationMode="manual"
      loopFocus
      onValueChange={(details) => {
        const item = find(details.value)
        if (item && item.id !== props.selected) props.onSelect(item.id)
      }}
    >
      <ArkTabs.List
        class={styles.list}
        aria-label={props.labelledBy ? undefined : props.label}
        aria-labelledby={props.labelledBy}
      >
        <For each={props.items}>
          {(item) => (
            <ArkTabs.Trigger
              class={styles.tab}
              value={item.id}
              // 자동 활성화: 화살표·Home·End로 초점이 옮겨 오면 바로 고릅니다.
              onFocus={() => {
                if (item.id !== props.selected) props.onSelect(item.id)
              }}
            >
              {item.label}
            </ArkTabs.Trigger>
          )}
        </For>
      </ArkTabs.List>
      <For each={props.items}>
        {(item) => (
          <ArkTabs.Content class={styles.panel} value={item.id}>
            {item.panel()}
          </ArkTabs.Content>
        )}
      </For>
    </ArkTabs.Root>
  )
}
