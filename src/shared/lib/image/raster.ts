/** 회색조 그림 (0 검정 ~ 255 흰색) */
export type GrayImage = { width: number; height: number; data: Uint8Array }

/** 이진 그림 (1 잉크, 0 바탕) */
export type BinaryImage = { width: number; height: number; data: Uint8Array }

export function createGray(width: number, height: number, fill = 255): GrayImage {
  return { width, height, data: new Uint8Array(width * height).fill(fill) }
}

export function createBinary(width: number, height: number): BinaryImage {
  return { width, height, data: new Uint8Array(width * height) }
}

/** RGBA → 회색조 (밝기 가중치 ITU-R BT.601) */
export function rgbaToGray(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
): GrayImage {
  const data = new Uint8Array(width * height)
  for (let i = 0, j = 0; i < data.length; i++, j += 4) {
    const alpha = rgba[j + 3]! / 255
    // 투명한 곳은 흰 종이로 봅니다.
    const luma = 0.299 * rgba[j]! + 0.587 * rgba[j + 1]! + 0.114 * rgba[j + 2]!
    data[i] = Math.round(luma * alpha + 255 * (1 - alpha))
  }
  return { width, height, data }
}

/** 겹선형 보간으로 한 점의 밝기 (그림 밖은 흰색) */
export function sampleGray(image: GrayImage, x: number, y: number): number {
  const { width, height, data } = image
  if (x < 0 || y < 0 || x > width - 1 || y > height - 1) return 255
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(width - 1, x0 + 1)
  const y1 = Math.min(height - 1, y0 + 1)
  const fx = x - x0
  const fy = y - y0
  const a = data[y0 * width + x0]!
  const b = data[y0 * width + x1]!
  const c = data[y1 * width + x0]!
  const d = data[y1 * width + x1]!
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy
}

/** p(0~1) 분위수 밝기 */
export function percentile(image: GrayImage, p: number): number {
  const histogram = new Uint32Array(256)
  for (const v of image.data) histogram[v]! += 1
  const target = p * image.data.length
  let sum = 0
  for (let v = 0; v < 256; v++) {
    sum += histogram[v]!
    if (sum >= target) return v
  }
  return 255
}

export function countInk(image: BinaryImage): number {
  let count = 0
  for (const v of image.data) count += v
  return count
}
