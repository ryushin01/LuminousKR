import { type JSX, Show } from 'solid-js'
import styles from './PageHeader.module.css'

export type PageHeaderProps = {
  /** 메뉴 번호 (01 …) */
  number: string
  /** 화면 이름 (작업실 …) */
  label: string
  title: JSX.Element
  lead?: JSX.Element
  children?: JSX.Element
}

/** 화면 위쪽: 번호 붙은 이름과 큰 제목(h1) */
export function PageHeader(props: PageHeaderProps) {
  return (
    <header class={styles.header}>
      <p class={styles.eyebrow}>
        <span class={`${styles.number} numeric`}>{props.number}</span>
        <span aria-hidden="true">—</span>
        {props.label}
      </p>
      <h1 class={styles.title}>{props.title}</h1>
      <Show when={props.lead}>
        <p class={styles.lead}>{props.lead}</p>
      </Show>
      {props.children}
    </header>
  )
}
