import {
  LEAD_COUNT,
  LEAD_NAMES,
  LEADS,
  TAIL_COUNT,
  TAIL_NAMES,
  TAILS,
  VOWEL_COUNT,
  VOWEL_NAMES,
  VOWELS,
  composeSyllable,
  vowelShape,
} from '@/shared/lib/hangul'
import type { Box, JamoKey, LayoutId, LayoutSet, Role } from './types.ts'

export const LAYOUT_IDS: readonly LayoutId[] = ['A', 'B', 'C', 'D', 'E', 'F']

export const LAYOUT_INFO: Record<LayoutId, { sample: string; label: string; description: string }> =
  {
    A: {
      sample: '가',
      label: '세로 모음',
      description: '받침 없이 세로 모음이 오른쪽에 놓이는 모양',
    },
    B: {
      sample: '고',
      label: '가로 모음',
      description: '받침 없이 가로 모음이 아래에 놓이는 모양',
    },
    C: {
      sample: '과',
      label: '섞임 모음',
      description: '받침 없이 가로·세로 모음이 함께 놓이는 모양',
    },
    D: {
      sample: '각',
      label: '세로 모음 + 받침',
      description: '세로 모음 아래에 받침이 놓이는 모양',
    },
    E: {
      sample: '곡',
      label: '가로 모음 + 받침',
      description: '가로 모음 아래에 받침이 놓이는 모양',
    },
    F: {
      sample: '곽',
      label: '섞임 모음 + 받침',
      description: '섞임 모음 아래에 받침이 놓이는 모양',
    },
  }

/** 기본 배치 틀 (음절 정사각형 0~1, y 아래로) — 획의 뼈대가 놓이는 범위입니다. */
export const DEFAULT_LAYOUTS: LayoutSet = {
  A: {
    L: { x0: 0.02, y0: 0.1, x1: 0.5, y1: 0.9 },
    V: { x0: 0.58, y0: 0, x1: 1, y1: 1 },
  },
  B: {
    L: { x0: 0.12, y0: 0.02, x1: 0.88, y1: 0.46 },
    V: { x0: 0, y0: 0.54, x1: 1, y1: 1 },
  },
  C: {
    L: { x0: 0.02, y0: 0.02, x1: 0.52, y1: 0.44 },
    V: { x0: 0, y0: 0, x1: 1, y1: 1 },
    Vh: { x0: 0, y0: 0.52, x1: 0.62, y1: 1 },
    Vv: { x0: 0.64, y0: 0, x1: 1, y1: 1 },
  },
  D: {
    L: { x0: 0.02, y0: 0.03, x1: 0.5, y1: 0.5 },
    V: { x0: 0.58, y0: 0, x1: 1, y1: 0.56 },
    T: { x0: 0.1, y0: 0.68, x1: 0.9, y1: 1 },
  },
  E: {
    L: { x0: 0.14, y0: 0.02, x1: 0.86, y1: 0.26 },
    V: { x0: 0, y0: 0.33, x1: 1, y1: 0.56 },
    T: { x0: 0.1, y0: 0.68, x1: 0.9, y1: 1 },
  },
  F: {
    L: { x0: 0.02, y0: 0.02, x1: 0.52, y1: 0.26 },
    V: { x0: 0, y0: 0, x1: 1, y1: 0.56 },
    Vh: { x0: 0, y0: 0.33, x1: 0.62, y1: 0.56 },
    Vv: { x0: 0.64, y0: 0, x1: 1, y1: 0.56 },
    T: { x0: 0.1, y0: 0.68, x1: 0.9, y1: 1 },
  },
}

/** 음절의 중성·종성으로 배치를 고릅니다. */
export function layoutFor(vowel: number, tail: number): LayoutId {
  const shape = vowelShape(vowel)
  const base = shape === 'vertical' ? 0 : shape === 'horizontal' ? 1 : 2
  return LAYOUT_IDS[base + (tail > 0 ? 3 : 0)]!
}

/* ── 자모 키 ── */

export const jamoKey = (role: Role, index: number): JamoKey => `${role}${index}`

export function parseJamoKey(key: JamoKey): { role: Role; index: number } {
  return { role: key[0] as Role, index: Number(key.slice(1)) }
}

