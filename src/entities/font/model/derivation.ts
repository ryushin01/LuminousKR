import { relativeBox } from './layout.ts'
import type { Box, JamoKey, LayoutId, LayoutSet } from './types.ts'

/**
 * 파생 규칙: 직접 그리지 않은 자모를 다른 자모로 만듭니다.
 * - 겹자음(ㄲ ㄸ ㅃ ㅆ ㅉ)과 겹받침(ㄳ ㄵ … ㅄ): 두 자음을 나란히
 * - ㅐ ㅒ ㅔ ㅖ: 세로 모음 + ㅣ
 * - 섞임 모음(ㅘ ㅙ ㅚ ㅝ ㅞ ㅟ ㅢ): 가로 모음 + 세로 모음
 * - 받침: 같은 초성의 기본 획을 받침 틀에 맞춤
 */
export type DerivedPart = {
  key: JamoKey
  /** 자모 틀 안의 상대 위치 */
  rel: Box
  /** 부분 자모의 같은 배치 변형(벌)을 이어받을지 (같은 자리의 자모일 때만) */
  inherit: boolean
}

const FULL: Box = { x0: 0, y0: 0, x1: 1, y1: 1 }

const DOUBLE_LEADS: Record<number, number> = { 1: 0, 4: 3, 8: 7, 10: 9, 13: 12 }

/** [왼쪽 모음, 오른쪽 ㅣ, 왼쪽 모음이 차지하는 폭] */
const VOWEL_PAIRS: Record<number, [number, number, number]> = {
  1: [0, 20, 0.66],
  3: [2, 20, 0.66],
  5: [4, 20, 0.6],
  7: [6, 20, 0.6],
}

/** 섞임 모음 = [가로 모음, 세로 모음] */
const MIXED_VOWELS: Record<number, [number, number]> = {
  9: [8, 0],
  10: [8, 1],
  11: [8, 20],
  14: [13, 4],
  15: [13, 5],
  16: [13, 20],
  19: [18, 20],
}

/** 홑받침 = 같은 초성 */
const TAIL_FROM_LEAD: Record<number, number> = {
  1: 0, 4: 2, 7: 3, 8: 5, 16: 6, 17: 7, 19: 9, 21: 11, 22: 12, 23: 14, 24: 15, 25: 16, 26: 17, 27: 18,
} // prettier-ignore

/** 쌍받침·겹받침 = [왼쪽 받침, 오른쪽 받침] */
const TAIL_PAIRS: Record<number, [number, number]> = {
  2: [1, 1],
  3: [1, 19],
  5: [4, 22],
  6: [4, 27],
  9: [8, 1],
  10: [8, 16],
  11: [8, 17],
  12: [8, 19],
  13: [8, 25],
  14: [8, 26],
  15: [8, 27],
  18: [17, 19],
  20: [19, 19],
}

function halves(gap: number): [Box, Box] {
  const g = Math.min(0.4, Math.max(0.02, gap)) / 2
  return [
    { x0: 0, y0: 0, x1: 0.5 - g, y1: 1 },
    { x0: 0.5 + g, y0: 0, x1: 1, y1: 1 },
  ]
}

/**
 * 파생 규칙이 있으면 부분 목록을, 없으면 null을 돌려줍니다.
 * @param gap 나란히 놓는 두 자모 사이 간격 (틀 너비에 대한 비율)
 */
export function derivationOf(
  key: JamoKey,
  layout: LayoutId,
  layouts: LayoutSet,
  gap: number,
): DerivedPart[] | null {
  const role = key[0]
  const index = Number(key.slice(1))

  if (role === 'L') {
    const single = DOUBLE_LEADS[index]
    if (single === undefined) return null
    const [left, right] = halves(gap)
    return [
      { key: `L${single}`, rel: left, inherit: true },
      { key: `L${single}`, rel: right, inherit: true },
    ]
  }

  if (role === 'V') {
    const pair = VOWEL_PAIRS[index]
    if (pair) {
      const [first, second, width] = pair
      return [
        { key: `V${first}`, rel: { x0: 0, y0: 0, x1: width, y1: 1 }, inherit: true },
        { key: `V${second}`, rel: { x0: 0.5, y0: 0, x1: 1, y1: 1 }, inherit: true },
      ]
    }
    const mixed = MIXED_VOWELS[index]
    if (mixed) {
      const boxes = layouts[layout].Vh && layouts[layout].Vv ? layouts[layout] : layouts.C
      const [horizontal, vertical] = mixed
      return [
        { key: `V${horizontal}`, rel: relativeBox(boxes.V, boxes.Vh!), inherit: false },
        { key: `V${vertical}`, rel: relativeBox(boxes.V, boxes.Vv!), inherit: false },
      ]
    }
    return null
  }

  const lead = TAIL_FROM_LEAD[index]
  if (lead !== undefined) return [{ key: `L${lead}`, rel: FULL, inherit: false }]
  const pair = TAIL_PAIRS[index]
  if (pair) {
    const [left, right] = halves(gap)
    return [
      { key: `T${pair[0]}`, rel: left, inherit: true },
      { key: `T${pair[1]}`, rel: right, inherit: true },
    ]
  }
  return null
}

/** 직접 그리지 않아도 자동으로 만들어지는 자모인지 */
export function isDerivable(key: JamoKey): boolean {
  const role = key[0]
  const index = Number(key.slice(1))
  if (role === 'L') return index in DOUBLE_LEADS
  if (role === 'V') return index in VOWEL_PAIRS || index in MIXED_VOWELS
  return index in TAIL_FROM_LEAD || index in TAIL_PAIRS
}

/** 이 자모를 만드는 데 쓰이는 자모들 (안내 문구용) */
export function derivationSources(key: JamoKey): JamoKey[] {
  const parts = derivationOf(key, 'C', PLACEHOLDER_LAYOUTS, 0.1)
  return parts ? [...new Set(parts.map((p) => p.key))] : []
}

const UNIT: Box = { x0: 0, y0: 0, x1: 1, y1: 1 }
const PLACEHOLDER_LAYOUTS: LayoutSet = {
  A: { L: UNIT, V: UNIT },
  B: { L: UNIT, V: UNIT },
  C: { L: UNIT, V: UNIT, Vh: UNIT, Vv: UNIT },
  D: { L: UNIT, V: UNIT, T: UNIT },
  E: { L: UNIT, V: UNIT, T: UNIT },
  F: { L: UNIT, V: UNIT, Vh: UNIT, Vv: UNIT, T: UNIT },
}
