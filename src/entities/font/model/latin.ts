/**
 * 영문·숫자·문장부호: ASCII 인쇄 글자 94자(U+0021~U+007E).
 * 한글 자모처럼 획의 뼈대만 그리고, 굵기·대비·끝 모양·이음·기울기는 프로젝트의 획 스타일을 함께 씁니다.
 * 빈칸(U+0020)은 원래 글꼴에 따로 들어 있습니다.
 */
import { presetLatin } from './latin-preset.ts'
import type { FontProject, Stroke } from './types.ts'

export { LATIN_GUIDES } from './latin-preset.ts'

export const LATIN_FIRST = 0x21
export const LATIN_LAST = 0x7e

/** 94자 (번호 차례) */
export const LATIN_CHARS: readonly string[] = Array.from(
  { length: LATIN_LAST - LATIN_FIRST + 1 },
  (_, i) => String.fromCharCode(LATIN_FIRST + i),
)

export const isLatinCode = (code: number): boolean => code >= LATIN_FIRST && code <= LATIN_LAST

export const isLatinChar = (value: string): boolean =>
  value.length === 1 && isLatinCode(value.charCodeAt(0))

export type LatinGroup = 'upper' | 'lower' | 'digit' | 'symbol'

export function latinGroup(char: string): LatinGroup {
  if (char >= 'A' && char <= 'Z') return 'upper'
  if (char >= 'a' && char <= 'z') return 'lower'
  if (char >= '0' && char <= '9') return 'digit'
  return 'symbol'
}

/** 기호 32자의 이름 (화면 낭독기와 작업실 제목에 씀) */
const SYMBOL_NAMES: Readonly<Record<string, string>> = {
  '!': '느낌표',
  '"': '큰따옴표',
  '#': '샵',
  $: '달러',
  '%': '퍼센트',
  '&': '앰퍼샌드',
  "'": '작은따옴표',
  '(': '여는 괄호',
  ')': '닫는 괄호',
  '*': '별표',
  '+': '더하기',
  ',': '쉼표',
  '-': '붙임표',
  '.': '마침표',
  '/': '빗금',
  ':': '쌍점',
  ';': '쌍반점',
  '<': '작음 기호',
  '=': '등호',
  '>': '큼 기호',
  '?': '물음표',
  '@': '골뱅이',
  '[': '여는 대괄호',
  '\\': '역빗금',
  ']': '닫는 대괄호',
  '^': '캐럿',
  _: '밑줄',
  '`': '억음 부호',
  '{': '여는 중괄호',
  '|': '세로 막대',
  '}': '닫는 중괄호',
  '~': '물결표',
}

/** 예: '대문자 A', '소문자 a', '숫자 0', '물음표 ?' */
export function latinLabel(char: string): string {
  switch (latinGroup(char)) {
    case 'upper':
      return `대문자 ${char}`
    case 'lower':
      return `소문자 ${char}`
    case 'digit':
      return `숫자 ${char}`
    default:
      return `${SYMBOL_NAMES[char] ?? '기호'} ${char}`
  }
}

/** 이 글자의 그림: 직접 그린 것, 없으면 기본 뼈대 */
export function latinDrawing(
  project: FontProject,
  char: string,
): { readonly strokes: readonly Stroke[] } {
  return project.latin[char]?.drawing ?? { strokes: presetLatin(char)?.strokes ?? [] }
}

/** 기본 뼈대의 너비 (틀 높이 = 1) */
export function defaultLatinWidth(char: string): number {
  return presetLatin(char)?.width ?? 0.5
}

/** 이 글자의 뼈대 너비 (틀 높이 = 1): 고친 너비, 없으면 기본 너비 */
export function latinWidth(project: FontProject, char: string): number {
  return project.latin[char]?.width ?? defaultLatinWidth(char)
}
