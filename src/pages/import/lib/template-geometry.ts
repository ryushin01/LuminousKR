/**
 * 손글씨 양식의 기하 (pt, 왼쪽 위 원점). 인식 워커도 이 값을 그대로 씁니다.
 * - 네 모서리의 검은 네모(표식)로 사진의 원근을 바로잡습니다.
 * - 위쪽 가운데 네 칸(시작 1비트 + 양식 번호 3비트)으로 어떤 양식인지 읽습니다.
 * - 칸 하나는 음절 정사각형 전체이고, 안의 점선 틀에 자모를 그립니다.
 */
import type { Point } from '@/shared/lib/geometry'

export const PAGE = { width: 595.28, height: 841.89 } as const

export const MARKER = { size: 22, inset: 28 } as const

/** 표식 가운데: 왼쪽 위, 오른쪽 위, 오른쪽 아래, 왼쪽 아래 */
export const MARKER_CENTERS: readonly Point[] = (() => {
  const c = MARKER.inset + MARKER.size / 2
  return [
    { x: c, y: c },
    { x: PAGE.width - c, y: c },
    { x: PAGE.width - c, y: PAGE.height - c },
    { x: c, y: PAGE.height - c },
  ]
})()

export const BIT = { size: 10, gap: 6, count: 4, y: MARKER.inset + MARKER.size / 2 } as const

/** 비트 칸 가운데 (첫 칸은 늘 칠한 시작 비트) */
export const BIT_CENTERS: readonly Point[] = Array.from({ length: BIT.count }, (_, i) => {
  const total = BIT.count * BIT.size + (BIT.count - 1) * BIT.gap
  return { x: PAGE.width / 2 - total / 2 + BIT.size / 2 + i * (BIT.size + BIT.gap), y: BIT.y }
})

export function bitsForSet(id: number): boolean[] {
  return [true, Boolean(id & 4), Boolean(id & 2), Boolean(id & 1)]
}

export function setFromBits(bits: readonly boolean[]): number | null {
  if (bits.length !== BIT.count || !bits[0]) return null
  return (bits[1] ? 4 : 0) + (bits[2] ? 2 : 0) + (bits[3] ? 1 : 0)
}

export const GRID = {
  columns: 5,
  cell: 86,
  columnGap: 13,
  label: 17,
  rowGap: 12,
  top: 152,
} as const

export type CellRect = { key: string; x: number; y: number; size: number }

/** 자모 목록을 5열 격자의 칸 위치로 */
export function layoutCells(keys: readonly string[]): CellRect[] {
  const width = GRID.columns * GRID.cell + (GRID.columns - 1) * GRID.columnGap
  const left = (PAGE.width - width) / 2
  return keys.map((key, i) => {
    const column = i % GRID.columns
    const row = Math.floor(i / GRID.columns)
    return {
      key,
      x: left + column * (GRID.cell + GRID.columnGap),
      y: GRID.top + row * (GRID.label + GRID.cell + GRID.rowGap) + GRID.label,
      size: GRID.cell,
    }
  })
}

/** 인식 워커에 넘기는 양식 정보 */
export type TemplateGeometry = {
  page: { width: number; height: number }
  markers: readonly Point[]
  bits: readonly Point[]
  sets: { id: number; cells: CellRect[] }[]
}
