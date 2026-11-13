import { PdfDocument, type PdfPage } from '@/shared/lib/pdf'
import {
  BIT,
  BIT_CENTERS,
  MARKER,
  MARKER_CENTERS,
  PAGE,
  bitsForSet,
  layoutCells,
} from './template-geometry.ts'

/** 양식에 그릴 칸 하나: 자모 이름과 그 자모의 틀(음절 좌표 0~1), 같은 배치의 다른 틀 */
export type TemplateCellSpec = {
  key: string
  label: string
  frame: { x0: number; y0: number; x1: number; y1: number }
  context: { x0: number; y0: number; x1: number; y1: number }[]
}

export type TemplatePageSpec = { id: number; title: string; cells: TemplateCellSpec[] }

/** Helvetica 글자 폭 (AFM, 1000 단위) — ASCII 32~126 */
const HELVETICA_WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833,
  722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556,
  556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334,
  260, 334, 584,
] // prettier-ignore

function helveticaWidth(text: string, size: number): number {
  let sum = 0
  for (const char of text) sum += HELVETICA_WIDTHS[(char.codePointAt(0) ?? 63) - 32] ?? 556
  return (sum * size) / 1000
}

/** 한글 글리프(조합기 윤곽)와 영문·숫자(Helvetica)를 섞어 한 줄을 씁니다. top은 글자 칸 위쪽. */
function drawText(
  page: PdfPage,
  text: string,
  x: number,
  top: number,
  size: number,
  glyphs: Map<string, string>,
) {
  let cursor = x
  let run = ''
  const latinSize = size * 0.9
  const baseline = top + size * 0.86
  const flush = () => {
    if (!run) return
    page.text(run, cursor, baseline, latinSize)
    cursor += helveticaWidth(run, latinSize)
    run = ''
  }
  for (const char of text) {
    const d = glyphs.get(char)
    if (d !== undefined) {
      flush()
      page.svgPath(d, cursor - size * 0.03, top, size / 1000)
      cursor += size * 0.94
    } else if (char === ' ' && !run) {
      cursor += size * 0.3
    } else {
      run += char
    }
  }
  flush()
}

/** 양식에 쓰는 한글 글자 모두 (글리프를 미리 받아 두기 위해) */
export function templateText(pages: readonly TemplatePageSpec[]): string {
  return [
    INSTRUCTION_LINES.join(''),
    TITLE_PREFIX,
    ...pages.map((p) => p.title),
    ...pages.flatMap((p) => p.cells.map((c) => c.label)),
  ].join('')
}

const TITLE_PREFIX = '손글씨 양식 '
const INSTRUCTION_LINES = [
  '점선 틀 안에 굵은 펜으로 자모의 가운데 선을 그리세요. 틀 밖으로 조금 나가도 괜찮습니다.',
  '네 모서리의 검은 네모가 모두 보이게 사진을 찍거나 스캔해서 LuminousKR의 가져오기에 올리세요.',
]

/**
 * 손글씨 양식 PDF (A4, 양식 한 종류에 한 쪽)
 * @param glyphs 한글 글자 → SVG 경로(1em = 1000, 위가 0)
 */
export function buildTemplatePdf(
  pages: readonly TemplatePageSpec[],
  glyphs: Map<string, string>,
): Uint8Array<ArrayBuffer> {
  const doc = new PdfDocument()
  for (const spec of pages) {
    const page = doc.addPage(PAGE.width, PAGE.height)

    // 네 모서리 표식
    page.fill(0)
    for (const c of MARKER_CENTERS)
      page.fillRect(c.x - MARKER.size / 2, c.y - MARKER.size / 2, MARKER.size, MARKER.size)
    // 양식 번호 (칠한 칸 = 1)
    bitsForSet(spec.id).forEach((bit, i) => {
      const c = BIT_CENTERS[i]!
      if (bit) page.fill(0).fillRect(c.x - BIT.size / 2, c.y - BIT.size / 2, BIT.size, BIT.size)
      else
        page
          .stroke(0.75, 0.6)
          .strokeRect(c.x - BIT.size / 2, c.y - BIT.size / 2, BIT.size, BIT.size)
    })

    page.fill(0.35)
    page.text('LuminousKR', 56, 74, 9)
    page.fill(0)
    drawText(page, `${TITLE_PREFIX}${spec.title}`, 56, 82, 17, glyphs)
    page.fill(0.3)
    INSTRUCTION_LINES.forEach((line, i) => drawText(page, line, 56, 110 + i * 14, 9.5, glyphs))

    const rects = layoutCells(spec.cells.map((c) => c.key))
    spec.cells.forEach((cell, i) => {
      const rect = rects[i]!
      page.fill(0.15)
      drawText(page, cell.label, rect.x, rect.y - 15, 10.5, glyphs)
      // 칸(음절 정사각형)과 같은 배치의 다른 자모 자리 (아주 연하게)
      page.stroke(0.82, 0.5).strokeRect(rect.x, rect.y, rect.size, rect.size)
      page.stroke(0.88, 0.5, [1.5, 2.5])
      for (const box of cell.context) {
        page.strokeRect(
          rect.x + box.x0 * rect.size,
          rect.y + box.y0 * rect.size,
          (box.x1 - box.x0) * rect.size,
          (box.y1 - box.y0) * rect.size,
        )
      }
      // 이 자모를 그릴 틀
      const f = cell.frame
      page.stroke(0.7, 0.7, [2.5, 2])
      page.strokeRect(
        rect.x + f.x0 * rect.size,
        rect.y + f.y0 * rect.size,
        (f.x1 - f.x0) * rect.size,
        (f.y1 - f.y0) * rect.size,
      )
    })

    page.fill(0.45)
    page.text('github.com/ryushin01/LuminousKR', PAGE.width / 2 - 62, PAGE.height - 34, 8)
  }
  return doc.toBytes({ title: 'LuminousKR 손글씨 양식' })
}
