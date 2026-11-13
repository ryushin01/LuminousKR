/**
 * 한글 음절 조합 표 (유니코드 표준 Hangul Syllables, U+AC00–U+D7A3)
 *
 * 음절 = 0xAC00 + (초성 × 21 + 중성) × 28 + 종성
 */

export const SYLLABLE_BASE = 0xac00
export const LEAD_COUNT = 19
export const VOWEL_COUNT = 21
export const TAIL_COUNT = 28
export const SYLLABLE_COUNT = LEAD_COUNT * VOWEL_COUNT * TAIL_COUNT // 11,172
export const SYLLABLE_LAST = SYLLABLE_BASE + SYLLABLE_COUNT - 1

/** 초성 19자 (호환 자모 글자로 표시) */
export const LEADS = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const // prettier-ignore

/** 중성 21자 */
export const VOWELS = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ',
  'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
] as const // prettier-ignore

/** 종성 27자 + 받침 없음(0번) */
export const TAILS = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ',
  'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const // prettier-ignore

export const LEAD_NAMES = [
  '기역', '쌍기역', '니은', '디귿', '쌍디귿', '리을', '미음', '비읍', '쌍비읍', '시옷',
  '쌍시옷', '이응', '지읒', '쌍지읒', '치읓', '키읔', '티읕', '피읖', '히읗',
] as const // prettier-ignore

export const VOWEL_NAMES = [
  '아', '애', '야', '얘', '어', '에', '여', '예', '오', '와', '왜',
  '외', '요', '우', '워', '웨', '위', '유', '으', '의', '이',
] as const // prettier-ignore

export const TAIL_NAMES = [
  '', '기역', '쌍기역', '기역시옷', '니은', '니은지읒', '니은히읗', '디귿', '리을',
  '리을기역', '리을미음', '리을비읍', '리을시옷', '리을티읕', '리을피읖', '리을히읗',
  '미음', '비읍', '비읍시옷', '시옷', '쌍시옷', '이응', '지읒', '치읓', '키읔', '티읕',
  '피읖', '히읗',
] as const // prettier-ignore

/**
 * 중성의 모양 갈래
 * - vertical: 세로 모음(ㅏ ㅐ ㅑ ㅒ ㅓ ㅔ ㅕ ㅖ ㅣ) — 초성 오른쪽에 놓임
 * - horizontal: 가로 모음(ㅗ ㅛ ㅜ ㅠ ㅡ) — 초성 아래에 놓임
 * - mixed: 섞임 모음(ㅘ ㅙ ㅚ ㅝ ㅞ ㅟ ㅢ) — 아래와 오른쪽을 함께 감쌈
 */
export type VowelShape = 'vertical' | 'horizontal' | 'mixed'

const VOWEL_SHAPES: readonly VowelShape[] = [
  'vertical', 'vertical', 'vertical', 'vertical', 'vertical', 'vertical', 'vertical',
  'vertical', 'horizontal', 'mixed', 'mixed', 'mixed', 'horizontal', 'horizontal',
  'mixed', 'mixed', 'mixed', 'horizontal', 'horizontal', 'mixed', 'vertical',
] // prettier-ignore

export function vowelShape(vowel: number): VowelShape {
  const shape = VOWEL_SHAPES[vowel]
  if (!shape) throw new RangeError(`중성 번호가 범위를 벗어났습니다: ${vowel}`)
  return shape
}

export type SyllableParts = { lead: number; vowel: number; tail: number }

export function isSyllableCode(code: number): boolean {
  return code >= SYLLABLE_BASE && code <= SYLLABLE_LAST
}

export function composeCode(lead: number, vowel: number, tail = 0): number {
  if (lead < 0 || lead >= LEAD_COUNT || vowel < 0 || vowel >= VOWEL_COUNT) {
    throw new RangeError(`초성·중성 번호가 범위를 벗어났습니다: ${lead}, ${vowel}`)
  }
  if (tail < 0 || tail >= TAIL_COUNT) {
    throw new RangeError(`종성 번호가 범위를 벗어났습니다: ${tail}`)
  }
  return SYLLABLE_BASE + (lead * VOWEL_COUNT + vowel) * TAIL_COUNT + tail
}

export function composeSyllable(lead: number, vowel: number, tail = 0): string {
  return String.fromCharCode(composeCode(lead, vowel, tail))
}

export function decomposeCode(code: number): SyllableParts | null {
  if (!isSyllableCode(code)) return null
  const index = code - SYLLABLE_BASE
  return {
    lead: Math.floor(index / (VOWEL_COUNT * TAIL_COUNT)),
    vowel: Math.floor((index % (VOWEL_COUNT * TAIL_COUNT)) / TAIL_COUNT),
    tail: index % TAIL_COUNT,
  }
}

export function decomposeSyllable(char: string): SyllableParts | null {
  const code = char.codePointAt(0)
  return code === undefined ? null : decomposeCode(code)
}

/** 문자열에서 한글 음절만 중복 없이 순서대로 뽑습니다. */
export function uniqueSyllables(text: string): string[] {
  const seen = new Set<string>()
  for (const char of text) {
    const code = char.codePointAt(0)
    if (code !== undefined && isSyllableCode(code)) seen.add(char)
  }
  return [...seen]
}

/* ── 호환 자모(U+3131–U+3163): 낱자 입력을 위한 글리프 ── */

export const COMPAT_JAMO_FIRST = 0x3131
export const COMPAT_JAMO_LAST = 0x3163

/** 호환 자모 자음 30자 순서 (U+3131–U+314E) */
export const COMPAT_CONSONANTS = [
  'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ',
  'ㅀ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const // prettier-ignore

export function isCompatJamoCode(code: number): boolean {
  return code >= COMPAT_JAMO_FIRST && code <= COMPAT_JAMO_LAST
}
