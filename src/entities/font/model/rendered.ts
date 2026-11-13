import { type Accessor, createEffect, createSignal, on, onCleanup } from 'solid-js'
import { unwrap } from 'solid-js/store'
import { renderGlyphs } from '../api/engine-client.ts'
import type { RenderItem, RenderedGlyph } from '../api/engine-protocol.ts'
import { fontProject, projectRevision } from './store.ts'
import type { FontProject, StrokeStyle } from './types.ts'

export type RenderSource = {
  project: FontProject
  /** 워커 캐시 열쇠. 같은 값이면 같은 프로젝트로 봅니다. */
  revision: number
}

/** 현재 편집 중인 프로젝트 */
export const currentSource = (): RenderSource => ({
  project: fontProject,
  revision: projectRevision(),
})

function hashText(text: string): number {
  let hash = 0
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0
  return hash
}

/** 프로젝트는 그대로 두고 획 스타일만 바꿔 본 결과 (맛보기용, 저장되지 않음) */
export function sourceWithStyle(patch: Accessor<Partial<StrokeStyle>>): Accessor<RenderSource> {
  return () => {
    const base = unwrap(fontProject)
    const style = { ...base.style, ...patch() }
    const revision = -Math.abs(projectRevision() * 7919 + hashText(JSON.stringify(style))) - 1
    return { project: { ...base, style }, revision }
  }
}

/**
 * 글리프 윤곽을 워커에 요청해 받아 옵니다.
 * 요청이 처리되는 동안 바뀐 것은 모아 두었다가 끝나면 마지막 상태로 한 번만 다시 요청합니다
 * (슬라이더를 끄는 동안 요청이 쌓이지 않게).
 */
export function createRenderedGlyphs(
  items: Accessor<RenderItem[]>,
  source: Accessor<RenderSource> = currentSource,
): Accessor<RenderedGlyph[] | undefined> {
  const [glyphs, setGlyphs] = createSignal<RenderedGlyph[]>()
  let inFlight = false
  let queued = false
  let disposed = false

  const run = () => {
    if (disposed) return
    if (inFlight) {
      queued = true
      return
    }
    inFlight = true
    const { project, revision } = source()
    const list = items()
    renderGlyphs(project, revision, list)
      .then((result) => {
        if (!disposed) setGlyphs(result)
      })
      .catch(() => {
        // 워커가 다시 시작되며 실패한 요청은 다음 변경 때 다시 그립니다.
      })
      .finally(() => {
        inFlight = false
        if (queued) {
          queued = false
          run()
        }
      })
  }

  createEffect(on([items, () => source().revision], run))
  onCleanup(() => {
    disposed = true
  })
  return glyphs
}
