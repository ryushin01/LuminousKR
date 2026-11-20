import { describe, expect, it } from 'vitest'
import { isDoubleTap } from './double-tap.ts'

describe('손가락·펜 두 번 누르기', () => {
  const first = { time: 1000, x: 100, y: 200 }

  it('앞서 누른 것이 없으면 두 번 누르기가 아닙니다', () => {
    expect(isDoubleTap(null, first)).toBe(false)
  })

  it('350ms 안에 24px 안쪽을 다시 누르면 두 번 누르기입니다(손가락이 조금 어긋나도)', () => {
    expect(isDoubleTap(first, { time: 1200, x: 106, y: 204 })).toBe(true)
    expect(isDoubleTap(first, { time: 1350, x: 124, y: 200 })).toBe(true)
  })

  it('늦게 누르거나 멀리 누르면 다른 점을 찍는 것입니다', () => {
    expect(isDoubleTap(first, { time: 1351, x: 100, y: 200 })).toBe(false)
    expect(isDoubleTap(first, { time: 1100, x: 125, y: 200 })).toBe(false)
    expect(isDoubleTap(first, { time: 900, x: 100, y: 200 })).toBe(false)
  })
})
