import { createRoot } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { createPresetProject, type BuildResult } from '@/entities/font'
import { createExporter } from './exporter.ts'
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
