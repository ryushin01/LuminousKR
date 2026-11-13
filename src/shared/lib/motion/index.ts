import { createSignal } from 'solid-js'

const STORAGE_KEY = 'luminous-kr:motion-paused'

function initial(): boolean {
  try {
    const saved = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (saved !== null && saved !== undefined) return saved === 'true'
  } catch {
    // 저장소를 못 쓰면 운영체제 설정만 따릅니다.
  }
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

const [paused, setPaused] = createSignal(initial())

/** 배경 애니메이션을 멈췄는지 (KWCAG 6.2.2 정지 기능). 기본값은 운영체제의 '동작 줄이기' 설정 */
export const motionPaused = paused

export function setMotionPaused(value: boolean): void {
  setPaused(value)
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, String(value))
  } catch {
    // 이번 방문에서만 유지됩니다.
  }
}
