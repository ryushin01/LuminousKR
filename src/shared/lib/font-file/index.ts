export { buildOtf, contoursToPath } from './build-otf.ts'
export type { FontMetrics, FontNames, GlyphSpec } from './build-otf.ts'
export { readSfntTables, sfntToWoff, zlibCompress, zlibDecompress } from './woff.ts'
export { encodeUIntBase128, sfntToWoff2 } from './woff2.ts'
export { BROTLI_QUALITY, brotliCompress } from './brotli.ts'
export {
  buildNameTable,
  keepWindowsNames,
  parseNameTable,
  tableChecksum,
  tidySfnt,
  writeSfnt,
} from './sfnt.ts'
export type { NameRecord, SfntTable } from './sfnt.ts'
