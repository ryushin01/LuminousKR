import { BASIC_JAMO_KEYS, type JamoKey } from '@/entities/font'
import {
  BIT_CENTERS,
  MARKER_CENTERS,
  PAGE,
  type TemplateGeometry,
  layoutCells,
} from '../lib/template-geometry.ts'

export type TemplateSet = {
  id: number
  name: string
  description: string
  keys: readonly JamoKey[]
}

/** 양식 종류 (한 장에 하나) */
export const TEMPLATE_SETS: readonly TemplateSet[] = [
  {
    id: 1,
    name: '기본 자모 24자',
    description: '자음 14자와 모음 10자. 이것만 그려도 11,172자가 만들어집니다.',
    keys: BASIC_JAMO_KEYS,
  },
  {
    id: 2,
    name: '겹자모·섞임 모음 16자',
    description: 'ㄲ ㄸ ㅃ ㅆ ㅉ, ㅐ ㅒ ㅔ ㅖ, ㅘ ㅙ ㅚ ㅝ ㅞ ㅟ ㅢ를 직접 그릴 때',
    keys: [
      'L1',
      'L4',
      'L8',
      'L10',
      'L13',
      'V1',
      'V3',
      'V5',
      'V7',
      'V9',
      'V10',
      'V11',
      'V14',
      'V15',
      'V16',
      'V19',
    ],
  },
  {
    id: 3,
    name: '받침 14자',
    description: '받침 자리의 홑자음을 초성과 다르게 그릴 때',
    keys: [
      'T1',
      'T4',
      'T7',
      'T8',
      'T16',
      'T17',
      'T19',
      'T21',
      'T22',
      'T23',
      'T24',
      'T25',
      'T26',
      'T27',
    ],
  },
]

export function templateSet(id: number): TemplateSet | undefined {
  return TEMPLATE_SETS.find((set) => set.id === id)
}

export function templateGeometry(): TemplateGeometry {
  return {
    page: PAGE,
    markers: MARKER_CENTERS,
    bits: BIT_CENTERS,
    sets: TEMPLATE_SETS.map((set) => ({ id: set.id, cells: layoutCells(set.keys) })),
  }
}
