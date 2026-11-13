import type { Point } from '../geometry/index.ts'
import type { BinaryImage } from './raster.ts'

export type TracedStroke = { points: Point[]; closed: boolean }

export type TraceOptions = {
  /** 이보다 짧은 끝가지(굵은 획을 깎을 때 생기는 잔가지)는 지웁니다 (픽셀) */
  spurLength: number
  /** 교차점에서 두 가지가 이만큼 곧게 이어지면 한 획으로 봅니다 (방향 코사인, -1이 정반대) */
  straightness: number
  /** 가지 방향을 잴 때 교차점에서 떨어진 거리 (픽셀) */
  directionReach: number
}

const DEFAULT_TRACE: TraceOptions = { spurLength: 8, straightness: -0.72, directionReach: 8 }

type Edge = { a: number; b: number; points: Point[]; alive: boolean }
type GraphNode = { x: number; y: number; edges: Set<number>; end: boolean }
type End = 'a' | 'b'

/**
 * 한 픽셀 두께 뼈대를 획(꺾은선)으로 바꿉니다.
 * 1) m-인접(대각선은 사이에 직교 이웃이 없을 때만)으로 이웃 수를 세어 끝점·교차점을 찾고
 * 2) 교차점 픽셀 무리를 한 마디로 묶은 뒤 마디 사이 가지를 따라가고
 * 3) 짧은 끝가지를 지우고, 교차점에서 곧게 이어지는 가지끼리 한 획으로 잇습니다.
 */
