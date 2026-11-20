/**
 * 영문·숫자·문장부호 94자의 기본 뼈대: 원과 직선으로 짠 기하학적인 한 굵기 글자체.
 *
 * 좌표는 글자마다의 뼈대 틀입니다. y는 0(어센더)~1(디센더)로 아래로 커지고, x도 같은 단위(틀 높이 = 1)입니다.
 * 곡선은 6°마다 점을 둔 꺾은선으로, 직선과 이어지는 곳은 한 획 안에서 이어 그립니다. 그래야 획 끝 모양
 * (둥글게·네모·자름)과 상관없이 이음매가 매끈합니다. 자유 곡선(& { } ~)만 매끄러운 곡선 획을 씁니다.
 */
import { withIds } from './preset.ts'
import type { EllipseStroke, PathStroke, Point, Stroke } from './types.ts'

type Shape = Omit<PathStroke, 'id'> | Omit<EllipseStroke, 'id'>
type Pair = readonly [number, number]
type Part = Pair | readonly Pair[]

/** 어센더 */
const T = 0
/** 대문자 높이 */
const C = 1 / 12
/** x높이 */
const X = 1 / 3
/** 기준선 */
const B = 5 / 6
/** 디센더 */
const D = 1

/**
 * 뼈대 틀 안의 안내선 (y, 위 0 → 아래 1). 격자 24칸에서 0·2·8·20·24번째 줄입니다.
 * 기본 굵기에서 획 바깥이 어센더 790, 대문자 높이 약 717, x높이 500, 기준선 0, 디센더 −145(글꼴 단위)에 놓입니다.
 */
export const LATIN_GUIDES = {
  ascender: T,
  capHeight: C,
  xHeight: X,
  baseline: B,
  descender: D,
} as const

/** 대문자 가운데 */
const MC = (C + B) / 2
/** 소문자 가운데 (수학 기호·붙임표의 가운데) */
const MX = (X + B) / 2
/** 둥근 획이 안내선 밖으로 조금 넘치는 양 (둥근 글자가 곧은 글자보다 작아 보이지 않게) */
const O = 0.01
/** 곧은 옆면의 안쪽 여백 (곧은 글자 사이를 둥근 글자 사이보다 조금 넓게) */
const S = 0.03
/** 점(마침표, i의 점) 반지름: 획 굵기보다 조금 큰 점이 됩니다. */
const DOT = 0.012
/** 곡선을 꺾은선으로 나눌 때 한 마디의 최대 각도 */
const ARC_STEP = 6

const round = (v: number) => Math.round(v * 10000) / 10000
const isPair = (part: Part): part is Pair => typeof part[0] === 'number'

/** 타원호 위의 점들. 각도는 도 단위로 0°가 오른쪽, 90°가 위(y는 아래로 커짐)이고 from → to 차례입니다. */
function arc(cx: number, cy: number, rx: number, ry: number, from: number, to: number): Pair[] {
  const steps = Math.max(1, Math.ceil(Math.abs(to - from) / ARC_STEP))
  return Array.from({ length: steps + 1 }, (_, i) => {
    const angle = ((from + ((to - from) * i) / steps) * Math.PI) / 180
    return [round(cx + rx * Math.cos(angle)), round(cy - ry * Math.sin(angle))] as const
  })
}

/** 점과 점 목록(호)을 차례로 이어 꺾은선 획 하나로. 거의 같은 자리의 이웃한 점은 하나로 합칩니다. */
function polyline(closed: boolean, parts: readonly Part[]): Shape {
  const points: Point[] = []
  for (const part of parts) {
    for (const [x, y] of isPair(part) ? [part] : part) {
      const last = points[points.length - 1]
      if (last && Math.abs(last.x - x) < 5e-4 && Math.abs(last.y - y) < 5e-4) continue
      points.push({ x, y })
    }
  }
  return { kind: 'path', points, closed, smooth: false }
}

