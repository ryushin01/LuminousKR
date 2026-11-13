// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Point } from '@/shared/lib/geometry'
import {
  type GrayImage,
  type Homography,
  applyHomography,
  createGray,
  sampleGray,
  solveHomography,
} from '@/shared/lib/image'
import { recognizePage, recognizeSingle, type RecognizedStroke } from './recognize.ts'
import {
  BIT,
  BIT_CENTERS,
  MARKER,
  MARKER_CENTERS,
  PAGE,
  type TemplateGeometry,
  bitsForSet,
  layoutCells,
} from './template-geometry.ts'

const KEYS = ['L0', 'L2', 'L11', 'V0', 'V8']
const GEOMETRY: TemplateGeometry = {
  page: PAGE,
  markers: MARKER_CENTERS,
  bits: BIT_CENTERS,
  sets: [
    { id: 1, cells: layoutCells(KEYS) },
    { id: 2, cells: layoutCells(['L1']) },
  ],
}

/* ── 합성 그림 그리기 ── */

function fillRect(img: GrayImage, x: number, y: number, w: number, h: number, value: number) {
  for (let j = Math.max(0, Math.floor(y)); j < Math.min(img.height, Math.ceil(y + h)); j++)
    for (let i = Math.max(0, Math.floor(x)); i < Math.min(img.width, Math.ceil(x + w)); i++)
      img.data[j * img.width + i] = value
}

function thickLine(img: GrayImage, a: Point, b: Point, radius: number, value = 25) {
  const x0 = Math.floor(Math.min(a.x, b.x) - radius)
  const x1 = Math.ceil(Math.max(a.x, b.x) + radius)
  const y0 = Math.floor(Math.min(a.y, b.y) - radius)
  const y1 = Math.ceil(Math.max(a.y, b.y) + radius)
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy || 1
  for (let y = Math.max(0, y0); y <= Math.min(img.height - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(img.width - 1, x1); x++) {
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2))
      if (Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy)) <= radius)
        img.data[y * img.width + x] = value
    }
  }
}

function ring(img: GrayImage, c: Point, rx: number, ry: number, radius: number) {
  for (let i = 0; i < 360; i += 2) {
    const a1 = (i * Math.PI) / 180
    const a2 = ((i + 2) * Math.PI) / 180
    thickLine(
      img,
      { x: c.x + Math.cos(a1) * rx, y: c.y + Math.sin(a1) * ry },
      { x: c.x + Math.cos(a2) * rx, y: c.y + Math.sin(a2) * ry },
      radius,
    )
  }
}

/** 양식 한 장(scale 픽셀/pt)을 그리고, 몇 칸에 펜 획을 넣습니다. */
function drawFilledTemplate(scale: number, setId = 1): GrayImage {
  const img = createGray(Math.round(PAGE.width * scale), Math.round(PAGE.height * scale), 246)
  const s = (v: number) => v * scale
  for (const c of MARKER_CENTERS)
    fillRect(
      img,
      s(c.x - MARKER.size / 2),
      s(c.y - MARKER.size / 2),
      s(MARKER.size),
      s(MARKER.size),
      15,
    )
  bitsForSet(setId).forEach((bit, i) => {
    const c = BIT_CENTERS[i]!
    if (bit)
      fillRect(img, s(c.x - BIT.size / 2), s(c.y - BIT.size / 2), s(BIT.size), s(BIT.size), 15)
  })
  const cells = GEOMETRY.sets.find((set) => set.id === setId)!.cells
  for (const cell of cells) {
    // 연한 회색 칸 테두리 (인식에서 빠져야 함)
    const x = s(cell.x)
    const y = s(cell.y)
    const size = s(cell.size)
    fillRect(img, x, y, size, 1, 205)
    fillRect(img, x, y + size - 1, size, 1, 205)
    fillRect(img, x, y, 1, size, 205)
    fillRect(img, x + size - 1, y, 1, size, 205)
  }
  const at = (key: string, u: number, v: number): Point => {
    const cell = cells.find((c) => c.key === key)!
    return { x: s(cell.x + u * cell.size), y: s(cell.y + v * cell.size) }
  }
  const pen = s(2.4)
  if (setId === 1) {
    // ㄱ
    thickLine(img, at('L0', 0.1, 0.2), at('L0', 0.42, 0.2), pen)
    thickLine(img, at('L0', 0.42, 0.2), at('L0', 0.42, 0.85), pen)
    // ㅇ
    const center = at('L11', 0.27, 0.5)
    ring(img, center, s(0.18 * 86), s(0.24 * 86), pen)
    // ㅏ
    thickLine(img, at('V0', 0.72, 0.05), at('V0', 0.72, 0.95), pen)
    thickLine(img, at('V0', 0.72, 0.48), at('V0', 0.95, 0.48), pen)
  } else {
    thickLine(img, at('L1', 0.1, 0.2), at('L1', 0.25, 0.2), pen)
    thickLine(img, at('L1', 0.25, 0.2), at('L1', 0.25, 0.85), pen)
  }
  return img
}

/** 사진처럼 기울이고 원근을 줍니다. */
function photograph(page: GrayImage, corners: Point[], width: number, height: number): GrayImage {
  const h: Homography = solveHomography(corners, [
    { x: 0, y: 0 },
    { x: page.width, y: 0 },
    { x: page.width, y: page.height },
    { x: 0, y: page.height },
  ])!
  const out = createGray(width, height, 120)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = applyHomography(h, { x, y })
      if (p.x >= 0 && p.y >= 0 && p.x < page.width && p.y < page.height) {
        // 왼쪽이 조금 어두운 조명
        out.data[y * width + x] = Math.round(
          sampleGray(page, p.x, p.y) * (0.82 + 0.18 * (x / width)),
        )
      }
    }
  }
  return out
}