export function traceSkeleton(
  skeleton: BinaryImage,
  partial: Partial<TraceOptions> = {},
): TracedStroke[] {
  const options = { ...DEFAULT_TRACE, ...partial }
  const { width, height, data } = skeleton
  const on = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && data[y * width + x] === 1

  const neighbors = (index: number): number[] => {
    const x = index % width
    const y = (index - x) / width
    const out: number[] = []
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ] as const) {
      if (on(x + dx, y + dy)) out.push((y + dy) * width + x + dx)
    }
    for (const [dx, dy] of [
      [1, -1],
      [1, 1],
      [-1, 1],
      [-1, -1],
    ] as const) {
      if (on(x + dx, y + dy) && !on(x + dx, y) && !on(x, y + dy))
        out.push((y + dy) * width + x + dx)
    }
    return out
  }

  const pixels: number[] = []
  const degree = new Int8Array(data.length)
  for (let i = 0; i < data.length; i++) {
    if (data[i] !== 1) continue
    pixels.push(i)
    degree[i] = Math.min(8, neighbors(i).length)
  }

  // 끝점·교차점 마디 (교차점 픽셀 무리는 하나로)
  const nodeOf = new Int32Array(data.length).fill(-1)
  const nodes: GraphNode[] = []
  for (const start of pixels) {
    if (degree[start] === 2 || degree[start] === 0 || nodeOf[start] !== -1) continue
    const id = nodes.length
    const cluster = [start]
    nodeOf[start] = id
    if (degree[start]! >= 3) {
      for (let k = 0; k < cluster.length; k++) {
        for (const n of neighbors(cluster[k]!)) {
          if (degree[n]! >= 3 && nodeOf[n] === -1) {
            nodeOf[n] = id
            cluster.push(n)
          }
        }
      }
    }
    let sx = 0
    let sy = 0
    for (const p of cluster) {
      sx += p % width
      sy += Math.floor(p / width)
    }
    nodes.push({
      x: sx / cluster.length,
      y: sy / cluster.length,
      edges: new Set(),
      end: degree[start] === 1,
    })
  }

  const point = (index: number): Point => ({ x: index % width, y: Math.floor(index / width) })
  const edges: Edge[] = []
  const visited = new Uint8Array(data.length)
  const directPairs = new Set<string>()

  const addEdge = (a: number, b: number, path: number[]) => {
    const points = path.map(point)
    points[0] = { x: nodes[a]!.x, y: nodes[a]!.y }
    points[points.length - 1] = { x: nodes[b]!.x, y: nodes[b]!.y }
    const id = edges.length
    edges.push({ a, b, points, alive: true })
    nodes[a]!.edges.add(id)
    nodes[b]!.edges.add(id)
  }

  for (const start of pixels) {
    const from = nodeOf[start]!
    if (from === -1) continue
    for (const first of neighbors(start)) {
      if (nodeOf[first] === from) continue
      if (nodeOf[first]! >= 0) {
        const key = start < first ? `${start}-${first}` : `${first}-${start}`
        if (!directPairs.has(key)) {
          directPairs.add(key)
          addEdge(from, nodeOf[first]!, [start, first])
        }
        continue
      }
      if (visited[first]) continue
      const path = [start, first]
      visited[first] = 1
      let prev = start
      let current = first
      let to = -1
      for (let guard = 0; guard < data.length; guard++) {
        const next = neighbors(current).find((n) => n !== prev)
        if (next === undefined) break
        if (nodeOf[next]! >= 0) {
          path.push(next)
          to = nodeOf[next]!
          break
        }
        if (visited[next]) break
        visited[next] = 1
        path.push(next)
        prev = current
        current = next
      }
      if (to >= 0) addEdge(from, to, path)
    }
  }

  // 끝점·교차점이 없는 고리 (ㅇ처럼)
  const loops: TracedStroke[] = []
  for (const start of pixels) {
    if (degree[start] !== 2 || visited[start]) continue
    const path = [start]
    visited[start] = 1
    let prev = -1
    let current = start
    for (let guard = 0; guard < data.length; guard++) {
      const next = neighbors(current).find((n) => n !== prev && (!visited[n] || n === start))
      if (next === undefined || next === start) break
      visited[next] = 1
      path.push(next)
      prev = current
      current = next
    }
    if (path.length >= 8) loops.push({ points: path.map(point), closed: true })
  }

  const lengthOf = (points: Point[]) => {
    let sum = 0
    for (let i = 1; i < points.length; i++)
      sum += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y)
    return sum
  }
  /** 마디에 붙은 가지 수 (자기 자신으로 돌아오는 고리는 양 끝이 모두 붙으므로 둘로 셈) */
  const branchCount = (nodeId: number) => {
    let count = 0
    for (const id of nodes[nodeId]!.edges) {
      const edge = edges[id]!
      if (edge.a === nodeId) count += 1
      if (edge.b === nodeId) count += 1
    }
    return count
  }
  const kill = (id: number) => {
    const edge = edges[id]!
    edge.alive = false
    nodes[edge.a]!.edges.delete(id)
    nodes[edge.b]!.edges.delete(id)
  }

  // 짧은 끝가지 지우기 (교차점에 붙은 것), 아주 짧은 외톨이 조각 지우기
  for (let round = 0; round < 3; round++) {
    let removed = false
    edges.forEach((edge, id) => {
      if (!edge.alive) return
      const a = nodes[edge.a]!
      const b = nodes[edge.b]!
      const length = lengthOf(edge.points)
      const spur = (a.end && branchCount(edge.b) >= 3) || (b.end && branchCount(edge.a) >= 3)
      const crumb = a.end && b.end && length < options.spurLength * 0.6
      if ((spur && length < options.spurLength) || crumb) {
        kill(id)
        removed = true
      }
    })
    if (!removed) break
  }

  // 교차점에서 곧게 이어지는 가지끼리 짝짓기
  const links = new Map<string, { edge: number; end: End }>()
  const endKey = (edge: number, end: End) => `${edge}:${end}`
  const directionFrom = (edge: Edge, end: End): Point => {
    const pts = end === 'a' ? edge.points : [...edge.points].reverse()
    const origin = pts[0]!
    let target = pts[pts.length - 1]!
    let walked = 0
    for (let i = 1; i < pts.length; i++) {
      walked += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y)
      if (walked >= options.directionReach) {
        target = pts[i]!
        break
      }
    }
    const dx = target.x - origin.x
    const dy = target.y - origin.y
    const len = Math.hypot(dx, dy) || 1
    return { x: dx / len, y: dy / len }
  }

  nodes.forEach((node, nodeId) => {
    const ends: { edge: number; end: End; dir: Point }[] = []
    for (const id of node.edges) {
      const edge = edges[id]!
      if (edge.a === nodeId) ends.push({ edge: id, end: 'a', dir: directionFrom(edge, 'a') })
      if (edge.b === nodeId) ends.push({ edge: id, end: 'b', dir: directionFrom(edge, 'b') })
    }
    if (ends.length < 2) return
    const pairs: { i: number; j: number; dot: number }[] = []
    for (let i = 0; i < ends.length; i++) {
      for (let j = i + 1; j < ends.length; j++) {
        const dot = ends[i]!.dir.x * ends[j]!.dir.x + ends[i]!.dir.y * ends[j]!.dir.y
        if (ends.length === 2 || dot < options.straightness) pairs.push({ i, j, dot })
      }
    }
    pairs.sort((p, q) => p.dot - q.dot)
    const used = new Set<number>()
    for (const { i, j } of pairs) {
      if (used.has(i) || used.has(j)) continue
      used.add(i)
      used.add(j)
      const a = ends[i]!
      const b = ends[j]!
      links.set(endKey(a.edge, a.end), { edge: b.edge, end: b.end })
      links.set(endKey(b.edge, b.end), { edge: a.edge, end: a.end })
    }
  })

  // 이어진 가지들을 한 획으로 모읍니다.
  const strokes: TracedStroke[] = []
  const used = new Set<number>()
  const oriented = (edge: Edge, entry: End) =>
    entry === 'a' ? edge.points : [...edge.points].reverse()
  edges.forEach((edge, id) => {
    if (!edge.alive || used.has(id)) return
    used.add(id)
    let points = [...edge.points]
    let closed = false
    // 뒤로 늘이기 (b 끝에서)
    let tail: { edge: number; end: End } = { edge: id, end: 'b' }
    for (;;) {
      const next = links.get(endKey(tail.edge, tail.end))
      if (!next) break
      if (next.edge === id) {
        closed = true
        break
      }
      if (used.has(next.edge)) break
      used.add(next.edge)
      points = points.concat(oriented(edges[next.edge]!, next.end).slice(1))
      tail = { edge: next.edge, end: next.end === 'a' ? 'b' : 'a' }
    }
    // 앞으로 늘이기 (a 끝에서)
    if (!closed) {
      let head: { edge: number; end: End } = { edge: id, end: 'a' }
      for (;;) {
        const prev = links.get(endKey(head.edge, head.end))
        if (!prev || used.has(prev.edge)) break
        used.add(prev.edge)
        const segment = oriented(edges[prev.edge]!, prev.end === 'a' ? 'b' : 'a')
        points = segment.slice(0, -1).concat(points)
        head = { edge: prev.edge, end: prev.end === 'a' ? 'b' : 'a' }
      }
    }
    if (closed && points.length > 1) points.pop()
    strokes.push({ points, closed })
  })

  return [...strokes, ...loops]
}
