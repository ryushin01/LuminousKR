import { describe, expect, it } from 'vitest'
import { A4, PdfDocument } from './writer.ts'

const decode = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes)

describe('PDF 작성기', () => {
  it('PDF 1.7 머리말과 교차 참조 표(xref)를 바르게 씁니다', () => {
    const doc = new PdfDocument()
    const page = doc.addPage()
    page.fill(0).fillRect(10, 10, 20, 20)
    page.stroke(0.5, 1, [2, 2]).strokeRect(40, 40, 100, 100)
    page.text('LuminousKR (1/2)', 56, 70, 9)
    doc.addPage()
    const text = decode(doc.toBytes({ title: '손글씨 양식' }))
    expect(text.startsWith('%PDF-1.7')).toBe(true)
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true)
    expect(text).toContain('/Count 2')
    expect(text).toContain(`/MediaBox [0 0 ${A4.width} ${A4.height}]`)
    // 괄호는 이스케이프됩니다.
    expect(text).toContain('(LuminousKR \\(1/2\\))')
    // 한국어 제목은 UTF-16BE 16진 문자열
    expect(text).toContain('/Title <FEFF')

    // xref의 각 위치가 실제 'n 0 obj'를 가리킵니다.
    const startxref = Number(text.match(/startxref\n(\d+)/)![1])
    const xref = text.slice(startxref)
    const offsets = [...xref.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]))
    offsets.forEach((offset, i) =>
      expect(text.slice(offset, offset + 12)).toMatch(new RegExp(`^${i + 1} 0 obj`)),
    )
  })

  it('SVG 경로(y 아래로)를 PDF 좌표(y 위로)의 채운 경로로 바꿉니다', () => {
    const doc = new PdfDocument()
    const page = doc.addPage(100, 100)
    page.svgPath('M0 0L1000 0L1000 1000Z', 10, 10, 0.05)
    expect(page.content()).toBe('10 90 m\n60 90 l\n60 40 l\nh\nf')
  })
})
