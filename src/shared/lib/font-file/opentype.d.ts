/**
 * opentype.js 2.0은 타입 정의를 함께 내지 않고, @types/opentype.js는 1.x 기준입니다.
 * 이 프로젝트에서 쓰는 API만 2.0 소스(dist/opentype.mjs)에 맞춰 적습니다.
 */
declare module 'opentype.js/dist/opentype.mjs' {
  export type PathCommand =
    | { type: 'M' | 'L'; x: number; y: number }
    | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
    | { type: 'Q'; x1: number; y1: number; x: number; y: number }
    | { type: 'Z' }

  export class Path {
    commands: PathCommand[]
    moveTo(x: number, y: number): void
    lineTo(x: number, y: number): void
    curveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number): void
    close(): void
  }

  export type BoundingBox = { x1: number; y1: number; x2: number; y2: number }

  export class Glyph {
    constructor(options: {
      name: string
      unicode?: number
      unicodes?: number[]
      advanceWidth: number
      path: Path
    })
    name: string
    unicode?: number
    unicodes: number[]
    advanceWidth: number
    path: Path
    getBoundingBox(): BoundingBox
  }

  /** 언어 코드(en, ko …)별 문자열 */
  export type LocalizedName = Record<string, string>
  export type NameSet = Record<string, LocalizedName>

  export type FontOptions = {
    familyName: string
    styleName: string
    postScriptName?: string
    unitsPerEm: number
    ascender: number
    descender: number
    glyphs: Glyph[]
    designer?: string
    designerURL?: string
    manufacturer?: string
    manufacturerURL?: string
    license?: string
    licenseURL?: string
    version?: string
    description?: string
    copyright?: string
    trademark?: string
    weightClass?: number
    widthClass?: number
    italicAngle?: number
    createdTimestamp?: number
  }

  export class Font {
    constructor(options: FontOptions)
    names: { unicode: NameSet; macintosh: NameSet; windows: NameSet }
    // 테이블마다 필드가 달라 느슨하게 둡니다.
    tables: Record<string, Record<string, unknown>>
    glyphs: { length: number; get(index: number): Glyph }
    unitsPerEm: number
    ascender: number
    descender: number
    toArrayBuffer(): ArrayBuffer
    charToGlyph(char: string): Glyph
    hasChar(char: string): boolean
    getEnglishName(name: string): string
  }

  export function parse(buffer: ArrayBuffer, options?: Record<string, unknown>): Font
}
