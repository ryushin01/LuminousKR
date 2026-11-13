import { beforeEach, describe, expect, it } from 'vitest'
import { createPresetProject } from './preset.ts'
import {
  canRedo,
  canUndo,
  editProject,
  fontProject,
  redo,
  replaceProject,
  resetProjectStoreForTest,
  undo,
} from './store.ts'
import { ProjectFormatError, normalizeProject, parseProjectJson } from './validate.ts'

describe('프로젝트 저장소와 되돌리기', () => {
  beforeEach(() => resetProjectStoreForTest())

  it('고친 것을 되돌리고 다시 합니다', () => {
    editProject((d) => void (d.style.weight = 120))
    expect(fontProject.style.weight).toBe(120)
    expect(canUndo()).toBe(true)
    undo()
    expect(fontProject.style.weight).toBe(76)
    expect(canRedo()).toBe(true)
    redo()
    expect(fontProject.style.weight).toBe(120)
  })

  it('같은 이름의 연속 변경(슬라이더 끌기)은 되돌리기 한 번으로 묶습니다', () => {
    for (const weight of [80, 90, 100, 110]) {
      editProject((d) => void (d.style.weight = weight), { coalesce: 'weight' })
    }
    undo()
    expect(fontProject.style.weight).toBe(76)
    expect(canUndo()).toBe(false)
  })

  it('기본 글꼴로 바꾸면 이전 편집(획·배치 변형·굵기·이름·틀)이 하나도 남지 않습니다', () => {
    editProject((d) => {
      d.style.weight = 150
      d.jamo.L0!.base!.strokes.push({
        id: 'extra',
        kind: 'path',
        points: [{ x: 0.1, y: 0.1 }],
        closed: false,
        smooth: false,
      })
      d.jamo.L0!.variants = { B: { strokes: [] } }
      d.jamo.L1 = { base: { strokes: [] } }
      d.meta.familyName = 'Changed'
      d.layouts.A.L.x1 = 0.7
    })
    replaceProject(createPresetProject())
    expect(JSON.parse(JSON.stringify(fontProject))).toEqual(createPresetProject())
  })

  it('프로젝트를 통째로 바꾼 것도 되돌릴 수 있습니다', () => {
    replaceProject({ ...createPresetProject(), name: '다른 글꼴', jamo: {} })
    expect(fontProject.name).toBe('다른 글꼴')
    undo()
    expect(fontProject.name).toBe('루미너스 기본')
  })
})

describe('프로젝트 파일 검사', () => {
  it('다른 형식의 파일은 원인과 함께 거부합니다', () => {
    expect(() => parseProjectJson('{"hello":1}')).toThrow(ProjectFormatError)
    expect(() => parseProjectJson('not json')).toThrow('JSON')
    expect(() => normalizeProject({ format: 'luminous-kr', version: 9 })).toThrow('판')
  })

  it('획·점이 한도를 넘는 파일은 말없이 자르지 않고 원인과 함께 거부합니다', () => {
    const raw = JSON.parse(JSON.stringify(createPresetProject()))
    const point = { x: 0.5, y: 0.5 }
    raw.jamo.L0.base.strokes = [{ id: 'big', kind: 'path', points: Array(2001).fill(point) }]
    expect(() => normalizeProject(raw)).toThrow('점이 너무 많은 획')
    raw.jamo.L0.base.strokes = Array.from({ length: 301 }, (_, i) => ({
      id: `s${i}`,
      kind: 'path',
      points: [point],
    }))
    expect(() => normalizeProject(raw)).toThrow('획이 너무 많은 자모')
    // 한도 안의 큰 그림은 잘리지 않고 그대로 읽습니다.
    raw.jamo.L0.base.strokes = Array.from({ length: 120 }, (_, i) => ({
      id: `s${i}`,
      kind: 'path',
      points: Array(500).fill(point),
    }))
    const project = normalizeProject(raw)
    expect(project.jamo.L0!.base!.strokes).toHaveLength(120)
    expect(
      project.jamo.L0!.base!.strokes[0]!.kind === 'path' &&
        project.jamo.L0!.base!.strokes[0]!.points,
    ).toHaveLength(500)
  })

  it('저장한 프로젝트는 그대로 읽고, 범위를 벗어난 값은 바로잡습니다', () => {
    const original = createPresetProject()
    const raw = JSON.parse(JSON.stringify(original))
    raw.style.weight = 999
    raw.style.cap = 'weird'
    raw.jamo.L99 = { base: { strokes: [] } }
    raw.jamo.L0.base.strokes.push({ kind: 'path', points: 'nope' })
    const project = normalizeProject(raw)
    expect(project.style.weight).toBe(200)
    expect(project.style.cap).toBe('round')
    expect(project.jamo).not.toHaveProperty('L99')
    expect(project.jamo.L0!.base!.strokes).toEqual(original.jamo.L0!.base!.strokes)
  })
})
