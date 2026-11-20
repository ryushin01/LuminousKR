import type { Paths64 } from 'clipper2-ts'
import { rectsOverlap, type Contour, type Rect } from '@/shared/lib/geometry'
import {
  COMPAT_CONSONANTS,
  COMPAT_JAMO_FIRST,
  LEADS,
  TAILS,
  decomposeCode,
  isCompatJamoCode,
  isSyllableCode,
  vowelShape,
} from '@/shared/lib/hangul'
import { isLatinCode, latinDrawing, latinWidth } from '../model/latin.ts'
import { layoutFor } from '../model/layout.ts'
import type { Box, FontProject, JamoKey, LayoutId } from '../model/types.ts'
import {
  bodyFrame,
  expandStrokes,
  latinAdvance,
  latinFrame,
  pathsBounds,
  pathsToContours,
  unionPaths,
  type BodyFrame,
} from './outline.ts'
import { resolveJamo, type PlacedStroke, type ResolveOptions } from './resolve.ts'

type Component = {
  paths: Paths64
  contours: Contour[]
  /** 다각형마다의 경계 (섞임 모음처럼 떨어진 조각이 있는 자모의 겹침을 정확히 보려고) */
  bounds: Rect[]
}

/** 음절 하나의 합친 윤곽과, 그때 쓴 조각들(조각이 같으면 다시 씀) */
type MergedSyllable = { pieces: Component[]; contours: Contour[] }

/** 음절 캐시가 이보다 커지면 비웁니다 (미리보기 화면에서 보는 음절은 수백 자). */
const MAX_CACHED_SYLLABLES = 4000

/**
 * 판(revision)이 바뀌어도 이어 쓰는 윤곽 캐시.
 * 자모×배치 윤곽은 입력(배치한 획·획 스타일·글자 틀)이 같으면 다시 계산하지 않고,
 * 음절은 조각이 모두 같으면 합친 윤곽을 다시 씁니다. 점 하나를 옮기면 그 자모가 들어간 것만 다시 만듭니다.
 */
export class ComponentCache {
  readonly components = new Map<string, { input: string; component: Component }>()
  readonly syllables = new Map<number, MergedSyllable>()
  /** 음절도 담을지 (편집 미리보기용). 글꼴 전체를 한 번 만들 때는 담아 둘 까닭이 없습니다. */
  readonly keepSyllables: boolean

  constructor(options: { syllables?: boolean } = {}) {
    this.keepSyllables = options.syllables ?? false
  }

  clear(): void {
    this.components.clear()
    this.syllables.clear()
  }
}

/** 호환 자모(낱자)를 놓을 틀 */
const STANDALONE: Record<'consonant' | 'cluster' | 'vertical' | 'horizontal' | 'mixed', Box> = {
  consonant: { x0: 0.16, y0: 0.12, x1: 0.84, y1: 0.88 },
  cluster: { x0: 0.04, y0: 0.26, x1: 0.96, y1: 0.74 },
  vertical: { x0: 0.26, y0: 0.02, x1: 0.74, y1: 0.98 },
  horizontal: { x0: 0.02, y0: 0.26, x1: 0.98, y1: 0.74 },
  mixed: { x0: 0.06, y0: 0.06, x1: 0.94, y1: 0.94 },
}

/**
 * 프로젝트 하나로 글자 윤곽을 만듭니다.
 * 자모×배치마다 윤곽을 한 번만 계산해 두고(최대 약 250개), 음절은 그 조각을 모아 만듭니다.
 * 조각이 서로 겹칠 때만 다시 합쳐 곡선을 맞춥니다.
 */
export class Composer {
  readonly project: FontProject
  readonly frame: BodyFrame
  /** 영문 글자의 뼈대 틀 */
  readonly latinFrame: BodyFrame
  private readonly resolveOptions: ResolveOptions
  private readonly cache: ComponentCache
  /** 윤곽 모양을 정하는 획 스타일·글자 틀 (캐시 입력의 앞부분) */
  private readonly styleKey: string
  /** 이 조합기(한 판의 프로젝트)에서 이미 찾은 조각 — 같은 판에서는 획을 다시 배치하지도 않음 */
  private readonly local = new Map<string, Component>()

  /** @param cache 판이 바뀌어도 이어 쓸 캐시 (없으면 이 조합기만 씀) */
  constructor(project: FontProject, cache: ComponentCache = new ComponentCache()) {
    this.project = project
    this.frame = bodyFrame(project.metrics, project.style)
    this.latinFrame = latinFrame(project.metrics, project.style)
    this.resolveOptions = resolveOptionsFor(project)
    this.cache = cache
    // 영문 틀도 같은 입력(획 스타일·좌우 여백)으로 정해지므로 열쇠에 따로 넣지 않습니다.
    this.styleKey = JSON.stringify([project.style, this.frame])
  }

  private build(strokes: readonly PlacedStroke[], frame: BodyFrame): Component {
    const { style } = this.project
    const paths = expandStrokes(strokes, style, frame)
    const bounds: Rect[] = []
    for (const path of paths) {
      const rect = pathsBounds([path], style)
      if (rect) bounds.push(rect)
    }
    return { paths, contours: pathsToContours(paths, style), bounds }
  }

  /**
   * 배치한 획이 같으면(같은 스타일·글자 틀에서) 전에 만든 윤곽을 다시 씁니다.
   * 획을 배치하는 것은 가볍고, 두께 입히기·합치기·곡선 맞춤이 무겁습니다.
   */
  private cached(
    id: string,
    make: () => readonly PlacedStroke[],
    frame: BodyFrame = this.frame,
  ): Component {
    const known = this.local.get(id)
    if (known) return known
    const strokes = make()
    const input = `${this.styleKey}${JSON.stringify(strokes)}`
    const hit = this.cache.components.get(id)
    let component: Component
    if (hit && hit.input === input) {
      component = hit.component
    } else {
      component = this.build(strokes, frame)
      this.cache.components.set(id, { input, component })
    }
    this.local.set(id, component)
    return component
  }

