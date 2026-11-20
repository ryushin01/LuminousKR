/**
 * CFF 표의 글리프 윤곽(Type 2 charstring)에서 되풀이되는 윤곽 몸체를 전역 서브루틴으로 옮깁니다.
 *
 * 음절은 자모 조각을 같은 자리에 그대로 놓아 만들므로, 11,172자 글꼴의 윤곽 5만여 개 가운데 서로 다른 몸체는
 * 수백 개뿐입니다(실측: 55,428개 가운데 365개). opentype.js는 서브루틴을 쓰지 않아 OTF가 3.8 MB가 됩니다.
 * 윤곽마다 시작점 이동(rmoveto) 뒤의 몸체(rlineto·rrcurveto…)를 잘라, 두 번 이상 나오는 것을 전역 서브루틴으로 두고
 * 그 자리에서는 callgsubr로 부릅니다. 이동은 앞 윤곽이 끝난 점에서 잰 상대값이라 글리프마다 다르지만, 몸체는 같은
 * 자리의 같은 윤곽이면 바이트까지 같습니다.
 *
 * 이 앱이 쓰는 opentype.js 출력(CFF 1판: Name·Top DICT·String·Global Subr INDEX, charset, CharStrings, Private
 * DICT)만 다룹니다. 그 밖의 구조(CID, Encoding 표, 로컬 서브루틴, 힌트, 이미 있는 서브루틴)가 보이면 그대로 돌려줍니다.
 */

const OP = {
  vmoveto: 4,
  callsubr: 10,
  return: 11,
  escape: 12,
  endchar: 14,
  hintmask: 19,
  cntrmask: 20,
  rmoveto: 21,
  hmoveto: 22,
  shortint: 28,
  callgsubr: 29,
} as const

const DICT = {
  charset: 15,
  encoding: 16,
  charStrings: 17,
  private: 18,
  subrs: 19,
  ros: 1230,
  fdArray: 1236,
  fdSelect: 1237,
} as const

type Index = { items: Uint8Array[]; start: number; end: number }

function readIndex(data: Uint8Array, at: number): Index {
  const count = (data[at]! << 8) | data[at + 1]!
  if (count === 0) return { items: [], start: at, end: at + 2 }
  const offSize = data[at + 2]!
  const offsetAt = (i: number) => {
    let value = 0
    for (let k = 0; k < offSize; k++) value = value * 256 + data[at + 3 + i * offSize + k]!
    return value
  }
  // 오프셋은 1부터 셉니다(자료 바로 앞 바이트 기준).
  const base = at + 3 + (count + 1) * offSize - 1
  const items: Uint8Array[] = []
  for (let i = 0; i < count; i++)
    items.push(data.subarray(base + offsetAt(i), base + offsetAt(i + 1)))
  return { items, start: at, end: base + offsetAt(count) }
}

function writeIndex(items: readonly Uint8Array[]): Uint8Array {
  if (items.length === 0) return new Uint8Array([0, 0])
  const total = items.reduce((sum, item) => sum + item.byteLength, 0)
  const last = total + 1
  const offSize = last < 0x100 ? 1 : last < 0x10000 ? 2 : last < 0x1000000 ? 3 : 4
  const out = new Uint8Array(3 + (items.length + 1) * offSize + total)
  out[0] = items.length >> 8
  out[1] = items.length & 0xff
  out[2] = offSize
  let at = 3
  const putOffset = (value: number) => {
    for (let k = offSize - 1; k >= 0; k--) {
      out[at + k] = value % 256
      value = Math.floor(value / 256)
    }
    at += offSize
  }
  let offset = 1
  putOffset(offset)
  for (const item of items) {
    offset += item.byteLength
    putOffset(offset)
  }
  for (const item of items) {
    out.set(item, at)
    at += item.byteLength
  }
  return out
}

type DictEntry = { op: number; operands: number[]; bytes: Uint8Array }

/** DICT를 연산자 단위로 나눕니다(바꾸지 않는 항목은 원래 바이트 그대로 다시 씀). */
function parseDict(data: Uint8Array): DictEntry[] | null {
  const entries: DictEntry[] = []
  let operands: number[] = []
  let start = 0
  let i = 0
  while (i < data.length) {
    const b0 = data[i]!
    if (b0 <= 21) {
      let op: number = b0
      i += 1
      if (b0 === OP.escape) {
        op = 1200 + data[i]!
        i += 1
      }
      entries.push({ op, operands, bytes: data.subarray(start, i) })
      operands = []
      start = i
    } else if (b0 === 28) {
      operands.push((((data[i + 1]! << 8) | data[i + 2]!) << 16) >> 16)
      i += 3
    } else if (b0 === 29) {
      operands.push(
        (data[i + 1]! << 24) | (data[i + 2]! << 16) | (data[i + 3]! << 8) | data[i + 4]!,
      )
      i += 5
    } else if (b0 === 30) {
      // 실수: 값은 다시 쓰지 않으므로 끝(0xf 니블)까지 건너뜁니다.
      i += 1
      while (i < data.length && (data[i]! & 0x0f) !== 0x0f && data[i]! >> 4 !== 0x0f) i += 1
      i += 1
      operands.push(Number.NaN)
    } else if (b0 >= 32 && b0 <= 246) {
      operands.push(b0 - 139)
      i += 1
    } else if (b0 >= 247 && b0 <= 250) {
      operands.push((b0 - 247) * 256 + data[i + 1]! + 108)
      i += 2
    } else if (b0 >= 251 && b0 <= 254) {
      operands.push(-(b0 - 251) * 256 - data[i + 1]! - 108)
      i += 2
    } else {
      return null
    }
  }
  return entries
}

