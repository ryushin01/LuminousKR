import { describe, expect, it } from 'vitest'
import { isEditingText, undoShortcutOf } from './undoShortcuts.ts'

const input = (type: string) => Object.assign(document.createElement('input'), { type })

function key(target: EventTarget, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, ...init })
  Object.defineProperty(event, 'target', { value: target })
  return event
}

describe('되돌리기 단축키', () => {
  it('글자를 입력하는 칸만 입력 중으로 봅니다 (라디오·체크박스·슬라이더·셀렉트·버튼은 아님)', () => {
    for (const type of ['text', 'search', 'number', 'email'])
      expect(isEditingText(input(type))).toBe(true)
    expect(isEditingText(document.createElement('textarea'))).toBe(true)
    for (const type of ['radio', 'checkbox', 'range', 'file', 'button']) {
      expect(isEditingText(input(type))).toBe(false)
    }
    expect(isEditingText(document.createElement('select'))).toBe(false)
    expect(isEditingText(document.createElement('button'))).toBe(false)
    expect(isEditingText(null)).toBe(false)
  })

  it('Ctrl·⌘ + Z는 되돌리기, Shift를 함께 누르거나 Ctrl + Y는 다시하기', () => {
    const radio = input('radio')
    expect(undoShortcutOf(key(radio, { key: 'z', ctrlKey: true }))).toBe('undo')
    expect(undoShortcutOf(key(radio, { key: 'Z', metaKey: true, shiftKey: true }))).toBe('redo')
    expect(undoShortcutOf(key(radio, { key: 'y', ctrlKey: true }))).toBe('redo')
    expect(undoShortcutOf(key(radio, { key: 'z' }))).toBeNull()
    expect(undoShortcutOf(key(radio, { key: 'z', ctrlKey: true, altKey: true }))).toBeNull()
    // 글자 입력 중에는 입력칸의 기본 되돌리기에 맡깁니다.
    expect(undoShortcutOf(key(input('text'), { key: 'z', ctrlKey: true }))).toBeNull()
  })
})
