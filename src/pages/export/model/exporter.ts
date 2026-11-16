import { createSignal } from 'solid-js'
import { unwrap } from 'solid-js/store'
import {
  type BuildProgress,
  type BuildResult,
  type FontProject,
  buildFontFile,
  familyMemberNames,
  fontProject,
  strokeWeightFor,
  weightClassOf,
  zipFiles,
} from '@/entities/font'
import { isAssetLoadError } from '@/shared/lib/app-update'

export type ExportState = 'idle' | 'building' | 'done' | 'error'

/** 전체 글리프 수: 음절 11,172 + 호환 자모 51 */
export const TOTAL_GLYPHS = 11_223

/** 만들지 못한 까닭과 할 일. 입력이 글꼴 규격에 담기지 않으면(RangeError) 다시 눌러도 같으므로 고칠 것만 알립니다. */
function buildErrorText(cause: unknown): string {
  if (isAssetLoadError(cause)) {
    return '글꼴 파일을 만들지 못했습니다. 작업 스레드를 불러오지 못했습니다(새 버전이 나왔거나 연결이 끊겼을 수 있음). 화면 아래의 새로 고침을 눌러 주세요. 작업은 자동 저장되어 있습니다.'
  }
  const message = cause instanceof Error ? cause.message : String(cause)
  if (cause instanceof Error && cause.name === 'RangeError') {
    return `글꼴 파일을 만들지 못했습니다. ${message}`
  }
  return `글꼴 파일을 만들지 못했습니다(${message}). 잠시 뒤 다시 눌러 주세요.`
}

/** 굵기 여러 벌 가운데 지금 만드는 벌 */
export type MemberProgress = { index: number; total: number; weightClass: number }

/** 굵기 여러 벌을 한 가족으로 만든 결과 */
export type FamilyResult = {
  zip: ArrayBuffer
  members: { weightClass: number; fileBase: string; result: BuildResult }[]
}

class AbortedError extends Error {
  constructor() {
    super('작업을 취소했습니다.')
    this.name = 'AbortError'
  }
}

/** 그 굵기 등급의 벌을 만들 프로젝트 (지금 굵기면 그대로, 아니면 그 등급의 획 굵기) */
export function memberProject(project: FontProject, weightClass: number): FontProject {
  const plain = structuredClone(unwrap(project))
  if (weightClassOf(plain.style.weight) !== weightClass) {
    plain.style.weight = strokeWeightFor(weightClass)
  }
  return plain
}

/**
 * 글꼴 파일 만들기.
 * 버튼을 빠르게 두 번 눌러도 한 번만 돌도록 동기 잠금(locked)을 씁니다.
 * (상태 신호는 다음 렌더에야 버튼을 막으므로 그 사이의 두 번째 클릭을 막지 못함)
 * 굵기를 여럿 고르면 벌마다 차례로 만들고(같은 작업 스레드), 모두 ZIP 하나로 묶습니다.
 */
export function createExporter(build = buildFontFile, zip = zipFiles) {
  const [state, setState] = createSignal<ExportState>('idle')
  const [progress, setProgress] = createSignal<BuildProgress | null>(null)
  const [member, setMember] = createSignal<MemberProgress | null>(null)
  const [result, setResult] = createSignal<BuildResult | null>(null)
  const [family, setFamily] = createSignal<FamilyResult | null>(null)
  const [error, setError] = createSignal('')
  let locked = false
  let controller: AbortController | null = null

  async function buildFamily(
    weights: readonly number[],
    woff: boolean,
    signal: AbortSignal,
  ): Promise<void> {
    const members: FamilyResult['members'] = []
    for (const [index, weightClass] of weights.entries()) {
      if (signal.aborted) throw new AbortedError()
      setMember({ index, total: weights.length, weightClass })
      setProgress({ phase: 'compose', done: 0, total: TOTAL_GLYPHS })
      const project = memberProject(fontProject, weightClass)
      const built = await build(
        project,
        { woff, member: { weightClass } },
        { onProgress: setProgress, signal },
      )
      const fileBase = familyMemberNames(project, weightClass).postScriptName
      members.push({ weightClass, fileBase, result: built })
    }
    const entries = members.flatMap((m) => [
      // 결과 파일은 화면에서도 쓰므로 복사본을 넘깁니다.
      { name: `${m.fileBase}.otf`, data: m.result.otf.slice(0) },
      ...(m.result.woff ? [{ name: `${m.fileBase}.woff`, data: m.result.woff.slice(0) }] : []),
    ])
    const packed = await zip(entries, signal)
    const current = weightClassOf(fontProject.style.weight)
    setFamily({ zip: packed, members })
    setResult((members.find((m) => m.weightClass === current) ?? members[0]!).result)
  }

  /** @param weights 함께 만들 굵기 등급. 둘 이상이면 한 가족으로 만들어 ZIP으로 묶음 */
  async function start(options: { woff: boolean; weights?: readonly number[] }): Promise<void> {
    if (locked) return
    locked = true
    controller = new AbortController()
    const signal = controller.signal
    setState('building')
    setError('')
    setResult(null)
    setFamily(null)
    setMember(null)
    setProgress({ phase: 'compose', done: 0, total: TOTAL_GLYPHS })
    const weights = [...new Set(options.weights ?? [])].sort((a, b) => a - b)
    try {
      if (weights.length > 1) {
        await buildFamily(weights, options.woff, signal)
      } else {
        const built = await build(
          fontProject,
          { woff: options.woff },
          { onProgress: setProgress, signal },
        )
        setResult(built)
      }
      setState('done')
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') {
        setState('idle')
        setError('')
      } else {
        setState('error')
        setError(buildErrorText(cause))
      }
    } finally {
      setMember(null)
      locked = false
      controller = null
    }
  }

  function cancel(): void {
    controller?.abort()
  }

  return { state, progress, member, result, family, error, start, cancel }
}

export type Exporter = ReturnType<typeof createExporter>