const pathOf = (strokes: RecognizedStroke[]) => strokes.filter((s) => s.kind === 'path')

describe('손글씨 양식 인식', () => {
  it('반듯한 스캔에서 양식 번호와 칸별 획을 찾습니다', () => {
    const result = recognizePage(drawFilledTemplate(2), GEOMETRY, {
      divisions: null,
      smooth: false,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.setId).toBe(1)
    expect(result.cells.map((c) => c.key).sort()).toEqual(['L0', 'L11', 'V0'])
    expect(result.empty.sort()).toEqual(['L2', 'V8'])

    const giyeok = result.cells.find((c) => c.key === 'L0')!
    expect(pathOf(giyeok.strokes)).toHaveLength(1)
    const [stroke] = pathOf(giyeok.strokes)
    expect(stroke?.kind === 'path' && stroke.points.length).toBeLessThanOrEqual(4)
    expect(giyeok.penWidth).toBeGreaterThan(0.03)

    const ieung = result.cells.find((c) => c.key === 'L11')!
    expect(ieung.strokes).toHaveLength(1)
    expect(ieung.strokes[0]).toMatchObject({
      kind: 'ellipse',
      cx: expect.closeTo(0.27, 1),
      cy: expect.closeTo(0.5, 1),
    })

    // ㅏ: 세로획이 가지에서 끊기지 않고 한 획으로, 가지는 따로
    const a = result.cells.find((c) => c.key === 'V0')!
    expect(pathOf(a.strokes)).toHaveLength(2)
  })

  it('기울고 원근이 있는 사진도 표식으로 바로잡아 인식합니다', () => {
    const page = drawFilledTemplate(1.6)
    const photo = photograph(
      page,
      [
        { x: 90, y: 60 },
        { x: 1010, y: 110 },
        { x: 960, y: 1430 },
        { x: 60, y: 1390 },
      ],
      1080,
      1480,
    )
    const result = recognizePage(photo, GEOMETRY, { divisions: 24, smooth: false })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.cells.map((c) => c.key).sort()).toEqual(['L0', 'L11', 'V0'])
    // 격자에 맞추면 좌표가 1/24 칸 위에 있습니다.
    for (const stroke of pathOf(result.cells.find((c) => c.key === 'L0')!.strokes)) {
      if (stroke.kind !== 'path') continue
      for (const p of stroke.points)
        expect(Math.abs(p.x * 24 - Math.round(p.x * 24))).toBeLessThan(1e-9)
    }
  })

  it('뒤집혀 찍힌 사진도 양식 번호로 방향을 맞춥니다', () => {
    const page = drawFilledTemplate(1.5)
    const rotated = createGray(page.width, page.height)
    for (let i = 0; i < page.data.length; i++)
      rotated.data[i] = page.data[page.data.length - 1 - i]!
    const result = recognizePage(rotated, GEOMETRY, { divisions: null, smooth: false })
    expect(result.ok && result.cells.map((c) => c.key).sort()).toEqual(['L0', 'L11', 'V0'])
  })

  it('다른 양식(번호 2)을 알아봅니다', () => {
    const result = recognizePage(drawFilledTemplate(1.5, 2), GEOMETRY, {
      divisions: null,
      smooth: false,
    })
    expect(result.ok && result.setId).toBe(2)
    expect(result.ok && result.cells.map((c) => c.key)).toEqual(['L1'])
  })

  it('표식이 없는 그림은 원인과 다시 찍는 방법을 알립니다', () => {
    const blank = createGray(800, 1100, 240)
    const result = recognizePage(blank, GEOMETRY, { divisions: null, smooth: false })
    expect(result).toMatchObject({ ok: false, reason: 'markers' })
    expect(!result.ok && result.message).toContain('다시 찍어')
  })
})

describe('양식 없이 그림 한 장', () => {
  it('그린 범위를 자모 틀에 맞춰 놓습니다', () => {
    const img = createGray(400, 300, 250)
    thickLine(img, { x: 120, y: 60 }, { x: 120, y: 230 }, 7)
    thickLine(img, { x: 120, y: 230 }, { x: 300, y: 230 }, 7)
    const frame = { x0: 0.1, y0: 0.2, x1: 0.5, y1: 0.8 }
    const result = recognizeSingle(img, frame, { divisions: null, smooth: false })!
    expect(result.strokes).toHaveLength(1)
    const stroke = result.strokes[0]!
    if (stroke.kind !== 'path') throw new Error('경로 획이어야 합니다')
    for (const p of stroke.points) {
      expect(p.x).toBeGreaterThanOrEqual(frame.x0 - 0.02)
      expect(p.x).toBeLessThanOrEqual(frame.x1 + 0.02)
      expect(p.y).toBeGreaterThanOrEqual(frame.y0 - 0.02)
      expect(p.y).toBeLessThanOrEqual(frame.y1 + 0.02)
    }
  })

  it('잉크가 없으면 null', () => {
    expect(
      recognizeSingle(
        createGray(100, 100, 250),
        { x0: 0, y0: 0, x1: 1, y1: 1 },
        { divisions: null, smooth: false },
      ),
    ).toBeNull()
  })
})
