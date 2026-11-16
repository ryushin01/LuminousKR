import { onCleanup, onMount } from 'solid-js'
import { redo, undo } from '@/entities/font'

/** 글자를 입력하는 칸의 type (이 칸에서는 브라우저의 글자 되돌리기를 씀) */
const TEXT_INPUT_TYPES = new Set([
  'text',
  'search',
  'email',
  'url',
  'tel',
  'password',
  'number',
  'date',
  'datetime-local',
  'month',
  'week',
  'time',
])

/**
 * 글자를 입력하는 중인지. 라디오·체크박스·슬라이더·셀렉트·버튼은 입력 중이 아니므로
 * 이때는 프로젝트 되돌리기가 듣습니다(도구를 고르면 초점이 라디오에 있으므로 자주 있는 경우).
 */
export function isEditingText(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) return true
  return target instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(target.type)
}

/** 키 입력이 되돌리기·다시하기 단축키면 그 동작을, 아니면 null */
export function undoShortcutOf(event: KeyboardEvent): 'undo' | 'redo' | null {
  if (!(event.metaKey || event.ctrlKey) || event.altKey || isEditingText(event.target)) return null
  const key = event.key.toLowerCase()
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo'
  if (key === 'y' && !event.shiftKey) return 'redo'
  return null
}

/**
 * 되돌리기 Ctrl·⌘ + Z, 다시하기 Ctrl·⌘ + Shift + Z 또는 Ctrl + Y.
 * 되돌리기 기록은 앱 전체 공통이라 모든 화면에서 듣습니다(글자 입력 중에는 입력칸의 기본 동작).
 */
export function useUndoShortcuts(): void {
  const onKeyDown = (event: KeyboardEvent) => {
    const action = undoShortcutOf(event)
    if (!action) return
    event.preventDefault()
    if (action === 'undo') undo()
    else redo()
  }
  onMount(() => document.addEventListener('keydown', onKeyDown))
  onCleanup(() => document.removeEventListener('keydown', onKeyDown))
}
