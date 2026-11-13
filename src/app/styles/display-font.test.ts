// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'opentype.js/dist/opentype.mjs'
import { describe, expect, it } from 'vitest'
import { zlibDecompress } from '@/shared/lib/font-file'

const root = fileURLToPath(new URL('../../..', import.meta.url))

/** WOFF를 sfnt로 되돌립니다 (opentype.js 2.0의 WOFF 읽기는 압축 해제에 외부 라이브러리가 필요) */
async function woffToSfnt(woff: Uint8Array): Promise<ArrayBuffer> {
  const view = new DataView(woff.buffer, woff.byteOffset, woff.byteLength)
  const numTables = view.getUint16(12)
  const tables: { tag: number; checksum: number; data: Uint8Array }[] = []
  for (let i = 0; i < numTables; i++) {
    const at = 44 + i * 20
    const offset = view.getUint32(at + 4)
    const compLength = view.getUint32(at + 8)
    const origLength = view.getUint32(at + 12)
    const stored = woff.subarray(offset, offset + compLength)
    tables.push({
      tag: view.getUint32(at),
      checksum: view.getUint32(at + 16),
      data: compLength < origLength ? await zlibDecompress(stored) : stored,
    })
  }
  const pad = (n: number) => (n + 3) & ~3
  const size = 12 + numTables * 16 + tables.reduce((s, t) => s + pad(t.data.length), 0)
  const out = new Uint8Array(size)
  const outView = new DataView(out.buffer)
  outView.setUint32(0, view.getUint32(4))
  outView.setUint16(4, numTables)
  let offset = 12 + numTables * 16
  tables.forEach((t, i) => {
    const at = 12 + i * 16
    outView.setUint32(at, t.tag)
    outView.setUint32(at + 4, t.checksum)
    outView.setUint32(at + 8, offset)
    outView.setUint32(at + 12, t.data.length)
    out.set(t.data, offset)
    offset += pad(t.data.length)
  })
  return out.buffer
}

/** 생성 스크립트(scripts/build-display-font.mjs)와 같은 규칙으로 주석을 지웁니다. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')
}

function sourceChars(): Set<string> {
  const chars = new Set<string>()
  const visit = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) visit(full)
      else if (/\.(ts|tsx)$/.test(name) && !/\.(test|stories)\.tsx?$/.test(name)) {
        for (const c of stripComments(readFileSync(full, 'utf8'))) {
          const code = c.codePointAt(0)!
          if ((code >= 0xac00 && code <= 0xd7a3) || (code >= 0x3131 && code <= 0x3163)) chars.add(c)
        }
      }
    }
  }
  visit(join(root, 'src'))
  return chars
}

describe('제목용 글꼴 Luminous Display', () => {
  it('화면 문구에 쓰인 한글을 모두 담고 있습니다 (빠지면 pnpm fonts:display로 다시 만드세요)', async () => {
    const woff = readFileSync(join(root, 'src/app/styles/fonts/luminous-display.woff'))
    const font = parse(await woffToSfnt(new Uint8Array(woff)))
    const missing = [...sourceChars()].filter((c) => !font.hasChar(c))
    expect(missing).toEqual([])
  })
})
