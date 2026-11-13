import { createRoot } from 'solid-js'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  MAX_STROKES_PER_DRAWING,
  createBlankProject,
  editProject,
  fontProject,
  replaceProject,
  strokeFromSyllable,
  redo,
  strokeToSyllable,
  undo,
} from '@/entities/font'
import { createEditor } from './editor.ts'

function withEditor(run: (editor: ReturnType<typeof createEditor>) => void) {
  createRoot((dispose) => {
    run(createEditor('L0'))
    dispose()
  })
}

describe('그리기 판 편집기', () => {
  beforeEach(() => replaceProject(createBlankProject()))

  it('점을 찍고 마치면 직선 획 하나가 생깁니다 (격자에 맞춤)', () => {
    withEditor((editor) => {
      expect(editor.source()).toBe('empty')
      editor.place({ x: 0.11, y: 0.2 })
      editor.place({ x: 0.5, y: 0.21 })
      editor.place({ x: 0.5, y: 0.8 })
      editor.finish()
      const [stroke] = editor.ownStrokes()
      expect(editor.ownStrokes()).toHaveLength(1)
      expect(stroke?.kind === 'path' && stroke.points[0]).toEqual({
        x: expect.closeTo(0.125, 4),
        y: expect.closeTo(0.2083, 3),
      })
      expect(editor.source()).toBe('own')
    })
  })

  it('첫 점을 다시 누르면 닫힌 획이 됩니다', () => {
    withEditor((editor) => {
      for (const p of [
        { x: 0.25, y: 0.25 },
        { x: 0.75, y: 0.25 },
        { x: 0.75, y: 0.75 },
        { x: 0.25, y: 0.25 },
      ])
        editor.place(p)
      const [stroke] = editor.ownStrokes()
      expect(stroke?.kind === 'path' && stroke.closed).toBe(true)
    })
  })

  it('원 도구는 두 모서리로 타원을 만듭니다', () => {
    withEditor((editor) => {
      editor.setTool('ellipse')
      editor.place({ x: 0.25, y: 0.25 })
      editor.place({ x: 0.75, y: 0.5 })
      const [stroke] = editor.ownStrokes()
      expect(stroke?.kind).toBe('ellipse')
    })
  })

  it('Esc(취소)는 그리던 점을 버립니다', () => {
    withEditor((editor) => {
      editor.place({ x: 0.25, y: 0.25 })
      editor.cancel()
      expect(editor.pending()).toEqual([])
      expect(editor.ownStrokes()).toHaveLength(0)
    })
  })

  it('고른 획을 격자 칸 단위로 옮기고 지울 수 있습니다', () => {
    withEditor((editor) => {
      editor.place({ x: 0.25, y: 0.25 })
      editor.place({ x: 0.5, y: 0.25 })
      editor.finish()
      const before = editor.ownStrokes()[0]!
      editor.nudge(1, 0)
      const after = editor.ownStrokes()[0]!
      expect(
        after.kind === 'path' && before.kind === 'path' && after.points[0]!.x - before.points[0]!.x,
      ).toBeCloseTo(1 / 24)
      editor.deleteSelected()
      expect(editor.ownStrokes()).toHaveLength(0)
    })
  })

  it('자동으로 만든 자모는 "직접 그리기"로 가져온 뒤에 고칠 수 있습니다', () => {
    replaceProject({ ...createBlankProject(), jamo: { L0: { base: { strokes: [] } } } })
    withEditor((editor) => {
      editor.selectJamo('L0')
      editor.place({ x: 0.25, y: 0.25 })
      editor.place({ x: 0.5, y: 0.5 })
      editor.finish()
      editor.selectJamo('L1')
      expect(editor.source()).toBe('derived')
      expect(editor.canDraw()).toBe(false)
      editor.adopt()
      expect(editor.source()).toBe('own')
      expect(editor.ownStrokes()).toHaveLength(2)
      editor.revert()
      expect(editor.source()).toBe('derived')
    })
  })

  it('다른 배치를 따로 그리면 그 배치에만 변형이 생깁니다', () => {
    withEditor((editor) => {
      editor.place({ x: 0.25, y: 0.25 })
      editor.place({ x: 0.5, y: 0.25 })
      editor.finish()
      editor.selectLayout('B')
      expect(editor.source()).toBe('inherited')
      editor.adopt()
      expect(fontProject.jamo.L0?.variants?.B?.strokes).toHaveLength(1)
      undo()
      expect(fontProject.jamo.L0?.variants?.B).toBeUndefined()
    })
  })
})

