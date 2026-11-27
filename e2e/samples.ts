import type { Page } from '@playwright/test'
import {
  BIT,
  BIT_CENTERS,
  MARKER,
  MARKER_CENTERS,
  PAGE,
  bitsForSet,
  layoutCells,
} from '../src/pages/import/lib/template-geometry.ts'

/** 기본 자모 양식의 칸 순서 (앞쪽 일부) */
const BASIC_KEYS = [
  'L0',
  'L2',
  'L3',
  'L5',
  'L6',
  'L7',
  'L9',
  'L11',
  'L12',
  'L14',
  'L15',
  'L16',
  'L17',
  'L18',
  'V0',
]

/**
 * 기본 자모 양식에 펜 획(ㄱ, ㅇ, ㅏ)을 그려 사진처럼 살짝 돌린 JPEG를 브라우저 캔버스로 만듭니다.
 * 인식하면 3자를 찾습니다.
 */
export async function filledTemplatePhoto(page: Page): Promise<Buffer> {
  const geometry = {
    page: PAGE,
    markers: MARKER_CENTERS,
    bits: BIT_CENTERS,
    bitSize: BIT.size,
    markerSize: MARKER.size,
    bits1: bitsForSet(1),
    cells: layoutCells(BASIC_KEYS),
  }
  // 브라우저 캔버스에 양식과 펜 획(ㄱ, ㅇ, ㅏ)을 그리고, 사진처럼 살짝 돌립니다.
  const dataUrl = await page.evaluate((g) => {
    const scale = 2.2
    const sheet = document.createElement('canvas')
    sheet.width = Math.round(g.page.width * scale)
    sheet.height = Math.round(g.page.height * scale)
    const c = sheet.getContext('2d')!
    c.fillStyle = '#f6f5f2'
    c.fillRect(0, 0, sheet.width, sheet.height)
    c.fillStyle = '#111'
    for (const m of g.markers)
      c.fillRect(
        (m.x - g.markerSize / 2) * scale,
        (m.y - g.markerSize / 2) * scale,
        g.markerSize * scale,
        g.markerSize * scale,
      )
    g.bits1.forEach((bit: boolean, i: number) => {
      if (!bit) return
      const b = g.bits[i]!
      c.fillRect(
        (b.x - g.bitSize / 2) * scale,
        (b.y - g.bitSize / 2) * scale,
        g.bitSize * scale,
        g.bitSize * scale,
      )
    })
    c.strokeStyle = '#d0d0d0'
    c.lineWidth = 1
    for (const cell of g.cells)
      c.strokeRect(cell.x * scale, cell.y * scale, cell.size * scale, cell.size * scale)
    const at = (key: string, u: number, v: number) => {
      const cell = g.cells.find((x: { key: string }) => x.key === key)!
      return [(cell.x + u * cell.size) * scale, (cell.y + v * cell.size) * scale] as const
    }
    c.strokeStyle = '#1c1c28'
    c.lineWidth = 5.5
    c.lineCap = 'round'
    c.lineJoin = 'round'
    c.beginPath()
    c.moveTo(...at('L0', 0.1, 0.2))
    c.lineTo(...at('L0', 0.42, 0.2))
    c.lineTo(...at('L0', 0.42, 0.86))
    c.stroke()
    const [ox, oy] = at('L11', 0.27, 0.5)
    c.beginPath()
    c.ellipse(ox, oy, 0.18 * 86 * scale, 0.24 * 86 * scale, 0, 0, Math.PI * 2)
    c.stroke()
    c.beginPath()
    c.moveTo(...at('V0', 0.74, 0.05))
    c.lineTo(...at('V0', 0.74, 0.95))
    c.moveTo(...at('V0', 0.74, 0.48))
    c.lineTo(...at('V0', 0.95, 0.48))
    c.stroke()

    const photo = document.createElement('canvas')
    photo.width = sheet.width + 160
    photo.height = sheet.height + 160
    const p = photo.getContext('2d')!
    p.fillStyle = '#6b6f78'
    p.fillRect(0, 0, photo.width, photo.height)
    p.translate(photo.width / 2, photo.height / 2)
    p.rotate((3 * Math.PI) / 180)
    p.drawImage(sheet, -sheet.width / 2, -sheet.height / 2)
    return photo.toDataURL('image/jpeg', 0.9)
  }, geometry)

  return Buffer.from(dataUrl.split(',')[1]!, 'base64')
}

/**
 * pdf.js가 사이트 안의 자료를 받아야 그리는 PDF 한 쪽: 넣지 않은 표준 글꼴(ZapfDingbats)의 글자와
 * DeviceCMYK 색(ICC 변환 WASM과 CMYK 프로필을 씀)으로 칠한 사각형. 자료가 없으면 pdf.js가 경고를 남깁니다.
 */
export function pdfNeedingPdfjsData(): Buffer {
  const content = '0 0 0 1 k 20 20 160 40 re f BT /F1 36 Tf 40 120 Td (4n) Tj ET'
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /ZapfDingbats >>',
  ]
  let out = '%PDF-1.7\n'
  const offsets: number[] = []
  objects.forEach((object, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) out += `${String(offset).padStart(10, '0')} 00000 n \n`
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}
