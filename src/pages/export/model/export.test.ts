import { createRoot } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createPresetProject,
  editProject,
  fontProject,
  replaceProject,
  type BuildResult,
} from '@/entities/font'
import { createExporter, memberProject } from './exporter.ts'
import { validateMeta } from './validation.ts'

const fakeResult: BuildResult = {
  otf: new ArrayBuffer(8),
  glyphCount: 11_225,
  syllableCount: 11_172,
  durationMs: 1000,
}

describe('글꼴 파일 만들기', () => {
  it('빠르게 두 번 눌러도 한 번만 만듭니다', async () => {
    const build = vi.fn(
      () => new Promise<BuildResult>((resolve) => setTimeout(() => resolve(fakeResult), 10)),
    )
    await createRoot(async (dispose) => {
      const exporter = createExporter(build)
      const first = exporter.start({ woff: true })
      const second = exporter.start({ woff: true })
      await Promise.all([first, second])
      expect(build).toHaveBeenCalledTimes(1)
      expect(exporter.state()).toBe('done')
      // 끝나면 다시 만들 수 있습니다.
      await exporter.start({ woff: false })
      expect(build).toHaveBeenCalledTimes(2)
      dispose()
    })
  })

  it('실패하면 원인과 다시 시도 방법을 알립니다', async () => {
    const build = vi.fn(() => Promise.reject(new Error('메모리 부족')))
    await createRoot(async (dispose) => {
      const exporter = createExporter(build)
      await exporter.start({ woff: true })
      expect(exporter.state()).toBe('error')
      expect(exporter.error()).toContain('메모리 부족')
      expect(exporter.error()).toContain('다시')
      dispose()
    })
  })

  it('입력이 글꼴 규격에 담기지 않으면(RangeError) 다시 누르라 하지 않고 고칠 것만 알립니다', async () => {
    const tooLong = new Error(
      '글꼴 정보가 너무 길어 이름 표에 담을 수 없습니다. 설명을 줄여 주세요.',
    )
    tooLong.name = 'RangeError' // 워커에서 넘어온 오류처럼 종류만 남은 경우
    const build = vi.fn(() => Promise.reject(tooLong))
    await createRoot(async (dispose) => {
      const exporter = createExporter(build)
      await exporter.start({ woff: true })
      expect(exporter.state()).toBe('error')
      expect(exporter.error()).toBe(
        '글꼴 파일을 만들지 못했습니다. 글꼴 정보가 너무 길어 이름 표에 담을 수 없습니다. 설명을 줄여 주세요.',
      )
      dispose()
    })
  })

  it('취소는 오류로 보지 않습니다', async () => {
    const build = vi.fn((_p: unknown, _r: unknown, options: { signal?: AbortSignal }) => {
      return new Promise<BuildResult>((_resolve, reject) => {
        options.signal?.addEventListener('abort', () =>
          reject(Object.assign(new Error('취소'), { name: 'AbortError' })),
        )
      })
    })
    await createRoot(async (dispose) => {
      const exporter = createExporter(build as never)
      const running = exporter.start({ woff: true })
      exporter.cancel()
      await running
      expect(exporter.state()).toBe('idle')
      expect(exporter.error()).toBe('')
      dispose()
    })
  })
})

describe('글꼴 정보 검사', () => {
  const meta = createPresetProject().meta

  it('기본값은 통과합니다', () => {
    expect(validateMeta(meta, true)).toEqual({})
  })

  it('빈 칸은 만들기를 누른 뒤에만 오류로 봅니다', () => {
    const empty = { ...meta, familyName: '' }
    expect(validateMeta(empty, false)).toEqual({})
    expect(validateMeta(empty, true).familyName).toContain('입력해 주세요')
  })

  it('영문 이름에 한글이 있으면 고치는 방법을 알려 줍니다', () => {
    expect(validateMeta({ ...meta, familyName: '루미너스' }, false).familyName).toContain('예:')
    expect(validateMeta({ ...meta, version: 'v1' }, false).version).toContain('1.000')
  })
})

