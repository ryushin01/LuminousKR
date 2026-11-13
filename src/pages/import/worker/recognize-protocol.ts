import type { TemplateGeometry } from '../lib/template-geometry.ts'
import type { RecognizeOptions, RecognizedStroke } from '../lib/recognize.ts'

export type RecognizedCell = {
  key: string
  strokes: RecognizedStroke[]
  ink: number
  penWidth: number
  /** 바로잡은 칸 그림 (PNG) */
  preview: Blob
}

export type PageRecognition =
  | { ok: true; setId: number; cells: RecognizedCell[]; empty: string[] }
  | { ok: false; reason: 'markers' | 'set'; message: string }

export type SingleRecognition =
  | { ok: true; strokes: RecognizedStroke[]; penWidth: number; preview: Blob }
  | { ok: false; message: string }

export type RecognizeMethods = {
  page: {
    payload: { bitmap: ImageBitmap; geometry: TemplateGeometry; options: RecognizeOptions }
    result: PageRecognition
  }
  single: {
    payload: {
      bitmap: ImageBitmap
      frame: { x0: number; y0: number; x1: number; y1: number }
      options: RecognizeOptions
    }
    result: SingleRecognition
  }
}
