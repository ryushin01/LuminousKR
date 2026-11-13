import type { Point } from '../geometry/index.ts'

/** 3×3 원근 변환 행렬 (행 우선, h33 = 1) */
export type Homography = [number, number, number, number, number, number, number, number, number]

/**
 * 네 점 쌍으로 원근 변환을 구합니다 (DLT, 가우스 소거).
 * src의 점이 dst의 점으로 옮겨집니다. 풀 수 없으면 null.
 */
export function solveHomography(src: readonly Point[], dst: readonly Point[]): Homography | null {
  if (src.length !== 4 || dst.length !== 4) return null
  const a: number[][] = []
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i]!
    const { x: u, y: v } = dst[i]!
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u])
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y, v])
  }
  // 8×9 확장 행렬을 가우스-조르당 소거
  for (let col = 0; col < 8; col++) {
    let pivot = col
    for (let row = col + 1; row < 8; row++)
      if (Math.abs(a[row]![col]!) > Math.abs(a[pivot]![col]!)) pivot = row
    if (Math.abs(a[pivot]![col]!) < 1e-12) return null
    ;[a[col], a[pivot]] = [a[pivot]!, a[col]!]
    const lead = a[col]![col]!
    for (let k = col; k < 9; k++) a[col]![k]! /= lead
    for (let row = 0; row < 8; row++) {
      if (row === col) continue
      const factor = a[row]![col]!
      if (factor === 0) continue
      for (let k = col; k < 9; k++) a[row]![k]! -= factor * a[col]![k]!
    }
  }
  const h = a.map((row) => row[8]!)
  return [h[0]!, h[1]!, h[2]!, h[3]!, h[4]!, h[5]!, h[6]!, h[7]!, 1]
}

export function applyHomography(h: Homography, p: Point): Point {
  const w = h[6] * p.x + h[7] * p.y + h[8]
  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / w, y: (h[3] * p.x + h[4] * p.y + h[5]) / w }
}
