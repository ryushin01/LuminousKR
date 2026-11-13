import { describe, expect, it } from 'vitest'
import {
  BIT_CENTERS,
  GRID,
  MARKER_CENTERS,
  PAGE,
  bitsForSet,
  layoutCells,
  setFromBits,
} from './template-geometry.ts'
import { buildTemplatePdf, templateText } from './template-pdf.ts'

describe('손글씨 양식', () => {
  it('양식 번호를 비트로 쓰고 다시 읽습니다 (시작 비트 1)', () => {
    for (const id of [1, 2, 3, 7]) expect(setFromBits(bitsForSet(id))).toBe(id)
    expect(setFromBits([false, true, false, true])).toBeNull()
  })

  it('칸이 표식과 겹치지 않고 종이 안에 들어갑니다', () => {
    const cells = layoutCells(Array.from({ length: 25 }, (_, i) => `L${i % 19}`))
    for (const cell of cells) {
      expect(cell.x).toBeGreaterThan(MARKER_CENTERS[0]!.x + 11)
      expect(cell.x + cell.size).toBeLessThan(PAGE.width - 39)
      expect(cell.y + cell.size).toBeLessThan(MARKER_CENTERS[2]!.y - 11)
    }
    expect(cells[5]!.y - cells[0]!.y).toBe(GRID.label + GRID.cell + GRID.rowGap)
    expect(BIT_CENTERS).toHaveLength(4)
  })

  it('PDF에 쪽마다 표식·칸과 한글 글리프 경로를 그립니다', () => {
    const pages = [
      {
        id: 1,
        title: '기본 자모 24자',
        cells: [
          { key: 'L0', label: 'ㄱ 초성', frame: { x0: 0, y0: 0.1, x1: 0.5, y1: 0.9 }, context: [] },
        ],
      },
    ]
    const used = new Set(templateText(pages))
    expect(used.has('ㄱ')).toBe(true)
    const glyphs = new Map([...used].map((c) => [c, 'M0 0L500 0L500 500Z']))
    const pdf = new TextDecoder('latin1').decode(buildTemplatePdf(pages, glyphs))
    expect(pdf).toContain('/Count 1')
    expect(pdf.match(/ re f/g)!.length).toBeGreaterThanOrEqual(4 + 2) // 표식 4개 + 칠한 비트 2개
    expect(pdf).toContain('(LuminousKR)')
  })
})
