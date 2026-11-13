// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { MAX_PAGE_PIXELS, pageCanvasSize } from './read-files.ts'

describe('PDF 쪽 캔버스 크기', () => {
  it('보통 판형(A4)은 2.5배(약 180dpi)로 그립니다', () => {
    expect(pageCanvasSize(595.28, 841.89)).toEqual({ scale: 2.5, width: 1488, height: 2104 })
  })

  it('큰 판형은 배율을 줄여, 정수 크기의 곱이 상한을 넘지 않습니다', () => {
    // 36×48인치 도면과 반올림하면 상한을 조금 넘던 비율(둘 다 반올림 시 2,500만 화소 초과), 긴 띠, 정사각형
    const pages: [number, number][] = [
      [2592, 3456],
      [2500.24, 1599.8464],
      [14_400, 1200],
      [5000, 5000],
    ]
    for (const [w, h] of pages) {
      const size = pageCanvasSize(w, h)
      expect(size.scale).toBeLessThanOrEqual(2.5)
      expect(size.width * size.height).toBeLessThanOrEqual(MAX_PAGE_PIXELS)
      // 줄이더라도 상한 가까이까지는 씁니다 (지나치게 작게 그리지 않음)
      expect(size.width * size.height).toBeGreaterThan(MAX_PAGE_PIXELS * 0.99)
    }
  })
})
