/**
 * 글꼴 조합 워커: 미리보기 윤곽과 글꼴 파일을 메인 스레드 밖에서 만듭니다.
 */
import { contoursToSvgPath } from '@/shared/lib/geometry'
import { serveRpc, type WorkerScopeLike } from '@/shared/lib/worker-rpc'
import { buildFont } from '../lib/build-font.ts'
import { ComponentCache, Composer } from '../lib/composer.ts'
import { ASCENDER } from '../lib/outline.ts'
import type { FontProject } from '../model/types.ts'
import type { EngineMethods, RenderedGlyph } from './engine-protocol.ts'

/**
 * 판(revision)이 바뀌어도 이어 쓰는 윤곽 캐시. 점 하나를 옮기면 그 자모가 들어간 조각·음절만 다시 만들고,
 * 나머지(자모 판의 다른 자모, 588자 표의 다른 음절)는 그대로 씁니다.
 */
const shared = new ComponentCache({ syllables: true })
let current: { revision: number; composer: Composer } | null = null

/** 같은 판(revision)의 프로젝트면 조합기를 다시 쓰고, 판이 바뀌면 이어 쓰는 캐시로 새 조합기를 만듭니다. */
function composerFor(project: FontProject, revision: number): Composer {
  if (!current || current.revision !== revision) {
    current = { revision, composer: new Composer(project, shared) }
  }
  return current.composer
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
    // 입력한 글자만 담는 미리보기 글꼴은 편집할 때마다 다시 만들므로 이어 쓰는 캐시를 쓰고,
    // 11,172자 전체는 한 번만 만들므로 캐시에 담아 두지 않습니다.
    const cache = payload.request.chars !== undefined ? shared : undefined
    const result = await buildFont(
      payload.project,
      payload.request,
      (progress) => context.progress(progress),
      cache,
    )
    context.transfer(result.otf)
    if (result.woff) context.transfer(result.woff)
    return result
  },
})
