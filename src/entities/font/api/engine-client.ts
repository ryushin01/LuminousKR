import { unwrap } from 'solid-js/store'
import { RpcClient } from '@/shared/lib/worker-rpc'
import type { BuildProgress, BuildRequest, BuildResult } from '../lib/build-font.ts'
import type { FontProject } from '../model/types.ts'
import type { EngineMethods, RenderItem, RenderedGlyph } from './engine-protocol.ts'

const createWorker = () =>
  new Worker(new URL('./engine.worker.ts', import.meta.url), {
    type: 'module',
    name: 'luminous-engine',
  })

/**
 * 워커 두 개를 씁니다.
 * - live: 편집하면서 보는 미리보기 (짧은 요청이 자주 옴)
 * - build: 11,172자 전체 글꼴 만들기 (몇 초 걸려도 미리보기를 막지 않게 따로)
 */
const live = new RpcClient<EngineMethods>(createWorker)
const builder = new RpcClient<EngineMethods>(createWorker)

/** Solid 스토어의 Proxy는 구조화 복제가 안 되므로 원본 객체를 보냅니다. */
const plain = (project: FontProject): FontProject => unwrap(project)

export function renderGlyphs(
  project: FontProject,
  revision: number,
  items: RenderItem[],
): Promise<RenderedGlyph[]> {
  return live.call('render', { project: plain(project), revision, items })
}

export function buildFontFile(
  project: FontProject,
  request: BuildRequest,
  options: { onProgress?: (progress: BuildProgress) => void; signal?: AbortSignal } = {},
): Promise<BuildResult> {
  return builder.call('build', { project: plain(project), request }, options)
}

/** 미리보기용 작은 글꼴(입력한 글자만)은 live 워커에서 빠르게 만듭니다. */
export function buildPreviewFont(
  project: FontProject,
  chars: string,
  signal?: AbortSignal,
): Promise<BuildResult> {
  return live.call(
    'build',
    { project: plain(project), request: { chars, woff: false } },
    { signal },
  )
}