const path = (...parts: Part[]) => polyline(false, parts)
const loop = (...parts: Part[]) => polyline(true, parts)
const curve = (...list: Pair[]): Shape => ({
  kind: 'path',
  points: list.map(([x, y]) => ({ x, y })),
  closed: false,
  smooth: true,
})
const ring = (cx: number, cy: number, rx: number, ry: number): Shape => ({
  kind: 'ellipse',
  cx,
  cy,
  rx,
  ry,
})
const dot = (x: number, y: number) => ring(x, y, DOT, DOT)

/** S와 $가 함께 쓰는 S자 */
const S_SPINE = path(
  arc(0.27, C - O + 0.18, 0.22, 0.18, 35, 270),
  arc(0.27, C - O + 0.36 + 0.205, 0.245, 0.205, 90, -145),
)
/** 쉼표의 꼬리 (쉼표·쌍반점) */
const COMMA_TAIL = path([0.072, 0.83], [0.02, 0.95])
const BRACE: Pair[] = [
  [0.24, 0.02],
  [0.15, 0.05],
  [0.13, 0.15],
  [0.13, 0.38],
  [0.1, 0.45],
  [0.02, 0.48],
  [0.1, 0.51],
  [0.13, 0.58],
  [0.13, 0.82],
  [0.15, 0.91],
  [0.24, 0.94],
]

