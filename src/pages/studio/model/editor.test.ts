import { createRoot } from 'solid-js'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createBlankProject,
  fontProject,
  replaceProject,
  strokeFromSyllable,
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
