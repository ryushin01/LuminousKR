import { type BinaryImage, type GrayImage, createBinary, percentile } from './raster.ts'

/**
 * 적응형 이진화 (Bradley–Roth): 주변 평균보다 ratio만큼 어두우면 잉크.
 * 사진의 그림자·조명 차이에 강합니다. 적분 영상으로 창 크기와 상관없이 빠르게 계산합니다.
 */
export function adaptiveBinarize(
  image: GrayImage,
  options: { window?: number; ratio?: number } = {},
): BinaryImage {
  const { width, height, data } = image
  const half = Math.max(2, Math.round((options.window ?? Math.max(width, height) / 12) / 2))
  const ratio = options.ratio ?? 0.22
  const integral = new Float64Array((width + 1) * (height + 1))
  for (let y = 0; y < height; y++) {
    let rowSum = 0
    for (let x = 0; x < width; x++) {
      rowSum += data[y * width + x]!
      integral[(y + 1) * (width + 1) + (x + 1)] = integral[y * (width + 1) + (x + 1)]! + rowSum
    }
  }
  const out = createBinary(width, height)
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - half)
    const y1 = Math.min(height - 1, y + half)
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - half)
      const x1 = Math.min(width - 1, x + half)
      const count = (x1 - x0 + 1) * (y1 - y0 + 1)
      const sum =
        integral[(y1 + 1) * (width + 1) + (x1 + 1)]! -
        integral[y0 * (width + 1) + (x1 + 1)]! -
        integral[(y1 + 1) * (width + 1) + x0]! +
        integral[y0 * (width + 1) + x0]!
      out.data[y * width + x] = data[y * width + x]! * count < sum * (1 - ratio) ? 1 : 0
    }
  }
  return out
}

/** Otsu 문턱값 (두 무리의 분산 차가 가장 큰 밝기) */
export function otsuThreshold(image: GrayImage): number {
  const histogram = new Float64Array(256)
  for (const v of image.data) histogram[v]! += 1
  const total = image.data.length
  let sumAll = 0
  for (let v = 0; v < 256; v++) sumAll += v * histogram[v]!
  let sumBack = 0
  let weightBack = 0
  let best = 0
  let threshold = 127
  for (let v = 0; v < 256; v++) {
    weightBack += histogram[v]!
    if (weightBack === 0) continue
    const weightFore = total - weightBack
    if (weightFore === 0) break
    sumBack += v * histogram[v]!
    const meanBack = sumBack / weightBack
    const meanFore = (sumAll - sumBack) / weightFore
    const between = weightBack * weightFore * (meanBack - meanFore) ** 2
    if (between > best) {
      best = between
      threshold = v
    }
  }
  return threshold
}

/**
 * 칸 하나처럼 작은 그림의 이진화: 종이 밝기(밝은 쪽 분위수)의 일정 비율보다 어두우면 잉크.
 * 연한 회색으로 인쇄한 안내선은 잉크로 보지 않습니다.
 */
export function relativeBinarize(image: GrayImage, darkness = 0.58): BinaryImage {
  const paper = Math.max(1, percentile(image, 0.9))
  const limit = paper * darkness
  const out = createBinary(image.width, image.height)
  for (let i = 0; i < image.data.length; i++) out.data[i] = image.data[i]! < limit ? 1 : 0
  return out
}