  /** 자모 하나를 배치에 놓은 윤곽 */
  component(key: JamoKey, layout: LayoutId): Component {
    return this.cached(`${key}@${layout}`, () =>
      resolveJamo(this.project, key, layout, this.resolveOptions),
    )
  }

  /** 편집 화면에 보여 줄 자모 하나의 획(음절 좌표) */
  placedStrokes(key: JamoKey, layout: LayoutId): PlacedStroke[] {
    return resolveJamo(this.project, key, layout, this.resolveOptions)
  }

  jamoContours(key: JamoKey, layout: LayoutId): Contour[] {
    return this.component(key, layout).contours
  }

  syllableContours(code: number): Contour[] {
    const parts = decomposeCode(code)
    if (!parts) return []
    const layout = layoutFor(parts.vowel, parts.tail)
    const pieces = [
      this.component(`L${parts.lead}`, layout),
      this.component(`V${parts.vowel}`, layout),
    ]
    if (parts.tail > 0) pieces.push(this.component(`T${parts.tail}`, layout))
    if (!this.cache.keepSyllables) return this.merge(pieces)
    const hit = this.cache.syllables.get(code)
    if (hit && hit.pieces.length === pieces.length && hit.pieces.every((p, i) => p === pieces[i])) {
      return hit.contours
    }
    const contours = this.merge(pieces)
    if (this.cache.syllables.size >= MAX_CACHED_SYLLABLES) this.cache.syllables.clear()
    this.cache.syllables.set(code, { pieces, contours })
    return contours
  }

  private merge(pieces: Component[]): Contour[] {
    const overlap = pieces.some((a, i) =>
      pieces
        .slice(i + 1)
        .some((b) => a.bounds.some((ra) => b.bounds.some((rb) => rectsOverlap(ra, rb, -0.5)))),
    )
    if (!overlap) return pieces.flatMap((p) => p.contours)
    return pathsToContours(unionPaths(pieces.map((p) => p.paths)), this.project.style)
  }

  /** 호환 자모(ㄱ, ㅏ, ㄳ …) 낱자 윤곽 */
  standaloneContours(code: number): Contour[] {
    if (!isCompatJamoCode(code)) return []
    return this.cached(`S${code}`, () => {
      const offset = code - COMPAT_JAMO_FIRST
      if (offset < COMPAT_CONSONANTS.length) {
        const char = COMPAT_CONSONANTS[offset]!
        const lead = (LEADS as readonly string[]).indexOf(char)
        if (lead >= 0) {
          return resolveJamo(
            this.project,
            `L${lead}`,
            'A',
            this.resolveOptions,
            STANDALONE.consonant,
            false,
          )
        }
        const tail = (TAILS as readonly string[]).indexOf(char)
        return resolveJamo(
          this.project,
          `T${tail}`,
          'D',
          this.resolveOptions,
          STANDALONE.cluster,
          false,
        )
      }
      const vowel = offset - COMPAT_CONSONANTS.length
      const shape = vowelShape(vowel)
      const layout: LayoutId = shape === 'vertical' ? 'A' : shape === 'horizontal' ? 'B' : 'C'
      return resolveJamo(
        this.project,
        `V${vowel}`,
        layout,
        this.resolveOptions,
        STANDALONE[shape],
        false,
      )
    }).contours
  }

  /** 영문·숫자·문장부호 한 글자의 윤곽 (그 글자의 뼈대 틀에서) */
  private latinContours(code: number): Contour[] {
    const char = String.fromCharCode(code)
    return this.cached(
      `latin:${char}`,
      () => latinDrawing(this.project, char).strokes,
      this.latinFrame,
    ).contours
  }

  /** 글자 하나의 윤곽. 한글 음절·호환 자모·영문(ASCII 인쇄 글자)이 아니면 빈 배열입니다. */
  glyphContours(code: number): Contour[] {
    if (isSyllableCode(code)) return this.syllableContours(code)
    if (isCompatJamoCode(code)) return this.standaloneContours(code)
    if (isLatinCode(code)) return this.latinContours(code)
    return []
  }

  /** 글자 너비. 한글은 모두 같고, 영문은 글자마다 다릅니다. */
  glyphAdvance(code: number): number {
    const { metrics, style } = this.project
    if (!isLatinCode(code)) return metrics.advance
    return latinAdvance(metrics, style, latinWidth(this.project, String.fromCharCode(code)))
  }
}

/** 나란히 놓는 두 자모(ㄲ, ㄳ …) 사이 간격: 획 굵기에 비례 */
export function resolveOptionsFor(project: FontProject): ResolveOptions {
  const frame = bodyFrame(project.metrics, project.style)
  return { pairGap: (project.style.weight / (frame.x1 - frame.x0)) * 1.1 }
}

/** 편집 화면에 보여 줄, 그 배치에서 실제로 쓰이는 획 (음절 좌표) */
export function placedStrokesFor(
  project: FontProject,
  key: JamoKey,
  layout: LayoutId,
): PlacedStroke[] {
  return resolveJamo(project, key, layout, resolveOptionsFor(project))
}

/** 이 조합기가 글리프를 만들 수 있는 글자인지 */
export function isComposable(code: number): boolean {
  return isSyllableCode(code) || isCompatJamoCode(code) || isLatinCode(code)
}
