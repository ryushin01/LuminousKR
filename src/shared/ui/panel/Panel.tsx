import { type JSX, Show, createUniqueId } from 'solid-js'
import styles from './Panel.module.css'

export type PanelProps = {
  title: string
  /** 제목 앞의 작은 번호 */
  number?: string
  /** 제목 아래 설명 */
  description?: JSX.Element
  actions?: JSX.Element
  children: JSX.Element
  class?: string
  headingLevel?: 2 | 3
}

/** 제목이 있는 반투명 판 (section + h2) */
export function Panel(props: PanelProps) {
  const id = createUniqueId()
  return (
    <section class={`${styles.panel} ${props.class ?? ''}`} aria-labelledby={id}>
      <div class={styles.head}>
        <div class={styles.titles}>
          <Show
            when={props.headingLevel === 3}
            fallback={
              <h2 id={id} class={styles.title}>
                <Show when={props.number}>
                  <span class={`${styles.number} numeric`}>{props.number}</span>
                </Show>
                {props.title}
              </h2>
            }
          >
            <h3 id={id} class={styles.title}>
              <Show when={props.number}>
                <span class={`${styles.number} numeric`}>{props.number}</span>
              </Show>
              {props.title}
            </h3>
          </Show>
          <Show when={props.description}>
            <p class={styles.description}>{props.description}</p>
          </Show>
        </div>
        <Show when={props.actions}>
          <div class={styles.actions}>{props.actions}</div>
        </Show>
      </div>
      {props.children}
    </section>
  )
}