/** 글자 → [뼈대 너비, 획들] */
const GLYPHS: Readonly<Record<string, readonly [number, readonly Shape[]]>> = {
  // 대문자
  A: [0.64, [path([0, B], [0.32, C], [0.64, B]), path([0.0996, 0.6], [0.5404, 0.6])]],
  B: [
    0.5,
    [
      path([S, B], [S, C], arc(0.25, (C + 0.45) / 2, 0.18, (0.45 - C) / 2, 90, -90), [S, 0.45]),
      path([S, 0.45], arc(0.27, (0.45 + B) / 2, 0.2, (B - 0.45) / 2, 90, -90), [S, B]),
    ],
  ],
  C: [0.64, [path(arc(0.37, MC, 0.37, 0.375 + O, 45, 315))]],
  D: [0.68, [loop([S, C], arc(0.25, MC, 0.4, 0.375, 90, -90), [S, B])]],
  E: [0.48, [path([0.48, C], [S, C], [S, B], [0.48, B]), path([S, MC], [0.43, MC])]],
  F: [0.46, [path([0.46, C], [S, C], [S, B]), path([S, MC], [0.42, MC])]],
  G: [0.74, [path(arc(0.37, MC, 0.37, 0.375 + O, 45, 360), [0.42, MC])]],
  H: [0.6, [path([S, C], [S, B]), path([0.57, C], [0.57, B]), path([S, MC], [0.57, MC])]],
  I: [0.06, [path([S, C], [S, B])]],
  J: [0.44, [path([0.41, C], arc(0.22, 0.63, 0.19, B + O - 0.63, 0, -150))]],
  K: [0.54, [path([S, C], [S, B]), path([0.52, C], [S, 0.58]), path([0.2, 0.4077], [0.54, B])]],
  L: [0.46, [path([S, C], [S, B], [0.46, B])]],
  M: [0.76, [path([S, B], [S, C], [0.38, 0.72], [0.73, C], [0.73, B])]],
  N: [0.62, [path([S, B], [S, C], [0.59, B], [0.59, C])]],
  O: [0.74, [ring(0.37, MC, 0.37, 0.375 + O)]],
  P: [
    0.5,
    [path([S, B], [S, C], arc(0.25, (C + 0.5) / 2, 0.22, (0.5 - C) / 2, 90, -90), [S, 0.5])],
  ],
  Q: [0.74, [ring(0.37, MC, 0.37, 0.375 + O), path([0.46, 0.62], [0.74, 0.86])]],
  R: [
    0.54,
    [
      path([S, B], [S, C], arc(0.25, (C + 0.48) / 2, 0.21, (0.48 - C) / 2, 90, -90), [S, 0.48]),
      path([0.27, 0.48], [0.54, B]),
    ],
  ],
  S: [0.54, [S_SPINE]],
  T: [0.58, [path([0, C], [0.58, C]), path([0.29, C], [0.29, B])]],
  U: [0.6, [path([S, C], arc(0.3, 0.58, 0.27, B + O - 0.58, 180, 360), [0.57, C])]],
  V: [0.64, [path([0, C], [0.32, B], [0.64, C])]],
  W: [0.94, [path([0, C], [0.235, B], [0.47, C], [0.705, B], [0.94, C])]],
  X: [0.6, [path([0, C], [0.6, B]), path([0.6, C], [0, B])]],
  Y: [0.62, [path([0, C], [0.31, 0.48], [0.62, C]), path([0.31, 0.48], [0.31, B])]],
  Z: [0.56, [path([0.02, C], [0.54, C], [0.02, B], [0.56, B])]],

  // 소문자
  a: [0.52, [ring(0.245, MX, 0.245, 0.25 + O), path([0.49, X], [0.49, B])]],
  b: [0.52, [path([S, T], [S, B]), ring(0.275, MX, 0.245, 0.25 + O)]],
  c: [0.46, [path(arc(0.26, MX, 0.26, 0.25 + O, 45, 315))]],
  d: [0.52, [ring(0.245, MX, 0.245, 0.25 + O), path([0.49, T], [0.49, B])]],
  e: [0.52, [path([0, MX], arc(0.26, MX, 0.26, 0.25 + O, 0, 320))]],
  f: [0.32, [path([0.11, B], arc(0.23, 0.17, 0.12, 0.17, 180, 45)), path([0, X], [0.3, X])]],
  g: [
    0.52,
    [ring(0.245, MX, 0.245, 0.25 + O), path([0.49, X], arc(0.27, 0.86, 0.22, D - 0.86, 0, -155))],
  ],
  h: [0.5, [path([S, T], [S, B]), path(arc(0.25, 0.5, 0.22, 0.5 - X + O, 180, 0), [0.47, B])]],
  i: [0.06, [path([S, X], [S, B]), dot(S, 0.17)]],
  j: [0.24, [path([0.21, X], arc(0.09, 0.87, 0.12, D - 0.87, 0, -135)), dot(0.21, 0.17)]],
  k: [0.46, [path([S, T], [S, B]), path([0.43, X], [S, 0.66]), path([0.17, 0.5457], [0.46, B])]],
  l: [0.06, [path([S, T], [S, B])]],
  m: [
    0.76,
    [
      path([S, X], [S, B]),
      path(arc(0.205, 0.5, 0.175, 0.5 - X + O, 180, 0), [0.38, B]),
      path(arc(0.555, 0.5, 0.175, 0.5 - X + O, 180, 0), [0.73, B]),
    ],
  ],
  n: [0.5, [path([S, X], [S, B]), path(arc(0.25, 0.5, 0.22, 0.5 - X + O, 180, 0), [0.47, B])]],
  o: [0.54, [ring(0.27, MX, 0.27, 0.25 + O)]],
  p: [0.52, [path([S, X], [S, D]), ring(0.275, MX, 0.245, 0.25 + O)]],
  q: [0.52, [ring(0.245, MX, 0.245, 0.25 + O), path([0.49, X], [0.49, D])]],
  r: [0.32, [path([S, X], [S, B]), path(arc(0.21, 0.5, 0.18, 0.5 - X + O, 180, 60))]],
  s: [
    0.42,
    [
      path(
        arc(0.21, X - O + 0.12, 0.165, 0.12, 35, 270),
        arc(0.21, X - O + 0.24 + 0.14, 0.185, 0.14, 90, -145),
      ),
    ],
  ],
  t: [
    0.32,
    [path([0.11, 0.12], arc(0.22, 0.7, 0.11, B + O - 0.7, 180, 300)), path([0, X], [0.3, X])],
  ],
  u: [
    0.5,
    [
      path([0.47, X], [0.47, B]),
      path([S, X], arc(0.25, B + O - (0.5 - X + O), 0.22, 0.5 - X + O, 180, 360)),
    ],
  ],
  v: [0.5, [path([0, X], [0.25, B], [0.5, X])]],
  w: [0.76, [path([0, X], [0.19, B], [0.38, X], [0.57, B], [0.76, X])]],
  x: [0.46, [path([0, X], [0.46, B]), path([0.46, X], [0, B])]],
  y: [0.5, [path([0, X], [0.25, B]), path([0.5, X], [0.1667, D])]],
  z: [0.44, [path([0.02, X], [0.42, X], [0.02, B], [0.44, B])]],

  // 숫자 (모두 같은 너비: 표의 숫자 자리가 맞게)
  '0': [0.54, [ring(0.27, MC, 0.24, 0.375 + O)]],
  '1': [0.54, [path([0.12, 0.2], [0.3, C], [0.3, B])]],
  '2': [0.54, [path(arc(0.27, C - O + 0.21, 0.22, 0.21, 155, -35), [0.04, B], [0.52, B])]],
  '3': [
    0.54,
    [
      path(arc(0.26, C - O + 0.185, 0.19, 0.185, 150, -90), [0.17, C - O + 0.37]),
      path([0.17, C - O + 0.37], arc(0.26, C - O + 0.37 + 0.2, 0.23, 0.2, 90, -150)),
    ],
  ],
  '4': [0.54, [path([0.38, B], [0.38, C], [0.03, 0.62], [0.52, 0.62])]],
  '5': [0.54, [path([0.47, C], [0.1, C], arc(0.26, B + O - 0.23, 0.23, 0.23, 132, -145))]],
  '6': [
    0.54,
    [
      path([0.04, B + O - 0.235], arc(0.27, MC, 0.23, 0.375 + O, 180, 45)),
      ring(0.27, B + O - 0.235, 0.23, 0.235),
    ],
  ],
  '7': [0.54, [path([0.03, C], [0.51, C], [0.17, B])]],
  '8': [0.54, [ring(0.27, C - O + 0.185, 0.2, 0.185), ring(0.27, C - O + 0.37 + 0.2, 0.23, 0.2)]],
  '9': [
    0.54,
    [
      ring(0.27, C - O + 0.235, 0.23, 0.235),
      path([0.5, C - O + 0.235], arc(0.27, MC, 0.23, 0.375 + O, 0, -135)),
    ],
  ],

  // 문장부호·기호
  '!': [0.06, [path([S, C], [S, 0.62]), dot(S, B - DOT)]],
  '"': [0.24, [path([S, C], [S, 0.26]), path([0.21, C], [0.21, 0.26])]],
  '#': [
    0.6,
    [
      path([0.24, 0.16], [0.18, 0.76]),
      path([0.44, 0.16], [0.38, 0.76]),
      path([0.04, 0.34], [0.58, 0.34]),
      path([0.02, 0.58], [0.56, 0.58]),
    ],
  ],
  $: [0.54, [S_SPINE, path([0.27, 0.01], [0.27, 0.91])]],
  '%': [
    0.76,
    [ring(0.15, 0.23, 0.12, 0.15), ring(0.61, 0.69, 0.12, 0.15), path([0.66, C], [0.1, B])],
  ],
  '&': [
    0.66,
    [
      curve(
        [0.64, B],
        [0.22, 0.42],
        [0.13, 0.27],
        [0.25, C],
        [0.38, 0.22],
        [0.28, 0.38],
        [0.07, 0.56],
        [0.08, 0.76],
        [0.27, 0.845],
        [0.48, 0.76],
        [0.6, 0.56],
      ),
    ],
  ],
  "'": [0.06, [path([S, C], [S, 0.26])]],
  '(': [0.22, [path(arc(0.3, 0.48, 0.27, 0.55, 122, 238))]],
  ')': [0.22, [path(arc(-0.08, 0.48, 0.27, 0.55, 58, -58))]],
  '*': [
    0.4,
    [
      path([0.2, 0.08], [0.2, 0.38]),
      path([0.07, 0.155], [0.33, 0.305]),
      path([0.33, 0.155], [0.07, 0.305]),
    ],
  ],
  '+': [0.52, [path([0.26, MX - 0.22], [0.26, MX + 0.22]), path([0.04, MX], [0.48, MX])]],
  ',': [0.1, [dot(0.06, B - DOT), COMMA_TAIL]],
  '-': [0.32, [path([0.02, MX], [0.3, MX])]],
  '.': [0.06, [dot(S, B - DOT)]],
  '/': [0.4, [path([0.38, 0.04], [0.02, 0.92])]],
  ':': [0.06, [dot(S, X + DOT), dot(S, B - DOT)]],
  ';': [0.1, [dot(0.06, X + DOT), dot(0.06, B - DOT), COMMA_TAIL]],
  // 수학 기호 + < = >는 같은 너비(0.52)로 셈식의 자리가 맞게 합니다.
  '<': [0.52, [path([0.48, MX - 0.2], [0.04, MX], [0.48, MX + 0.2])]],
  '=': [0.52, [path([0.04, MX - 0.1], [0.48, MX - 0.1]), path([0.04, MX + 0.1], [0.48, MX + 0.1])]],
  '>': [0.52, [path([0.04, MX - 0.2], [0.48, MX], [0.04, MX + 0.2])]],
  '?': [
    0.46,
    [path(arc(0.23, C - O + 0.195, 0.2, 0.195, 160, -90), [0.23, 0.62]), dot(0.23, B - DOT)],
  ],
  '@': [
    0.88,
    [
      ring(0.4, 0.53, 0.15, 0.17),
      // 안쪽 줄기에서 아래로 돌아 바깥 고리의 오른쪽(0°)으로 이어 한 바퀴 가까이 감습니다.
      path(
        [0.55, 0.36],
        arc(0.705, 0.6, 0.155, 0.1, 180, 360),
        arc(0.44, 0.49, 0.42, 0.41, 0, 290),
      ),
    ],
  ],
  '[': [0.2, [path([0.18, 0.02], [S, 0.02], [S, 0.94], [0.18, 0.94])]],
  '\\': [0.4, [path([0.02, 0.04], [0.38, 0.92])]],
  ']': [0.2, [path([0.02, 0.02], [0.17, 0.02], [0.17, 0.94], [0.02, 0.94])]],
  '^': [0.48, [path([0.04, 0.4], [0.24, C], [0.44, 0.4])]],
  _: [0.5, [path([0, 0.95], [0.5, 0.95])]],
  '`': [0.16, [path([0.02, 0.08], [0.14, 0.22])]],
  '{': [0.26, [curve(...BRACE)]],
  '|': [0.06, [path([S, T], [S, D])]],
  '}': [0.26, [curve(...BRACE.map(([x, y]) => [round(0.26 - x), y] as const))]],
  '~': [0.52, [curve([0.02, MX + 0.03], [0.13, MX - 0.05], [0.39, MX + 0.05], [0.5, MX - 0.03])]],
}

export type PresetLatin = { readonly strokes: readonly Stroke[]; readonly width: number }

const built = new Map<string, PresetLatin>()

/** 기본 뼈대 (없는 글자면 undefined). 같은 글자는 같은 객체를 돌려주므로 고치지 말고 복사해 쓰세요. */
export function presetLatin(char: string): PresetLatin | undefined {
  const known = built.get(char)
  if (known) return known
  const glyph = GLYPHS[char]
  if (!glyph) return undefined
  // 여러 글자가 함께 쓰는 획(S와 $)도 따로 복사하고, 실수로 고치지 못하게 얼립니다.
  const strokes = structuredClone(withIds(char, glyph[1]))
  for (const stroke of strokes) {
    if (stroke.kind === 'path') stroke.points.forEach((p) => Object.freeze(p))
    Object.freeze(stroke.kind === 'path' ? stroke.points : stroke)
    Object.freeze(stroke)
  }
  const preset = Object.freeze({ strokes: Object.freeze(strokes), width: glyph[0] })
  built.set(char, preset)
  return preset
}