export const ALL_JAMO_KEYS: readonly JamoKey[] = [
  ...Array.from({ length: LEAD_COUNT }, (_, i) => jamoKey('L', i)),
  ...Array.from({ length: VOWEL_COUNT }, (_, i) => jamoKey('V', i)),
  ...Array.from({ length: TAIL_COUNT - 1 }, (_, i) => jamoKey('T', i + 1)),
]

export const ROLE_LABEL: Record<Role, string> = { L: '초성', V: '중성', T: '종성' }

export function jamoChar(key: JamoKey): string {
  const { role, index } = parseJamoKey(key)
  if (role === 'L') return LEADS[index] ?? '?'
  if (role === 'V') return VOWELS[index] ?? '?'
  return TAILS[index] ?? '?'
}

export function jamoName(key: JamoKey): string {
  const { role, index } = parseJamoKey(key)
  if (role === 'L') return LEAD_NAMES[index] ?? ''
  if (role === 'V') return VOWEL_NAMES[index] ?? ''
  return TAIL_NAMES[index] ?? ''
}

/** 화면에 보일 이름. 예: "ㄱ 초성", "ㅘ 중성" */
export function jamoLabel(key: JamoKey): string {
  return `${jamoChar(key)} ${ROLE_LABEL[parseJamoKey(key).role]}`
}

/** 이 자모가 놓일 수 있는 배치 */
export function layoutsOf(key: JamoKey): LayoutId[] {
  const { role, index } = parseJamoKey(key)
  if (role === 'L') return [...LAYOUT_IDS]
  if (role === 'T') return ['D', 'E', 'F']
  const shape = vowelShape(index)
  if (shape === 'vertical') return ['A', 'D']
  if (shape === 'horizontal') return ['B', 'E']
  return ['C', 'F']
}

/** 기본 획을 그리는 배치 (그 배치의 틀이 기본 획의 기준) */
export function homeLayout(key: JamoKey): LayoutId {
  return layoutsOf(key)[0]!
}

/** 자모가 그 배치에서 차지하는 틀 */
export function frameBox(layouts: LayoutSet, key: JamoKey, layout: LayoutId): Box {
  const { role } = parseJamoKey(key)
  const boxes = layouts[layout]
  if (role === 'L') return boxes.L
  if (role === 'V') return boxes.V
  return boxes.T ?? layouts.D.T!
}

/** 자모를 미리 볼 때 함께 보여 줄 음절 (그 배치에서) */
export function sampleSyllable(key: JamoKey, layout: LayoutId): string {
  const { role, index } = parseJamoKey(key)
  const defaultVowel: Record<LayoutId, number> = { A: 0, B: 8, C: 9, D: 0, E: 8, F: 9 }
  const hasTail = layout === 'D' || layout === 'E' || layout === 'F'
  if (role === 'L') return composeSyllable(index, defaultVowel[layout], hasTail ? 4 : 0)
  if (role === 'V') return composeSyllable(11, index, hasTail ? 4 : 0)
  return composeSyllable(0, defaultVowel[layout], index)
}

/** 정규화 틀 좌표 → 음절 좌표 */
export function mapToBox(box: Box, u: number, v: number): { x: number; y: number } {
  return { x: box.x0 + u * (box.x1 - box.x0), y: box.y0 + v * (box.y1 - box.y0) }
}

/** 음절 좌표 → 정규화 틀 좌표 */
export function mapFromBox(box: Box, x: number, y: number): { x: number; y: number } {
  const w = box.x1 - box.x0 || 1
  const h = box.y1 - box.y0 || 1
  return { x: (x - box.x0) / w, y: (y - box.y0) / h }
}

/** 부모 틀 안의 상대 위치(0~1)로 정의한 작은 틀을 실제 좌표로 */
export function subBox(parent: Box, rel: Box): Box {
  const w = parent.x1 - parent.x0
  const h = parent.y1 - parent.y0
  return {
    x0: parent.x0 + rel.x0 * w,
    y0: parent.y0 + rel.y0 * h,
    x1: parent.x0 + rel.x1 * w,
    y1: parent.y0 + rel.y1 * h,
  }
}

/** child가 parent 안에서 차지하는 상대 위치 */
export function relativeBox(parent: Box, child: Box): Box {
  const w = parent.x1 - parent.x0 || 1
  const h = parent.y1 - parent.y0 || 1
  return {
    x0: (child.x0 - parent.x0) / w,
    y0: (child.y0 - parent.y0) / h,
    x1: (child.x1 - parent.x0) / w,
    y1: (child.y1 - parent.y0) / h,
  }
}
