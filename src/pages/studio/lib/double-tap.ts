/** 누른 시각(ms)과 화면 위치(CSS px) */
export type Press = { time: number; x: number; y: number }

/** 이 시간 안에 */
export const DOUBLE_TAP_MS = 350
/** 이 거리 안을 다시 누르면 두 번 누르기 (손가락은 조금씩 어긋나므로 넉넉히) */
export const DOUBLE_TAP_PX = 24

/**
 * 손가락·펜으로 가까운 자리를 짧은 간격으로 두 번 누른 것인지.
 * iOS Safari는 두 번 톡에 dblclick을 보내지 않고, 어긋난 두 톡은 같은 점 판정(마지막 점을 다시 누르면 마침)에도 걸리지 않아
 * 그리기 판이 직접 알아봅니다. 마우스는 운영체제의 두 번 누르기 속도를 따르는 브라우저 dblclick에 맡깁니다.
 */
export function isDoubleTap(previous: Press | null, next: Press): boolean {
  if (!previous) return false
  const elapsed = next.time - previous.time
  const distance = Math.hypot(next.x - previous.x, next.y - previous.y)
  return elapsed >= 0 && elapsed <= DOUBLE_TAP_MS && distance <= DOUBLE_TAP_PX
}