describe('굵기 여러 벌을 한 가족으로', () => {
  // 시험 중 고친 저장소(기본 프리셋으로 시작)를 되돌립니다.
  afterEach(() => replaceProject(createPresetProject()))

  it('고른 굵기를 차례로 만들고 OTF·WOFF·WOFF2를 ZIP 하나로 묶으며, 화면에는 지금 굵기의 벌을 씁니다', async () => {
    const results = new Map<number, BuildResult>()
    const build = vi.fn(
      async (
        project: { style: { weight: number } },
        request: { woff: boolean; woff2?: boolean; member?: { weightClass: number } },
      ) => {
        const result = {
          ...fakeResult,
          woff: request.woff ? new ArrayBuffer(4) : undefined,
          woff2: request.woff2 ? new ArrayBuffer(3) : undefined,
          durationMs: project.style.weight,
        }
        results.set(request.member!.weightClass, result)
        return result
      },
    )
    const zip = vi.fn(async (entries: { name: string }[]) => {
      expect(entries.map((e) => e.name)).toEqual([
        'LuminousModular-Light.otf',
        'LuminousModular-Light.woff',
        'LuminousModular-Light.woff2',
        'LuminousModular-Regular.otf',
        'LuminousModular-Regular.woff',
        'LuminousModular-Regular.woff2',
        'LuminousModular-Bold.otf',
        'LuminousModular-Bold.woff',
        'LuminousModular-Bold.woff2',
      ])
      return new ArrayBuffer(16)
    })
    await createRoot(async (dispose) => {
      const exporter = createExporter(build as never, zip as never)
      await exporter.start({ woff: true, woff2: true, weights: [400, 700, 300, 400] })
      expect(
        build.mock.calls.map(
          (call) => (call[1] as { member: { weightClass: number } }).member.weightClass,
        ),
      ).toEqual([300, 400, 700])
      // 지금 굵기(76)가 아닌 벌은 그 등급의 획 굵기로 만듭니다.
      expect(
        build.mock.calls.map((call) => (call[0] as { style: { weight: number } }).style.weight),
      ).toEqual([60, 76, 130])
      expect(exporter.family()?.members.map((m) => m.weightClass)).toEqual([300, 400, 700])
      expect(exporter.result()).toBe(results.get(400))
      expect(exporter.state()).toBe('done')
      dispose()
    })
  })

  it('만드는 동안 글꼴 정보를 고쳐도 모든 벌을 시작할 때의 프로젝트로 만들어 한 가족을 지킵니다', async () => {
    const original = fontProject.meta.familyName
    const build = vi.fn(async (project: { meta: { familyName: string } }) => {
      // 첫 벌을 만드는 사이에 가족 이름을 고침
      editProject((draft) => void (draft.meta.familyName = 'Changed Family'))
      return { ...fakeResult, durationMs: project.meta.familyName.length }
    })
    const zipped: string[] = []
    const zip = vi.fn(async (entries: { name: string }[]) => {
      zipped.push(...entries.map((entry) => entry.name))
      return new ArrayBuffer(16)
    })
    await createRoot(async (dispose) => {
      const exporter = createExporter(build as never, zip as never)
      await exporter.start({ woff: false, weights: [300, 700] })
      expect(exporter.state()).toBe('done')
      expect(build.mock.calls.map((call) => call[0].meta.familyName)).toEqual([original, original])
      expect(zipped).toEqual(['LuminousModular-Light.otf', 'LuminousModular-Bold.otf'])
      dispose()
    })
  })

  it('굵기가 하나면 지금처럼 한 벌만 만듭니다', async () => {
    const build = vi.fn(async () => fakeResult)
    const zip = vi.fn()
    await createRoot(async (dispose) => {
      const exporter = createExporter(build as never, zip as never)
      await exporter.start({ woff: false, weights: [400] })
      expect(build).toHaveBeenCalledTimes(1)
      expect(zip).not.toHaveBeenCalled()
      expect(exporter.family()).toBeNull()
      dispose()
    })
  })

  it('지금 굵기의 벌은 프로젝트 굵기를 그대로 쓰고, 다른 벌은 그 등급의 획 굵기를 씁니다', () => {
    const project = createPresetProject()
    project.style.weight = 80 // 등급 400
    expect(memberProject(project, 400).style.weight).toBe(80)
    expect(memberProject(project, 700).style.weight).toBe(130)
    expect(project.style.weight).toBe(80)
  })
})