/** DICT 정수를 늘 5바이트로(오프셋을 정하기 전에 DICT 길이를 알 수 있게) */
const int32 = (value: number) => [
  29,
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
]

/** Type 2 charstring 정수 */
function charstringInt(value: number): number[] {
  if (value >= -107 && value <= 107) return [value + 139]
  if (value >= 108 && value <= 1131) {
    const v = value - 108
    return [(v >> 8) + 247, v & 0xff]
  }
  if (value >= -1131 && value <= -108) {
    const v = -value - 108
    return [(v >> 8) + 251, v & 0xff]
  }
  return [OP.shortint, (value >> 8) & 0xff, value & 0xff]
}

/** 서브루틴 수에 따른 번호 바이어스(CFF 규격) */
const subrBias = (count: number) => (count < 1240 ? 107 : count < 33900 ? 1131 : 32768)

function charsetLength(data: Uint8Array, at: number, glyphCount: number): number | null {
  const format = data[at]
  if (format === 0) return 1 + 2 * (glyphCount - 1)
  if (format !== 1 && format !== 2) return null
  let covered = 1 // .notdef
  let p = at + 1
  while (covered < glyphCount) {
    const left = format === 1 ? data[p + 2]! : (data[p + 2]! << 8) | data[p + 3]!
    p += format === 1 ? 3 : 4
    covered += left + 1
  }
  return p - at
}

type Part = { body: boolean; bytes: Uint8Array }

/**
 * 글리프 하나를 이동(첫 이동에는 너비도) 묶음과 윤곽 몸체로 나눕니다.
 * 이미 서브루틴·힌트가 있거나 모르는 모양이면 null(손대지 않음).
 */
function splitContours(charstring: Uint8Array): Part[] | null {
  const parts: Part[] = []
  let operandsStart = 0 // 지금 연산자의 피연산자가 시작한 자리 (앞 연산자가 끝난 자리)
  let bodyStart = -1
  let ended = false
  let i = 0
  while (i < charstring.length) {
    const b0 = charstring[i]!
    if (b0 === OP.shortint) {
      i += 3
      continue
    }
    if (b0 >= 32) {
      i += b0 <= 246 ? 1 : b0 <= 254 ? 2 : 5
      continue
    }
    if (ended) return null
    const op = b0 === OP.escape ? 1200 + charstring[i + 1]! : b0
    i += b0 === OP.escape ? 2 : 1
    if (
      op === OP.callsubr ||
      op === OP.callgsubr ||
      op === OP.return ||
      op === OP.hintmask ||
      op === OP.cntrmask
    ) {
      return null
    }
    const move = op === OP.rmoveto || op === OP.hmoveto || op === OP.vmoveto
    if (move || op === OP.endchar) {
      if (bodyStart >= 0 && operandsStart > bodyStart) {
        parts.push({ body: true, bytes: charstring.subarray(bodyStart, operandsStart) })
      }
      parts.push({ body: false, bytes: charstring.subarray(operandsStart, i) })
      bodyStart = move ? i : -1
      ended = op === OP.endchar
    } else if (bodyStart < 0) {
      return null // 이동 없이 그리는 연산(힌트 등)은 다루지 않음
    }
    operandsStart = i
  }
  return ended && operandsStart === charstring.length ? parts : null
}

const latin1 = new TextDecoder('latin1')

