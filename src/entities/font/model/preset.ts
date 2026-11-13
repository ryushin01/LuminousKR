import { DEFAULT_LAYOUTS } from './layout.ts'
import type {
  Drawing,
  EllipseStroke,
  FontProject,
  JamoEntry,
  JamoKey,
  PathStroke,
  Stroke,
} from './types.ts'

type Shape = Omit<PathStroke, 'id'> | Omit<EllipseStroke, 'id'>
type Pair = [number, number]

const pts = (list: Pair[]) => list.map(([x, y]) => ({ x, y }))
const line = (...list: Pair[]): Shape => ({
  kind: 'path',
  points: pts(list),
  closed: false,
  smooth: false,
})
const loop = (...list: Pair[]): Shape => ({
  kind: 'path',
  points: pts(list),
  closed: true,
  smooth: false,
})
const ellipse = (cx: number, cy: number, rx: number, ry: number): Shape => ({
  kind: 'ellipse',
  cx,
  cy,
  rx,
  ry,
})

/**
 * 기본 자모 24자의 뼈대 (자모 틀 안의 0~1 좌표).
 * 초성은 '가'의 초성 틀, 세로 모음은 '가'의 중성 틀, 가로 모음은 '고'의 중성 틀 기준입니다.
 */
const BASE_SHAPES: Partial<Record<JamoKey, Shape[]>> = {
  // ㄱ
  L0: [line([0.08, 0.12], [0.86, 0.12], [0.86, 0.92])],
  // ㄴ
  L2: [line([0.12, 0.06], [0.12, 0.86], [0.94, 0.86])],
  // ㄷ
  L3: [line([0.9, 0.12], [0.12, 0.12], [0.12, 0.86], [0.94, 0.86])],
  // ㄹ
  L5: [line([0.1, 0.1], [0.86, 0.1], [0.86, 0.48], [0.14, 0.48], [0.14, 0.88], [0.94, 0.88])],
  // ㅁ
  L6: [loop([0.12, 0.12], [0.88, 0.12], [0.88, 0.86], [0.12, 0.86])],
  // ㅂ
  L7: [
    line([0.14, 0.06], [0.14, 0.88], [0.86, 0.88], [0.86, 0.06]),
    line([0.14, 0.46], [0.86, 0.46]),
  ],
  // ㅅ
  L9: [line([0.06, 0.92], [0.5, 0.1], [0.94, 0.92])],
  // ㅇ
  L11: [ellipse(0.5, 0.5, 0.4, 0.3)],
  // ㅈ
  L12: [line([0.1, 0.12], [0.9, 0.12]), line([0.06, 0.92], [0.5, 0.12], [0.94, 0.92])],
  // ㅊ
  L14: [
    line([0.5, 0.0], [0.5, 0.24]),
    line([0.1, 0.24], [0.9, 0.24]),
    line([0.06, 0.94], [0.5, 0.24], [0.94, 0.94]),
  ],
  // ㅋ
  L15: [line([0.08, 0.12], [0.86, 0.12], [0.86, 0.92]), line([0.14, 0.5], [0.86, 0.5])],
  // ㅌ
  L16: [
    line([0.9, 0.12], [0.14, 0.12], [0.14, 0.86], [0.94, 0.86]),
    line([0.14, 0.49], [0.84, 0.49]),
  ],
  // ㅍ
  L17: [
    line([0.06, 0.12], [0.94, 0.12]),
    line([0.04, 0.86], [0.96, 0.86]),
    line([0.32, 0.12], [0.32, 0.86]),
    line([0.68, 0.12], [0.68, 0.86]),
  ],
  // ㅎ
  L18: [
    line([0.5, 0.0], [0.5, 0.18]),
    line([0.08, 0.18], [0.92, 0.18]),
    ellipse(0.5, 0.62, 0.34, 0.22),
  ],

  // ㅏ
  V0: [line([0.3, 0.0], [0.3, 1.0]), line([0.3, 0.47], [0.92, 0.47])],
  // ㅑ
  V2: [
    line([0.3, 0.0], [0.3, 1.0]),
    line([0.3, 0.36], [0.92, 0.36]),
    line([0.3, 0.6], [0.92, 0.6]),
  ],
  // ㅓ
  V4: [line([0.66, 0.0], [0.66, 1.0]), line([0.08, 0.47], [0.66, 0.47])],
  // ㅕ
  V6: [
    line([0.66, 0.0], [0.66, 1.0]),
    line([0.08, 0.36], [0.66, 0.36]),
    line([0.08, 0.6], [0.66, 0.6]),
  ],
  // ㅗ
  V8: [line([0.0, 0.78], [1.0, 0.78]), line([0.5, 0.06], [0.5, 0.78])],
  // ㅛ
  V12: [
    line([0.0, 0.78], [1.0, 0.78]),
    line([0.32, 0.06], [0.32, 0.78]),
    line([0.68, 0.06], [0.68, 0.78]),
  ],
  // ㅜ
  V13: [line([0.0, 0.22], [1.0, 0.22]), line([0.56, 0.22], [0.56, 1.0])],
  // ㅠ
  V17: [
    line([0.0, 0.22], [1.0, 0.22]),
    line([0.34, 0.22], [0.34, 1.0]),
    line([0.68, 0.22], [0.68, 1.0]),
  ],
  // ㅡ
  V18: [line([0.0, 0.5], [1.0, 0.5])],
  // ㅣ
  V20: [line([0.45, 0.0], [0.45, 1.0])],
}

export function withIds(key: string, shapes: readonly Shape[]): Stroke[] {
  return shapes.map((shape, i) => ({ ...shape, id: `${key}-${i + 1}` }) as Stroke)
}

function drawing(key: JamoKey, shapes: readonly Shape[]): Drawing {
  return { strokes: withIds(key, shapes) }
}

/** 기본 자모 24자의 키 (나머지는 파생 규칙으로 만듦) */
export const BASIC_JAMO_KEYS = Object.keys(BASE_SHAPES) as JamoKey[]

export function createPresetJamo(): Partial<Record<JamoKey, JamoEntry>> {
  const jamo: Partial<Record<JamoKey, JamoEntry>> = {}
  for (const key of BASIC_JAMO_KEYS) {
    jamo[key] = { base: drawing(key, BASE_SHAPES[key]!) }
  }
  return jamo
}

export function createPresetProject(): FontProject {
  return {
    format: 'luminous-kr',
    version: 1,
    name: '루미너스 기본',
    jamo: createPresetJamo(),
    style: { weight: 76, contrast: 0.86, cap: 'round', join: 'round', slant: 0 },
    layouts: structuredClone(DEFAULT_LAYOUTS),
    metrics: { advance: 1000, height: 900, sideBearing: 50 },
    meta: {
      familyName: 'Luminous Modular',
      familyNameKo: '루미너스 모듈',
      styleName: 'Regular',
      designer: '',
      version: '1.000',
      license: '',
      description: 'LuminousKR로 만든 한글 모듈 글꼴',
    },
  }
}

/** 빈 프로젝트: 자모를 처음부터 그릴 때 */
export function createBlankProject(): FontProject {
  return { ...createPresetProject(), name: '새 글꼴', jamo: {} }
}
