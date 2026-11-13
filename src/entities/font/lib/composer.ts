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
import { layoutFor } from '../model/layout.ts'
import type { Box, FontProject, JamoKey, LayoutId } from '../model/types.ts'
import {
  bodyFrame,
  expandStrokes,
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
  private readonly resolveOptions: ResolveOptions
  private readonly components = new Map<string, Component>()

  constructor(project: FontProject) {
    this.project = project
    this.frame = bodyFrame(project.metrics, project.style)
    this.resolveOptions = resolveOptionsFor(project)
  }

  private build(strokes: PlacedStroke[]): Component {
    const { style } = this.project
    const paths = expandStrokes(strokes, style, this.frame)
    const bounds: Rect[] = []
    for (const path of paths) {
      const rect = pathsBounds([path], style)
      if (rect) bounds.push(rect)
    }
    return { paths, contours: pathsToContours(paths, style), bounds }
  }

  private cached(id: string, make: () => PlacedStroke[]): Component {
    let component = this.components.get(id)
    if (!component) {
      component = this.build(make())
      this.components.set(id, component)
    }
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
    return this.merge(pieces)
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

  /** 글자 하나의 윤곽. 한글 음절·호환 자모가 아니면 빈 배열입니다. */
  glyphContours(code: number): Contour[] {
    if (isSyllableCode(code)) return this.syllableContours(code)
    if (isCompatJamoCode(code)) return this.standaloneContours(code)
    return []
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
  return isSyllableCode(code) || isCompatJamoCode(code)
}