export function subroutinizeCff(cff: Uint8Array): Uint8Array {
  if (cff[0] !== 1) return cff
  const headerSize = cff[2]!
  const names = readIndex(cff, headerSize)
  const topDicts = readIndex(cff, names.end)
  const strings = readIndex(cff, topDicts.end)
  const globalSubrs = readIndex(cff, strings.end)
  if (topDicts.items.length !== 1 || globalSubrs.items.length > 0) return cff
  const top = parseDict(topDicts.items[0]!)
  if (!top) return cff
  const find = (op: number) => top.find((entry) => entry.op === op)
  const unsupported = [DICT.encoding, DICT.ros, DICT.fdArray, DICT.fdSelect].some((op) => {
    const entry = find(op)
    // Encoding 0·1은 미리 정한 표(따로 담긴 자료 없음)
    return entry && !(op === DICT.encoding && (entry.operands[0] ?? 0) <= 1)
  })
  const charsetEntry = find(DICT.charset)
  const charStringsEntry = find(DICT.charStrings)
  const privateEntry = find(DICT.private)
  if (unsupported || !charsetEntry || !charStringsEntry || !privateEntry) return cff

  const charStrings = readIndex(cff, charStringsEntry.operands[0]!)
  const glyphCount = charStrings.items.length
  const charsetAt = charsetEntry.operands[0]!
  const charsetSize = charsetAt > 2 ? charsetLength(cff, charsetAt, glyphCount) : 0
  const [privateSize, privateAt] = privateEntry.operands as [number, number]
  const privateDict = cff.subarray(privateAt, privateAt + privateSize)
  if (charsetSize === null || parseDict(privateDict)?.some((entry) => entry.op === DICT.subrs)) {
    return cff
  }

  // 1. 윤곽 몸체를 나누고 되풀이를 셉니다.
  const glyphs: Part[][] = []
  const counts = new Map<string, { bytes: Uint8Array; count: number }>()
  for (const charstring of charStrings.items) {
    const parts = splitContours(charstring)
    if (!parts) return cff
    glyphs.push(parts)
    for (const part of parts) {
      if (!part.body) continue
      const key = latin1.decode(part.bytes)
      const seen = counts.get(key)
      if (seen) seen.count += 1
      else counts.set(key, { bytes: part.bytes, count: 1 })
    }
  }

  // 2. 옮겨서 줄어드는 몸체만 서브루틴으로(부르는 데 2~3바이트, 서브루틴 끝 return 1바이트와 INDEX 오프셋)
  const chosen = [...counts.entries()]
    .filter(
      ([, { bytes, count }]) => count >= 2 && count * (bytes.byteLength - 3) > bytes.byteLength + 5,
    )
    .sort(([keyA, a], [keyB, b]) => b.count - a.count || (keyA < keyB ? -1 : keyA > keyB ? 1 : 0))
  if (chosen.length === 0) return cff
  const bias = subrBias(chosen.length)
  const calls = new Map<string, Uint8Array>()
  const subrs: Uint8Array[] = []
  chosen.forEach(([key, { bytes }], index) => {
    calls.set(key, new Uint8Array([...charstringInt(index - bias), OP.callgsubr]))
    const subr = new Uint8Array(bytes.byteLength + 1)
    subr.set(bytes)
    subr[bytes.byteLength] = OP.return
    subrs.push(subr)
  })

  // 3. 글리프마다 몸체를 부르기로 바꿔 다시 씁니다.
  const nextCharStrings = glyphs.map((parts) => {
    const pieces = parts.map((part) =>
      part.body ? (calls.get(latin1.decode(part.bytes)) ?? part.bytes) : part.bytes,
    )
    const out = new Uint8Array(pieces.reduce((sum, piece) => sum + piece.byteLength, 0))
    let at = 0
    for (const piece of pieces) {
      out.set(piece, at)
      at += piece.byteLength
    }
    return out
  })

  // 4. 차례대로 놓고 Top DICT의 오프셋(charset·CharStrings·Private)을 고칩니다.
  const globalSubrIndex = writeIndex(subrs)
  const charStringIndex = writeIndex(nextCharStrings)
  const charset = charsetSize > 0 ? cff.subarray(charsetAt, charsetAt + charsetSize) : null
  const encodeTop = (offsets: { charset: number; charStrings: number; private: number }) => {
    const bytes: number[] = []
    for (const entry of top) {
      if (entry.op === DICT.charset && charset) bytes.push(...int32(offsets.charset), DICT.charset)
      else if (entry.op === DICT.charStrings) {
        bytes.push(...int32(offsets.charStrings), DICT.charStrings)
      } else if (entry.op === DICT.private) {
        bytes.push(...int32(privateSize), ...int32(offsets.private), DICT.private)
      } else bytes.push(...entry.bytes)
    }
    return new Uint8Array(bytes)
  }
  const topLength = writeIndex([encodeTop({ charset: 0, charStrings: 0, private: 0 })]).byteLength
  const head = cff.subarray(0, headerSize)
  const nameIndex = cff.subarray(names.start, names.end)
  const stringIndex = cff.subarray(strings.start, strings.end)
  let at = headerSize + nameIndex.byteLength + topLength + stringIndex.byteLength
  at += globalSubrIndex.byteLength
  const offsets = { charset: at, charStrings: 0, private: 0 }
  at += charset?.byteLength ?? 0
  offsets.charStrings = at
  at += charStringIndex.byteLength
  offsets.private = at
  at += privateDict.byteLength

  const pieces = [
    head,
    nameIndex,
    writeIndex([encodeTop(offsets)]),
    stringIndex,
    globalSubrIndex,
    ...(charset ? [charset] : []),
    charStringIndex,
    privateDict,
  ]
  const out = new Uint8Array(at)
  let cursor = 0
  for (const piece of pieces) {
    out.set(piece, cursor)
    cursor += piece.byteLength
  }
  return out
}
