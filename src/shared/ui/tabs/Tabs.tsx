import { For, type JSX, createUniqueId } from 'solid-js'
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
 * WAI-ARIA APG 탭 (자동 활성화)
 * 좌우 화살표·Home·End로 이동하고, 선택된 탭만 Tab 키 순서에 들어갑니다(roving tabindex).
 */
export function Tabs<T extends string>(props: TabsProps<T>) {
  const base = createUniqueId()
  const tabId = (id: T) => `${base}-tab-${id}`
  const panelId = (id: T) => `${base}-panel-${id}`
  let list!: HTMLDivElement

  const focusTab = (index: number) => {
    const items = props.items
    const next = items[(index + items.length) % items.length]
    if (!next) return
    props.onSelect(next.id)
    list.querySelector<HTMLButtonElement>(`#${CSS.escape(tabId(next.id))}`)?.focus()
  }

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const keys: Record<string, () => void> = {
      ArrowRight: () => focusTab(index + 1),
      ArrowLeft: () => focusTab(index - 1),
      Home: () => focusTab(0),
      End: () => focusTab(props.items.length - 1),
    }
    const action = keys[event.key]
    if (action) {
      event.preventDefault()
      action()
    }
  }

  return (
    <div class={props.class}>
      <div
        ref={list}
        role="tablist"
        aria-label={props.labelledBy ? undefined : props.label}
        aria-labelledby={props.labelledBy}
        class={styles.list}
      >
        <For each={props.items}>
          {(item, index) => {
            const selected = () => props.selected === item.id
            return (
              <button
                type="button"
                role="tab"
                id={tabId(item.id)}
                class={styles.tab}
                aria-selected={selected() ? 'true' : 'false'}
                aria-controls={panelId(item.id)}
                tabindex={selected() ? 0 : -1}
                onClick={() => props.onSelect(item.id)}
                onKeyDown={(event) => onKeyDown(event, index())}
              >
                {item.label}
              </button>
            )
          }}
        </For>
      </div>
      <For each={props.items}>
        {(item) => (
          <div
            role="tabpanel"
            id={panelId(item.id)}
            aria-labelledby={tabId(item.id)}
            tabindex="0"
            class={styles.panel}
            hidden={props.selected !== item.id}
          >
            {item.panel()}
          </div>
        )}
      </For>
    </div>
  )
}
