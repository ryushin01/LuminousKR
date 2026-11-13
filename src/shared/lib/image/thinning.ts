import type { BinaryImage } from './raster.ts'

/**
 * Zhang–Suen 세선화: 굵은 잉크를 한 픽셀 두께의 가운데 선(뼈대)으로 깎습니다.
 * 테두리 한 줄은 바탕으로 보고 건너뜁니다.
 */
export function thin(image: BinaryImage): BinaryImage {
  const { width, height } = image
  const data = image.data.slice()
  const at = (x: number, y: number) =>
    x < 0 || y < 0 || x >= width || y >= height ? 0 : data[y * width + x]!
  const marked: number[] = []
  let changed = true
  for (let guard = 0; changed && guard < 200; guard++) {
    changed = false
    for (let pass = 0; pass < 2; pass++) {
      marked.length = 0
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          if (data[y * width + x] !== 1) continue
          const p2 = at(x, y - 1)
          const p3 = at(x + 1, y - 1)
          const p4 = at(x + 1, y)
          const p5 = at(x + 1, y + 1)
          const p6 = at(x, y + 1)
          const p7 = at(x - 1, y + 1)
          const p8 = at(x - 1, y)
          const p9 = at(x - 1, y - 1)
          const neighbors = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9
          if (neighbors < 2 || neighbors > 6) continue
          const ring = [p2, p3, p4, p5, p6, p7, p8, p9, p2]
          let transitions = 0
          for (let i = 0; i < 8; i++) if (ring[i] === 0 && ring[i + 1] === 1) transitions += 1
          if (transitions !== 1) continue
          if (
            pass === 0
              ? p2 * p4 * p6 !== 0 || p4 * p6 * p8 !== 0
              : p2 * p4 * p8 !== 0 || p2 * p6 * p8 !== 0
          )
            continue
          marked.push(y * width + x)
        }
      }
      for (const index of marked) data[index] = 0
      if (marked.length > 0) changed = true
    }
  }
  return { width, height, data }
}
