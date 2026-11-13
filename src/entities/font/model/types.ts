/**
 * 글꼴 프로젝트 데이터 모델
 *
 * 자모는 획의 "뼈대(가운데 선)"만 저장합니다. 두께는 글꼴 전체 굵기 값으로 나중에 입히므로,
 * 자모를 작은 칸에 줄여 넣어도 획 굵기가 일정하게 유지됩니다.
 * 좌표는 자모가 놓이는 틀(box) 안에서 0~1로 정규화하고, y는 아래로 커집니다.
 */

export type Point = { x: number; y: number }

export type PathStroke = {
  id: string
  kind: 'path'
  /** 틀 안의 정규화 좌표 */
  points: Point[]
  /** 마지막 점과 첫 점을 잇는 닫힌 획 (ㅁ처럼) */
  closed: boolean
  /** 점을 매끄러운 곡선으로 잇기 */
  smooth: boolean
}

export type EllipseStroke = {
  id: string
  kind: 'ellipse'
  cx: number
  cy: number
  rx: number
  ry: number
}

export type Stroke = PathStroke | EllipseStroke

export type Drawing = { strokes: Stroke[] }

/** 초성(L), 중성(V), 종성(T) — 유니코드 한글 자모 용어(Leading, Vowel, Trailing) */
export type Role = 'L' | 'V' | 'T'

/** 예: L0(ㄱ 초성), V8(ㅗ), T21(ㅇ 받침) */
export type JamoKey = `${Role}${number}`

/**
 * 배치(벌) — 음절 모양 6가지
 * A 가(세로 모음), B 고(가로 모음), C 과(섞임 모음), D 각, E 곡, F 곽(받침 있음)
 */
export type LayoutId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

export type Box = { x0: number; y0: number; x1: number; y1: number }

export type LayoutBoxes = {
  L: Box
  /** 중성 전체 틀. 섞임 모음 배치에서는 Vh와 Vv를 감싸는 틀 */
  V: Box
  /** 섞임 모음의 가로 부분(ㅗ ㅜ ㅡ) */
  Vh?: Box
  /** 섞임 모음의 세로 부분(ㅏ ㅐ ㅓ ㅔ ㅣ) */
  Vv?: Box
  T?: Box
}

export type LayoutSet = Record<LayoutId, LayoutBoxes>

export type JamoEntry = {
  /** 직접 그린 기본 획. 없으면 파생 규칙(겹자음, ㅐ, ㅘ, 받침 등)으로 만듭니다. */
  base?: Drawing
  /** 배치마다 따로 그린 획(벌). 있으면 그 배치에서 기본 획 대신 씁니다. */
  variants?: Partial<Record<LayoutId, Drawing>>
}

export type CapStyle = 'round' | 'square' | 'butt'
export type JoinStyle = 'round' | 'miter' | 'bevel'

export type StrokeStyle = {
  /** 세로획 굵기 (글꼴 단위, 1em = 1000) */
  weight: number
  /** 가로획 ÷ 세로획 굵기 (0.3~1) */
  contrast: number
  cap: CapStyle
  join: JoinStyle
  /** 오른쪽으로 기우는 각도(도) */
  slant: number
}

export type Metrics = {
  /** 글자 너비 (글꼴 단위) */
  advance: number
  /** 획 바깥까지 포함한 글자 몸 높이 */
  height: number
  /** 좌우 여백 */
  sideBearing: number
}

export type FontMeta = {
  familyName: string
  familyNameKo: string
  styleName: string
  designer: string
  version: string
  license: string
  description: string
}

export type FontProject = {
  format: 'luminous-kr'
  version: 1
  name: string
  jamo: Partial<Record<JamoKey, JamoEntry>>
  style: StrokeStyle
  layouts: LayoutSet
  metrics: Metrics
  meta: FontMeta
}
