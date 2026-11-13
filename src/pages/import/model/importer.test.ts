import { createRoot } from 'solid-js'
import { beforeEach, describe, expect, it } from 'vitest'
import { createPresetProject, fontProject, replaceProject, undo } from '@/entities/font'
import { createImporter } from './importer.ts'

const blob = new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], { type: 'image/svg+xml' })
const bitmap = {} as ImageBitmap

function fakeDeps(result: 'ok' | 'markers') {
  return {
    readPageSources: async (file: File) => [{ label: file.name, bitmap }],
    recognizeTemplatePage: async () =>
      result === 'ok'
        ? {
            ok: true as const,
            setId: 1,
            empty: ['L2'],
            cells: [
              {
                key: 'L0',
                strokes: [
                  {
                    kind: 'path' as const,
                    points: [
                      { x: 0.1, y: 0.3 },
                      { x: 0.4, y: 0.3 },
                      { x: 0.4, y: 0.8 },
                    ],
                    closed: false,
                    smooth: false,
                  },
                ],
                ink: 0.05,
                penWidth: 0.1,
                preview: blob,
              },
            ],
          }
        : { ok: false as const, reason: 'markers' as const, message: '표식을 찾지 못했습니다.' },
    recognizeSingleImage: async () => ({ ok: false as const, message: '없음' }),
  }
}

describe('가져오기', () => {
  beforeEach(() => replaceProject(createPresetProject()))

  it('인식한 칸을 후보로 모으고, 적용하면 기본 그림이 바뀌며 되돌릴 수 있습니다', async () => {
    await createRoot(async (dispose) => {
      const importer = createImporter(fakeDeps('ok'))
      await importer.addTemplateFiles([new File(['x'], 'scan.jpg', { type: 'image/jpeg' })])
      expect(importer.sources[0]).toMatchObject({ state: 'done' })
      expect(importer.sources[0]!.message).toContain(
        "'기본 자모 24자' 양식에서 1자를 찾았습니다 (빈 칸 1개)",
      )
      expect(importer.candidates).toHaveLength(1)
      expect(importer.selectedCount()).toBe(1)

      const before = fontProject.style.weight
      expect(importer.apply(true)).toBe(1)
      const strokes = fontProject.jamo.L0!.base!.strokes
      expect(strokes).toHaveLength(1)
      // 펜 굵기(음절 너비의 10%)를 글꼴 굵기로
      expect(fontProject.style.weight).not.toBe(before)
      undo()
      expect(fontProject.style.weight).toBe(before)
      dispose()
    })
  })

  it('같은 자모를 다시 올리면 마지막 것만 고른 상태입니다', async () => {
    await createRoot(async (dispose) => {
      const importer = createImporter(fakeDeps('ok'))
      await importer.addTemplateFiles([new File(['x'], 'a.jpg', { type: 'image/jpeg' })])
      await importer.addTemplateFiles([new File(['x'], 'b.jpg', { type: 'image/jpeg' })])
      expect(importer.candidates.map((c) => c.selected)).toEqual([false, true])
      dispose()
    })
  })

  it('표식을 못 찾으면 원인을 그 파일에 표시합니다', async () => {
    await createRoot(async (dispose) => {
      const importer = createImporter(fakeDeps('markers'))
      await importer.addTemplateFiles([new File(['x'], 'blurry.jpg', { type: 'image/jpeg' })])
      expect(importer.sources[0]).toMatchObject({ state: 'error' })
      expect(importer.sources[0]!.message).toContain('표식을 찾지 못했습니다')
      expect(importer.candidates).toHaveLength(0)
      dispose()
    })
  })
})
