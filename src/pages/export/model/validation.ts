import type { FontMeta } from '@/entities/font'

export type MetaErrors = Partial<Record<'familyName' | 'styleName' | 'version', string>>

const LATIN_NAME = /^[A-Za-z0-9 -]+$/

/**
 * 글꼴 정보 검사. 오류 문구에는 원인과 고치는 방법을 함께 적습니다.
 * @param submitted 만들기를 눌렀는지 (누르기 전에는 빈 칸을 오류로 보지 않음)
 */
export function validateMeta(meta: FontMeta, submitted: boolean): MetaErrors {
  const errors: MetaErrors = {}
  const family = meta.familyName.trim()
  if (family.length === 0) {
    if (submitted)
      errors.familyName =
        '영문 글꼴 이름을 입력해 주세요. 운영체제 글꼴 목록에 이 이름으로 보입니다.'
  } else if (!LATIN_NAME.test(family)) {
    errors.familyName =
      '영문 글꼴 이름에는 영문자, 숫자, 빈칸, 하이픈(-)만 쓸 수 있습니다. 예: Luminous Modular'
  }
  const style = meta.styleName.trim()
  if (style.length === 0) {
    if (submitted) errors.styleName = '스타일 이름을 입력해 주세요. 보통 Regular를 씁니다.'
  } else if (!LATIN_NAME.test(style)) {
    errors.styleName =
      '스타일 이름에는 영문자, 숫자, 빈칸, 하이픈(-)만 쓸 수 있습니다. 예: Regular, Bold'
  }
  const version = meta.version.trim()
  if (version.length === 0) {
    if (submitted) errors.version = '버전을 입력해 주세요. 예: 1.000'
  } else if (!/^\d+\.\d{1,3}$/.test(version)) {
    errors.version = '버전은 1.000처럼 숫자, 점, 소수 세 자리 이내로 입력해 주세요.'
  }
  return errors
}

export const LICENSE_OPTIONS = [
  { value: '', label: '정하지 않음' },
  { value: 'SIL Open Font License, Version 1.1', label: 'SIL Open Font License 1.1 (자유 글꼴)' },
  {
    value: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
    label: 'CC BY 4.0 (출처 표시)',
  },
  { value: 'All rights reserved', label: '모든 권리 보유' },
] as const