describe('그림 한도 (넘으면 자동 저장한 작업을 다시 열 수 없음)', () => {
  beforeEach(() => replaceProject(createBlankProject()))

  const dots = (count: number) =>
    Array.from({ length: count }, (_, i) =>
      strokeFromSyllable({ kind: 'ellipse', cx: 0.5, cy: 0.5, rx: 0.01, ry: 0.01 }, BOX, `d${i}`),
    )
  const BOX = { x0: 0, y0: 0, x1: 1, y1: 1 }

  it('획이 한도만큼 있으면 새 획을 시작하지 않고 까닭을 알립니다', () => {
    withEditor((editor) => {
      editProject((draft) => {
        draft.jamo.L0 = { base: { strokes: dots(MAX_STROKES_PER_DRAWING) } }
      })
      editor.place({ x: 0.25, y: 0.25 })
      expect(editor.pending()).toHaveLength(0)
      expect(editor.ownStrokes()).toHaveLength(MAX_STROKES_PER_DRAWING)
      expect(editor.announcement()).toContain(`${MAX_STROKES_PER_DRAWING}개까지`)
    })
  })

  it('그리는 사이 다시하기로 한도에 닿아도, 마칠 때 다시 보고 넣지 않습니다', () => {
    withEditor((editor) => {
      editProject((draft) => {
        draft.jamo.L0 = { base: { strokes: dots(MAX_STROKES_PER_DRAWING - 1) } }
      })
      editProject((draft) => {
        draft.jamo.L0!.base!.strokes.push(...dots(1))
      })
      undo()
      // 299획일 때 경로와 원을 시작해 두고, 다시하기로 300획이 된 뒤 마칩니다.
      editor.place({ x: 0.25, y: 0.25 })
      editor.place({ x: 0.5, y: 0.25 })
      redo()
      expect(editor.ownStrokes()).toHaveLength(MAX_STROKES_PER_DRAWING)
      editor.finish()
      expect(editor.ownStrokes()).toHaveLength(MAX_STROKES_PER_DRAWING)
      expect(editor.announcement()).toContain(`${MAX_STROKES_PER_DRAWING}개까지`)

      editor.cancel()
      undo()
      editor.setTool('ellipse')
      editor.place({ x: 0.25, y: 0.25 })
      redo()
      editor.place({ x: 0.75, y: 0.5 })
      expect(editor.ownStrokes()).toHaveLength(MAX_STROKES_PER_DRAWING)
    })
  })

  it('파생 획이 한도를 넘으면 가져오지 않고 그대로 둡니다', () => {
    withEditor((editor) => {
      // ㄲ(L1)은 ㄱ(L0) 두 개로 만들어지므로 ㄱ이 200획이면 400획이 됩니다.
      editProject((draft) => {
        draft.jamo.L0 = { base: { strokes: dots(200) } }
      })
      editor.selectJamo('L1')
      expect(editor.source()).toBe('derived')
      editor.adopt()
      expect(fontProject.jamo.L1).toBeUndefined()
      expect(editor.announcement()).toContain('가져오지 못했습니다')
    })
  })
})

describe('그림 좌표 변환', () => {
  it('음절 좌표 ↔ 틀 정규화 좌표가 서로 되돌려집니다', () => {
    const box = { x0: 0.1, y0: 0.2, x1: 0.6, y1: 0.9 }
    const stored = strokeFromSyllable(
      { kind: 'ellipse', cx: 0.35, cy: 0.55, rx: 0.1, ry: 0.2 },
      box,
      'e',
    )
    expect(strokeToSyllable(stored, box)).toMatchObject({
      cx: 0.35,
      cy: 0.55,
      rx: 0.1,
      ry: expect.closeTo(0.2, 4),
    })
  })
})
