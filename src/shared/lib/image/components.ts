import type { BinaryImage } from './raster.ts'

export type Component = {
  area: number
  x0: number
  y0: number
  x1: number
  y1: number
  /** 무게중심 */
  cx: number
  cy: number
}

/** 8방향으로 이어진 잉크 덩어리를 찾습니다. */
export function findComponents(image: BinaryImage): {
  labels: Int32Array
  components: Component[]
} {
  const { width, height, data } = image
  const labels = new Int32Array(width * height).fill(-1)
  const components: Component[] = []
  const stack: number[] = []
  for (let start = 0; start < data.length; start++) {
    if (data[start] !== 1 || labels[start] !== -1) continue
    const id = components.length
    const component: Component = { area: 0, x0: width, y0: height, x1: 0, y1: 0, cx: 0, cy: 0 }
    labels[start] = id
    stack.push(start)
    while (stack.length > 0) {
      const index = stack.pop()!
      const x = index % width
      const y = (index - x) / width
      component.area += 1
      component.cx += x
      component.cy += y
      if (x < component.x0) component.x0 = x
      if (y < component.y0) component.y0 = y
      if (x > component.x1) component.x1 = x
      if (y > component.y1) component.y1 = y
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy
        if (ny < 0 || ny >= height) continue
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          if ((dx === 0 && dy === 0) || nx < 0 || nx >= width) continue
          const next = ny * width + nx
          if (data[next] === 1 && labels[next] === -1) {
            labels[next] = id
            stack.push(next)
          }
        }
      }
    }
    component.cx /= component.area
    component.cy /= component.area
    components.push(component)
  }
  return { labels, components }
}

/** minArea보다 작은 잉크 덩어리(잡티, 안내선 조각)를 지웁니다. */
export function removeSmallComponents(image: BinaryImage, minArea: number): BinaryImage {
  const { labels, components } = findComponents(image)
  const data = new Uint8Array(image.data.length)
  for (let i = 0; i < data.length; i++) {
    const label = labels[i]!
    if (label >= 0 && components[label]!.area >= minArea) data[i] = 1
  }
  return { width: image.width, height: image.height, data }
}
