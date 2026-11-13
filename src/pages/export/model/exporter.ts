import { createSignal } from 'solid-js'
import { type BuildProgress, type BuildResult, buildFontFile, fontProject } from '@/entities/font'

export type ExportState = 'idle' | 'building' | 'done' | 'error'

/** 전체 글리프 수: 음절 11,172 + 호환 자모 51 */
export const TOTAL_GLYPHS = 11_223

/**
 * 글꼴 파일 만들기.
 * 버튼을 빠르게 두 번 눌러도 한 번만 돌도록 동기 잠금(locked)을 씁니다.
 * (상태 신호는 다음 렌더에야 버튼을 막으므로 그 사이의 두 번째 클릭을 막지 못함)
 */
export function createExporter(build = buildFontFile) {
  const [state, setState] = createSignal<ExportState>('idle')
  const [progress, setProgress] = createSignal<BuildProgress | null>(null)
  const [result, setResult] = createSignal<BuildResult | null>(null)
  const [error, setError] = createSignal('')
  let locked = false
  let controller: AbortController | null = null

  async function start(options: { woff: boolean }): Promise<void> {
    if (locked) return
    locked = true
    controller = new AbortController()
    setState('building')
    setError('')
    setResult(null)
    setProgress({ phase: 'compose', done: 0, total: TOTAL_GLYPHS })
    try {
      const built = await build(
        fontProject,
        { woff: options.woff },
        { onProgress: setProgress, signal: controller.signal },
      )
      setResult(built)
      setState('done')
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') {
        setState('idle')
        setError('')
      } else {
        setState('error')
        setError(
          `글꼴 파일을 만들지 못했습니다(${cause instanceof Error ? cause.message : String(cause)}). 잠시 뒤 다시 눌러 주세요.`,
        )
      }
    } finally {
      locked = false
      controller = null
    }
  }

  function cancel(): void {
    controller?.abort()
  }

  return { state, progress, result, error, start, cancel }
}

export type Exporter = ReturnType<typeof createExporter>
