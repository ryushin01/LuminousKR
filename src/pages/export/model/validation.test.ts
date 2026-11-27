import { describe, expect, it } from 'vitest'
import { validateMeta } from './validation.ts'

const meta = {
  familyName: 'Luminous Modular',
  familyNameKo: '루미너스 모듈',
  styleName: 'Regular',
  designer: '',
  version: '1.000',
  license: '',
  description: '',
}

describe('글꼴 정보 검사', () => {
  it('맞는 값이면 오류가 없습니다', () => {
    expect(validateMeta(meta, true)).toEqual({})
  })

  it('빈 칸은 만들기를 누른 뒤에만 오류입니다', () => {
    const empty = { ...meta, familyName: ' ', styleName: '', version: '' }
    expect(validateMeta(empty, false)).toEqual({})
    expect(Object.keys(validateMeta(empty, true))).toEqual(['familyName', 'styleName', 'version'])
  })

  it('영문이 아닌 이름과 형식이 틀린 버전은 누르기 전에도 알립니다', () => {
    const errors = validateMeta(
      { ...meta, familyName: '루미너스', styleName: 'Bold!', version: '1.0000' },
      false,
    )
    expect(errors.familyName).toMatch(/영문자, 숫자, 빈칸, 하이픈/)
    expect(errors.styleName).toMatch(/예: Regular, Bold/)
    expect(errors.version).toMatch(/소수 세 자리 이내/)
  })
})
