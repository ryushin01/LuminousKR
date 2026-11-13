/**
 * 글꼴 조합 워커: 미리보기 윤곽과 글꼴 파일을 메인 스레드 밖에서 만듭니다.
 */
import { contoursToSvgPath } from '@/shared/lib/geometry'
import { serveRpc, type WorkerScopeLike } from '@/shared/lib/worker-rpc'
import { buildFont } from '../lib/build-font.ts'
import { Composer } from '../lib/composer.ts'
import { ASCENDER } from '../lib/outline.ts'
import type { FontProject } from '../model/types.ts'
import type { EngineMethods, RenderedGlyph } from './engine-protocol.ts'

let cache: { revision: number; composer: Composer } | null = null

/** 같은 판(revision)의 프로젝트면 자모 윤곽 캐시를 다시 씁니다. */
function composerFor(project: FontProject, revision: number): Composer {
  if (!cache || cache.revision !== revision) cache = { revision, composer: new Composer(project) }
  return cache.composer
}

serveRpc(self as unknown as WorkerScopeLike, {
  render(payload: EngineMethods['render']['payload']): RenderedGlyph[] {
    const composer = composerFor(payload.project, payload.revision)
    const advance = payload.project.metrics.advance
    return payload.items.map((item) => {
      const contours =
        item.type === 'char'
          ? composer.glyphContours(item.char.codePointAt(0) ?? 0)
          : composer.jamoContours(item.key, item.layout)
      return { d: contoursToSvgPath(contours, ASCENDER), advance }
    })
  },

  async build(payload: EngineMethods['build']['payload'], context) {
    const result = await buildFont(payload.project, payload.request, (progress) =>
      context.progress(progress),
    )
    context.transfer(result.otf)
    if (result.woff) context.transfer(result.woff)
    return result
  },
})
