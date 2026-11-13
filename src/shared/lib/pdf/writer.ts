/**
 * 작은 PDF 작성기: 사각형·선·채운 경로와 Helvetica 영문 글자만 씁니다.
 * 좌표는 화면처럼 왼쪽 위가 원점(y 아래로)이고, 단위는 pt(1/72인치)입니다.
 * 한글은 글꼴을 넣지 않고 글리프 윤곽(SVG 경로)을 그대로 그립니다.
 */

export const A4 = { width: 595.28, height: 841.89 } as const

const num = (n: number) => {
  const v = Math.round(n * 100) / 100
  return Object.is(v, -0) ? '0' : String(v)
}

/** PDF 문자열 리터럴(괄호 문자열) 이스케이프. ASCII만 받습니다. */
function pdfString(text: string): string {
  return `(${text.replace(/[\\()]/g, (c) => `\\${c}`).replace(/[^\x20-\x7e]/g, '?')})`
}

/** 한글 등은 UTF-16BE 16진 문자열(<FEFF…>)로 */
function pdfTextString(text: string): string {
  let hex = 'FEFF'
  for (let i = 0; i < text.length; i++)
    hex += text.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase()
  return `<${hex}>`
}

export type Gray = number

export class PdfPage {
  readonly width: number
  readonly height: number
  private readonly ops: string[] = []

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
  }

  private y(value: number): number {
    return this.height - value
  }

  /** 0(검정)~1(흰색) */
  fill(gray: Gray): this {
    this.ops.push(`${num(gray)} g`)
    return this
  }

  stroke(gray: Gray, width = 1, dash: number[] = []): this {
    this.ops.push(`${num(gray)} G`, `${num(width)} w`, `[${dash.map(num).join(' ')}] 0 d`)
    return this
  }

  fillRect(x: number, y: number, w: number, h: number): this {
    this.ops.push(`${num(x)} ${num(this.y(y + h))} ${num(w)} ${num(h)} re f`)
    return this
  }

  strokeRect(x: number, y: number, w: number, h: number): this {
    this.ops.push(`${num(x)} ${num(this.y(y + h))} ${num(w)} ${num(h)} re S`)
    return this
  }

  line(x1: number, y1: number, x2: number, y2: number): this {
    this.ops.push(`${num(x1)} ${num(this.y(y1))} m ${num(x2)} ${num(this.y(y2))} l S`)
    return this
  }

  /**
   * SVG 경로(절대 좌표 M·L·C·Z, y 아래로)를 채워 그립니다.
   * @param d 예: 조합기 글리프 경로 (1em = 1000)
   * @param x 경로 원점을 놓을 위치
   * @param scale 경로 단위 1 = scale pt
   */
  svgPath(d: string, x: number, y: number, scale: number): this {
    const tokens = d.match(/[MLCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []
    const out: string[] = []
    let i = 0
    const take = () => Number(tokens[i++])
    const pt = () => {
      const px = x + take() * scale
      const py = this.y(y + take() * scale)
      return `${num(px)} ${num(py)}`
    }
    while (i < tokens.length) {
      const command = tokens[i++]!.toUpperCase()
      if (command === 'M') out.push(`${pt()} m`)
      else if (command === 'L') out.push(`${pt()} l`)
      else if (command === 'C') out.push(`${pt()} ${pt()} ${pt()} c`)
      else if (command === 'Z') out.push('h')
    }
    if (out.length > 0) this.ops.push(...out, 'f')
    return this
  }

  /** Helvetica 영문·숫자 (기준선 y) */
  text(value: string, x: number, y: number, size: number): this {
    this.ops.push(`BT /F1 ${num(size)} Tf ${num(x)} ${num(this.y(y))} Td ${pdfString(value)} Tj ET`)
    return this
  }

  content(): string {
    return this.ops.join('\n')
  }
}

export class PdfDocument {
  private readonly pages: PdfPage[] = []

  addPage(width: number = A4.width, height: number = A4.height): PdfPage {
    const page = new PdfPage(width, height)
    this.pages.push(page)
    return page
  }

  /** 교차 참조 표(xref)까지 갖춘 PDF 1.7 파일 */
  toBytes(info: { title?: string } = {}): Uint8Array<ArrayBuffer> {
    const encoder = new TextEncoder()
    const objects: string[] = []
    const fontId = 3
    const infoId = 4
    const firstPageId = 5
    const pageIds = this.pages.map((_, i) => firstPageId + i * 2)

    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
    objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${this.pages.length} >>`
    objects[fontId] =
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
    objects[infoId] =
      `<< /Producer (LuminousKR)${info.title ? ` /Title ${pdfTextString(info.title)}` : ''} >>`
    this.pages.forEach((page, i) => {
      const pageId = pageIds[i]!
      const content = page.content()
      objects[pageId] =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(page.width)} ${num(page.height)}] ` +
        `/Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${pageId + 1} 0 R >>`
      objects[pageId + 1] =
        `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`
    })

    let body = '%PDF-1.7\n%âãÏÓ\n'
    // 앞의 주석 줄은 이진 파일임을 알리는 관례 (라틴-1 바이트로 씀)
    const parts: Uint8Array[] = []
    const header = new Uint8Array([...body].map((c) => c.charCodeAt(0)))
    parts.push(header)
    let offset = header.length
    const offsets: number[] = []
    for (let id = 1; id < objects.length; id++) {
      const chunk = encoder.encode(`${id} 0 obj\n${objects[id]}\nendobj\n`)
      offsets[id] = offset
      parts.push(chunk)
      offset += chunk.length
    }
    const xrefStart = offset
    body = `xref\n0 ${objects.length}\n0000000000 65535 f \n`
    for (let id = 1; id < objects.length; id++)
      body += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
    body += `trailer\n<< /Size ${objects.length} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
    parts.push(encoder.encode(body))

    const total = parts.reduce((sum, p) => sum + p.length, 0)
    const bytes = new Uint8Array(total)
    let at = 0
    for (const part of parts) {
      bytes.set(part, at)
      at += part.length
    }
    return bytes
  }
}
