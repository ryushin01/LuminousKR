import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bodyFrame, createPresetProject, fontProject, replaceProject, undo } from '@/entities/font'
import type { PageRecognition, RecognizedCell } from '../worker/recognize-protocol.ts'
import { createImporter } from './importer.ts'

type Deps = NonNullable<Parameters<typeof createImporter>[0]>
type Importer = ReturnType<typeof createImporter>

const blob = new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], { type: 'image/svg+xml' })
const jpeg = (name: string) => new File(['x'], name, { type: 'image/jpeg' })

/** 닫혔는지 확인할 수 있는 가짜 그림 */
const fakeBitmap = () => ({ close: vi.fn() }) as unknown as ImageBitmap

const cell = (key: string, penWidth = 0.1): RecognizedCell => ({
  key,
  strokes: [
    {
      kind: 'path',
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
  penWidth,
  preview: blob,
})

const found = (...cells: RecognizedCell[]): PageRecognition => ({
  ok: true,
  setId: 1,
  empty: ['L2'],
  cells,
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => (resolve = done))
  return { promise, resolve }
}

/** 파일 이름마다 다른 인식 결과를 돌려주는 가짜 의존성 */
function fakeDeps(
  byFile: Record<string, () => Promise<PageRecognition>> = {},
  overrides: Partial<Deps> = {},
): Deps & { bitmaps: Map<string, ImageBitmap> } {
  const bitmaps = new Map<string, ImageBitmap>()
  const owner = new Map<ImageBitmap, string>()
  return {
    bitmaps,
    readPageSources: async (file) => {
      const bitmap = fakeBitmap()
      bitmaps.set(file.name, bitmap)
      owner.set(bitmap, file.name)
      return { pages: [{ label: file.name, bitmap }], skippedPages: 0 }
    },
    recognizeTemplatePage: (bitmap) => {
      const make = byFile[owner.get(bitmap) ?? '']
      return make ? make() : Promise.resolve(found(cell('L0')))
    },
    recognizeSingleImage: async () => ({ ok: false, message: '없음' }),
    ...overrides,
  }
}

/** 화면(소유자) 안에서 가져오기 상태를 만들고, 테스트가 끝나면 치웁니다. */
async function withImporter(deps: Deps, run: (importer: Importer) => Promise<void>) {
  await createRoot(async (dispose) => {
    try {
      await run(createImporter(deps))
    } finally {
      dispose()
    }
  })
}

describe('가져오기', () => {
  beforeEach(() => replaceProject(createPresetProject()))
  afterEach(() => vi.restoreAllMocks())

  it('인식한 칸을 후보로 모으고, 적용하면 기본 그림이 바뀌며 되돌릴 수 있습니다', async () => {
    await withImporter(fakeDeps(), async (importer) => {
      await importer.addTemplateFiles([jpeg('scan.jpg')])
      expect(importer.sources[0]).toMatchObject({ state: 'done' })
      expect(importer.sources[0]!.message).toContain(
        "'기본 자모 24자' 양식에서 1자를 찾았습니다 (빈 칸 1개)",
      )
      expect(importer.candidates).toHaveLength(1)
      expect(importer.selectedCount()).toBe(1)

      const before = fontProject.style.weight
      expect(importer.apply(true)).toBe(1)
      expect(fontProject.jamo.L0!.base!.strokes).toHaveLength(1)
      // 펜 굵기(음절 너비의 10%)를 글꼴 굵기로
      expect(fontProject.style.weight).not.toBe(before)
      undo()
      expect(fontProject.style.weight).toBe(before)
    })
  })

  it('같은 자모를 다시 올리면 마지막 것만 고른 상태입니다', async () => {
    await withImporter(fakeDeps(), async (importer) => {
      await importer.addTemplateFiles([jpeg('a.jpg')])
      await importer.addTemplateFiles([jpeg('b.jpg')])
      expect(importer.candidates.map((c) => c.selected)).toEqual([false, true])
    })
  })

  it('먼저 올린 파일이 늦게 끝나도 나중에 올린 파일의 자모를 고릅니다', async () => {
    const slow = deferred<PageRecognition>()
    await withImporter(fakeDeps({ 'a.jpg': () => slow.promise }), async (importer) => {
      const first = importer.addTemplateFiles([jpeg('a.jpg')])
      await importer.addTemplateFiles([jpeg('b.jpg')])
      slow.resolve(found(cell('L0')))
      await first
      expect(importer.candidates.map((c) => [c.source, c.selected])).toEqual([
        ['b.jpg', true],
        ['a.jpg', false],
      ])
    })
  })

  it('자모마다 하나만 고르므로 고른 수와 펜 굵기 평균이 실제로 넣는 것과 같습니다', async () => {
    const deps = fakeDeps({
      'a.jpg': async () => found(cell('L0', 0.1)),
      'b.jpg': async () => found(cell('L0', 0.3), cell('L2', 0.1)),
    })
    await withImporter(deps, async (importer) => {
      await importer.addTemplateFiles([jpeg('a.jpg'), jpeg('b.jpg')])
      const [olderL0, newerL0, l2] = importer.candidates.map((c) => c.id)
      const selected = () => importer.candidates.map((c) => c.selected)
      expect(selected()).toEqual([false, true, true])

      // 같은 자모의 다른 후보를 고르면 앞의 것은 풀립니다.
      importer.toggle(olderL0!, true)
      expect(selected()).toEqual([true, false, true])
      importer.toggle(newerL0!, true)
      expect(selected()).toEqual([false, true, true])

      // 모두 고르기도 자모마다 마지막에 올린 것 하나씩
      importer.selectAll(false)
      expect(importer.selectedCount()).toBe(0)
      importer.selectAll(true)
      expect(selected()).toEqual([false, true, true])

      importer.toggle(olderL0!, true)
      importer.toggle(l2!, true)
      expect(importer.selectedCount()).toBe(2)
      const body = bodyFrame(fontProject.metrics, fontProject.style)
      expect(importer.apply(true)).toBe(2)
      // 풀린 후보(펜 굵기 0.3)는 평균에 들어가지 않습니다.
      expect(fontProject.style.weight).toBe(Math.round(0.1 * (body.x1 - body.x0)))
    })
  })

  it('한 쪽 인식이 실패해도 그 쪽만 알리고 다음 파일을 계속 읽습니다', async () => {
    const deps = fakeDeps({ 'broken.jpg': () => Promise.reject(new Error('worker crashed')) })
    await withImporter(deps, async (importer) => {
      await importer.addTemplateFiles([jpeg('broken.jpg'), jpeg('good.jpg')])
      expect(importer.sources.map((s) => s.state)).toEqual(['error', 'done'])
      expect(importer.sources[0]!.message).toContain('broken.jpg: 인식하다 멈췄습니다')
      expect(importer.sources[0]!.message).toContain('해상도를 줄여 다시 올려 주세요')
      expect(importer.candidates.map((c) => c.source)).toEqual(['good.jpg'])
      expect(deps.bitmaps.get('broken.jpg')!.close).toHaveBeenCalled()
    })
  })

  it('PDF가 쪽 수 한도를 넘으면 건너뛴 쪽 수와 다시 올리는 방법을 알립니다', async () => {
    const deps = fakeDeps(
      {},
      {
        readPageSources: async (file) => ({
          pages: [{ label: `${file.name} 1쪽`, bitmap: fakeBitmap() }],
          skippedPages: 3,
        }),
      },
    )
    await withImporter(deps, async (importer) => {
      await importer.addTemplateFiles([new File(['x'], 'forms.pdf', { type: 'application/pdf' })])
      expect(importer.sources[0]!.message).toContain(
        'forms.pdf: 한 번에 6쪽까지만 읽어 뒤의 3쪽은 건너뛰었습니다',
      )
      expect(importer.announcement()).toContain('PDF를 나눠 다시 올려 주세요')
    })
  })

  it('표식을 못 찾으면 원인을 그 파일에 표시합니다', async () => {
    const deps = fakeDeps({
      'blurry.jpg': async () => ({
        ok: false,
        reason: 'markers',
        message: '표식을 찾지 못했습니다.',
      }),
    })
    await withImporter(deps, async (importer) => {
      await importer.addTemplateFiles([jpeg('blurry.jpg')])
      expect(importer.sources[0]).toMatchObject({ state: 'error' })
      expect(importer.sources[0]!.message).toContain('표식을 찾지 못했습니다')
      expect(importer.candidates).toHaveLength(0)
    })
  })

  it('화면을 떠난 뒤 끝난 인식은 버리고, 아직 넘기지 않은 그림은 닫습니다', async () => {
    const pending = deferred<PageRecognition>()
    const pages = [fakeBitmap(), fakeBitmap()]
    const recognize = vi.fn(() => pending.promise)
    const createUrl = vi.spyOn(URL, 'createObjectURL')
    let importer!: Importer
    let done!: Promise<void>
    const dispose = createRoot((dispose) => {
      importer = createImporter(
        fakeDeps(
          {},
          {
            readPageSources: async () => ({
              pages: pages.map((bitmap, i) => ({ label: `scan.pdf ${i + 1}쪽`, bitmap })),
              skippedPages: 0,
            }),
            recognizeTemplatePage: recognize,
          },
        ),
      )
      done = importer.addTemplateFiles([new File(['x'], 'scan.pdf', { type: 'application/pdf' })])
      return dispose
    })
    await vi.waitFor(() => expect(recognize).toHaveBeenCalledTimes(1))
    dispose()
    pending.resolve(found(cell('L0')))
    await done

    expect(importer.candidates).toHaveLength(0)
    expect(createUrl).not.toHaveBeenCalled()
    expect(recognize).toHaveBeenCalledTimes(1)
    expect(pages[1]!.close).toHaveBeenCalled()
  })

  it('양식 없이 한 장 읽기는 첫 쪽만 쓰고 나머지 그림은 닫습니다', async () => {
    const pages = [fakeBitmap(), fakeBitmap()]
    const deps = fakeDeps(
      {},
      {
        readPageSources: async () => ({
          pages: pages.map((bitmap, i) => ({ label: `ㅇ.pdf ${i + 1}쪽`, bitmap })),
          skippedPages: 0,
        }),
        recognizeSingleImage: async () => ({
          ok: true,
          strokes: [{ kind: 'ellipse', cx: 0.27, cy: 0.5, rx: 0.18, ry: 0.24 }],
          penWidth: 0.08,
          preview: blob,
        }),
      },
    )
    await withImporter(deps, async (importer) => {
      await importer.addSingleFile(new File(['x'], 'ㅇ.pdf', { type: 'application/pdf' }), 'L11')
      expect(pages[1]!.close).toHaveBeenCalled()
      expect(importer.sources[0]).toMatchObject({ state: 'done' })
      expect(importer.sources[0]!.message).toContain('PDF는 첫 쪽만 썼습니다')
      expect(importer.candidates[0]).toMatchObject({ key: 'L11', selected: true })
    })
  })
})
