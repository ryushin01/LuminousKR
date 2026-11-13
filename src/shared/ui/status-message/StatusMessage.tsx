import styles from './StatusMessage.module.css'

export type StatusMessageProps = {
  message: string
  /** status: 결과·진행 알림(polite), alert: 시간에 민감한 오류(assertive) */
  kind?: 'status' | 'alert'
  tone?: 'neutral' | 'success' | 'danger'
  /** 화면에는 숨기고 보조기기에만 읽힐 때 */
  hidden?: boolean
  class?: string
}

/**
 * 상태 메시지 영역. 처음부터 DOM에 두고 글자만 바꿔야 화면 낭독기가 읽습니다.
 * role의 기본 값(polite·assertive, atomic)과 겹치는 aria-live는 쓰지 않습니다.
 */
export function StatusMessage(props: StatusMessageProps) {
  return (
    <p
      role={props.kind ?? 'status'}
      class={[
        props.hidden ? 'visually-hidden' : styles.message,
        styles[props.tone ?? 'neutral'],
        props.class ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {props.message}
    </p>
  )
}
