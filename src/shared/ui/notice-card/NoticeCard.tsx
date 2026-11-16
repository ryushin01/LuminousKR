import type { JSX } from 'solid-js'
import styles from './NoticeCard.module.css'

export type NoticeCardProps = {
  /** 보여 줄 알림이 있는지. 없을 때도 안의 상태·경고 영역은 DOM에 남습니다. */
  active: boolean
  children: JSX.Element
}

/**
 * 화면 위에 떠 있는 알림 카드(반투명 패널 모양). 떠 있는 자리는 쓰는 쪽 레이아웃이 정합니다.
 * 알림이 없을 때는 화면에서만 숨기고(display: none 금지) 접근성 트리에는 남겨, 바뀐 글자를 화면 낭독기가 읽게 합니다.
 */
export function NoticeCard(props: NoticeCardProps) {
  return (
    <div class={styles.card} classList={{ [styles.active!]: props.active }}>
      {props.children}
    </div>
  )
}

export type NoticeMessageProps = {
  /** status: 결과 알림(polite), alert: 시간에 민감한 경고(assertive) */
  role: 'status' | 'alert'
  tone?: 'neutral' | 'danger'
  children?: JSX.Element
}

/** 카드 안의 상태·경고 영역. 처음부터 두고 글자만 바꿉니다. */
export function NoticeMessage(props: NoticeMessageProps) {
  return (
    <p
      role={props.role}
      class={styles.text}
      classList={{ [styles.danger!]: props.tone === 'danger' }}
    >
      {props.children}
    </p>
  )
}

/** 카드 안의 버튼 줄 (상태·경고 영역 밖에 둡니다) */
export function NoticeActions(props: { children: JSX.Element }) {
  return <div class={styles.actions}>{props.children}</div>
}
