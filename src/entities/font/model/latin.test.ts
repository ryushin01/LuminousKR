import { describe, expect, it } from 'vitest'
import {
  LATIN_CHARS,
  LATIN_GUIDES,
  isLatinChar,
  isLatinCode,
  latinDrawing,
  latinGroup,
  latinLabel,
  latinWidth,
} from './latin.ts'
import { createBlankProject, createPresetProject } from './preset.ts'
import { composableChars } from './preview-font.ts'
import type { Stroke } from './types.ts'
import { normalizeProject } from './validate.ts'

/** 획 뼈대의 세로 범위 (타원은 위아래 끝) */
function verticalExtent(strokes: readonly Stroke[]) {
  const ys = strokes.flatMap((s) =>
    s.kind === 'path' ? s.points.map((p) => p.y) : [s.cy - s.ry, s.cy + s.ry],
  )
  return { top: Math.min(...ys), bottom: Math.max(...ys) }
}

describe('영문·숫자·문장부호', () => {
  it('ASCII 인쇄 글자 94자(U+0021~U+007E)를 번호 차례로 다룹니다', () => {
    expect(LATIN_CHARS).toHaveLength(94)
    expect(LATIN_CHARS[0]).toBe('!')
    expect(LATIN_CHARS.at(-1)).toBe('~')
    // 빈칸(U+0020)은 원래 글꼴에 따로 들어 있고, 지움 문자(U+007F)는 글자가 아닙니다.
    expect([0x20, 0x21, 0x41, 0x7e, 0x7f].map(isLatinCode)).toEqual([
      false,
      true,
      true,
      true,
      false,
    ])
    expect(['A', '~', '가', 'AB', ''].map(isLatinChar)).toEqual([true, true, false, false, false])
  })

  it('글자 갈래와 화면 낭독기가 읽을 이름이 있습니다', () => {
    expect(['A', 'z', '7', '&'].map(latinGroup)).toEqual(['upper', 'lower', 'digit', 'symbol'])
    expect(latinLabel('A')).toBe('대문자 A')
    expect(latinLabel('a')).toBe('소문자 a')
    expect(latinLabel('0')).toBe('숫자 0')
    expect(latinLabel('?')).toBe('물음표 ?')
    // 기호 32자도 모두 이름이 있습니다(글자만 덩그러니 읽히지 않게).
    for (const char of LATIN_CHARS) expect(latinLabel(char), char).toMatch(/^\S+.* \S$/)
  })

  it('94자 모두 기본 뼈대와 너비가 있고, 점은 뼈대 틀 안에 있습니다', () => {
    const project = createPresetProject()
    for (const char of LATIN_CHARS) {
      const { strokes } = latinDrawing(project, char)
      expect(strokes.length, char).toBeGreaterThan(0)
      const width = latinWidth(project, char)
      expect(width, char).toBeGreaterThan(0)
      expect(width, char).toBeLessThanOrEqual(1)
      for (const stroke of strokes) {
        const points =
          stroke.kind === 'path'
            ? stroke.points
            : [
                { x: stroke.cx - stroke.rx, y: stroke.cy - stroke.ry },
                { x: stroke.cx + stroke.rx, y: stroke.cy + stroke.ry },
              ]
        for (const p of points) {
          expect(p.x, char).toBeGreaterThanOrEqual(-0.1)
          expect(p.x, char).toBeLessThanOrEqual(width + 0.1)
          expect(p.y, char).toBeGreaterThanOrEqual(0)
          expect(p.y, char).toBeLessThanOrEqual(1)
        }
      }
      const ids = strokes.map((s) => s.id)
      expect(new Set(ids).size, char).toBe(ids.length)
    }
  })

  it('숫자는 모두 같은 너비(표의 자리 맞춤), 수학 기호 + < = >도 서로 같은 너비입니다', () => {
    const project = createPresetProject()
    const widths = (chars: string) => new Set([...chars].map((c) => latinWidth(project, c)))
    expect(widths('0123456789').size).toBe(1)
    expect(widths('+<=>').size).toBe(1)
  })

  it('곧은 대문자는 대문자 높이에서 기준선까지, 소문자는 x높이·어센더·디센더에 맞춰 놓입니다', () => {
    const project = createPresetProject()
    const extent = (char: string) => verticalExtent(latinDrawing(project, char).strokes)
    const { ascender, capHeight, xHeight, baseline, descender } = LATIN_GUIDES
    expect(extent('H')).toEqual({ top: capHeight, bottom: baseline })
    expect(extent('x')).toEqual({ top: xHeight, bottom: baseline })
    expect(extent('l')).toEqual({ top: ascender, bottom: baseline })
    // p의 둥근 몸통은 x높이보다 조금 넘칩니다(둥근 글자가 작아 보이지 않게).
    expect(extent('p').bottom).toBe(descender)
    expect(extent('p').top).toBeLessThan(xHeight)
    expect(extent('p').top).toBeGreaterThan(xHeight - 0.02)
  })

  it('미리보기 글꼴에는 글에 쓰인 한글과 영문·숫자·문장부호를 담습니다(빈칸·한자는 빼고)', () => {
    expect(composableChars('빛 A가1!한A 一')).toBe('빛A가1!한')
  })

  it('고친 글자는 프로젝트에 담긴 그림과 너비를, 나머지는 기본 뼈대를 씁니다', () => {
    const project = createPresetProject()
    project.latin.A = { drawing: { strokes: [] }, width: 0.3 }
    project.latin.B = { width: 0.7 }
    expect(latinDrawing(project, 'A').strokes).toEqual([])
    expect(latinWidth(project, 'A')).toBe(0.3)
    expect(latinDrawing(project, 'B')).toEqual(latinDrawing(createPresetProject(), 'B'))
    expect(latinWidth(project, 'B')).toBe(0.7)
  })
})

describe('프로젝트 판 2', () => {
  it('새 프로젝트는 판 2이고, 고친 영문이 없으므로 모두 기본 뼈대를 씁니다', () => {
    expect(createPresetProject()).toMatchObject({ version: 2, latin: {} })
    expect(createBlankProject()).toMatchObject({ version: 2, latin: {} })
  })

  it('판 1 프로젝트를 열면 그림은 그대로 두고 판 2로 바꿉니다', () => {
    const { latin: _latin, ...rest } = createPresetProject()
    const project = normalizeProject({ ...rest, version: 1 })
    expect(project.version).toBe(2)
    expect(project.latin).toEqual({})
    expect(project.jamo).toEqual(createPresetProject().jamo)
  })

  it('영문 항목은 94자 글자만 읽고, 너비는 범위 안으로 맞춥니다', () => {
    const stroke = {
      id: 'x',
      kind: 'path',
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      closed: false,
      smooth: false,
    }
    const project = normalizeProject({
      ...createPresetProject(),
      latin: {
        A: { drawing: { strokes: [stroke] }, width: 0.5 },
        b: { width: 9 },
        c: { width: 'wide' },
        가: { width: 0.5 },
        AB: { width: 0.5 },
        ' ': { width: 0.5 },
        d: 'broken',
      },
    })
    expect(Object.keys(project.latin).sort()).toEqual(['A', 'b'])
    expect(project.latin.A).toEqual({ drawing: { strokes: [stroke] }, width: 0.5 })
    expect(project.latin.b).toEqual({ width: 1.5 })
  })

  it('이 앱보다 새 판(3 이상)은 열지 않습니다', () => {
    expect(() => normalizeProject({ format: 'luminous-kr', version: 3 })).toThrow('판')
  })
})
