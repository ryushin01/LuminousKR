import { describe, expect, it } from 'vitest'
import {
  SYLLABLE_BASE,
  SYLLABLE_COUNT,
  SYLLABLE_LAST,
  composeSyllable,
  decomposeCode,
  decomposeSyllable,
  isCompatJamoCode,
  uniqueSyllables,
  vowelShape,
} from './jamo.ts'

describe('한글 음절 조합', () => {
  it('11,172자 범위는 U+AC00–U+D7A3입니다', () => {
    expect(SYLLABLE_COUNT).toBe(11_172)
    expect(SYLLABLE_LAST).toBe(0xd7a3)
  })

  it('잘 알려진 음절을 조합하고 분해합니다', () => {
    expect(composeSyllable(0, 0)).toBe('가')
    expect(composeSyllable(18, 20, 27)).toBe('힣')
    expect(composeSyllable(5, 8, 8)).toBe('롤')
    expect(decomposeSyllable('닭')).toEqual({ lead: 3, vowel: 0, tail: 9 })
    expect(decomposeSyllable('A')).toBeNull()
  })

  it('모든 음절이 분해 후 다시 조합하면 같은 글자가 됩니다', () => {
    for (let code = SYLLABLE_BASE; code <= SYLLABLE_LAST; code++) {
      const parts = decomposeCode(code)!
      expect(composeSyllable(parts.lead, parts.vowel, parts.tail).codePointAt(0)).toBe(code)
    }
  })

  it('범위를 벗어난 번호는 거부합니다', () => {
    expect(() => composeSyllable(19, 0)).toThrow(RangeError)
    expect(() => composeSyllable(0, 21)).toThrow(RangeError)
    expect(() => composeSyllable(0, 0, 28)).toThrow(RangeError)
  })

  it('중성을 세로·가로·섞임 모음으로 나눕니다', () => {
    const shapes = (chars: string) => [...chars].map((c) => vowelShape(decomposeSyllable(c)!.vowel))
    expect(new Set(shapes('아애야얘어에여예이'))).toEqual(new Set(['vertical']))
    expect(new Set(shapes('오요우유으'))).toEqual(new Set(['horizontal']))
    expect(new Set(shapes('와왜외워웨위의'))).toEqual(new Set(['mixed']))
  })

  it('글에서 한글 음절만 중복 없이 뽑습니다', () => {
    expect(uniqueSyllables('한글 Hangul 한글!')).toEqual(['한', '글'])
  })

  it('호환 자모 범위를 알아봅니다', () => {
    expect(isCompatJamoCode('ㄱ'.codePointAt(0)!)).toBe(true)
    expect(isCompatJamoCode('ㅣ'.codePointAt(0)!)).toBe(true)
    expect(isCompatJamoCode('가'.codePointAt(0)!)).toBe(false)
  })
})
