import {
  ALL_JAMO_KEYS,
  type FontProject,
  type JamoKey,
  type LayoutId,
  homeLayout,
  isDerivable,
  layoutFor,
  layoutsOf,
  placedStrokesFor,
} from '@/entities/font'
import { SYLLABLE_BASE, SYLLABLE_COUNT, decomposeCode } from '@/shared/lib/hangul'

/** 내보내기 전에 알릴 빈 자모 하나 */
export type EmptyJamo = {
  key: JamoKey
  /** 비어 있는 배치 (기본 배치가 비면 그 자모가 쓰이는 모든 배치가 비는 경우가 많음) */
  layouts: LayoutId[]
  /** 이 자모의 빈 배치 때문에 획이 빠지는 음절 수 */
  syllables: number
  /** 작업실에서 이 자모를 열 배치 (비어 있는 첫 배치) */
  layout: LayoutId
}

export type Precheck = {
  /** 직접 그려야 고칠 수 있는 빈 자모 (파생 자모는 바탕이 비어서 빈 것이면 빼고 바탕을 알림) */
  empty: EmptyJamo[]
  /** 획이 하나라도 빠지는 음절 수 */
  affectedSyllables: number
}

/**
 * 내보내기 전 점검: 그 배치에서 획이 하나도 없는 자모를 찾아, 그 때문에 획이 빠지는 음절 수를 셉니다.
 * '빈 글꼴로 시작'했거나 기본 자모의 획을 모두 지운 채 만들면 그 자모가 들어간 음절이 빈 글자로 나가므로 알립니다.
 */
export function precheckProject(project: FontProject): Precheck {
  const emptyLayouts = new Map<JamoKey, LayoutId[]>()
  for (const key of ALL_JAMO_KEYS) {
    const layouts = layoutsOf(key).filter(
      (layout) => placedStrokesFor(project, key, layout).length === 0,
    )
    if (layouts.length > 0) emptyLayouts.set(key, layouts)
  }
  const isEmpty = (key: JamoKey, layout: LayoutId) =>
    emptyLayouts.get(key)?.includes(layout) ?? false

  // 자모마다 획이 빠지는 음절 수와, 하나라도 빠지는 음절 수
  const perKey = new Map<JamoKey, number>()
  let affected = 0
  for (let code = SYLLABLE_BASE; code < SYLLABLE_BASE + SYLLABLE_COUNT; code++) {
    const parts = decomposeCode(code)!
    const layout = layoutFor(parts.vowel, parts.tail)
    const keys: JamoKey[] = [`L${parts.lead}`, `V${parts.vowel}`]
    if (parts.tail > 0) keys.push(`T${parts.tail}`)
    let hit = false
    for (const key of keys) {
      if (!isEmpty(key, layout)) continue
      perKey.set(key, (perKey.get(key) ?? 0) + 1)
      hit = true
    }
    if (hit) affected += 1
  }

  const empty: EmptyJamo[] = []
  for (const [key, layouts] of emptyLayouts) {
    // 직접 그리지 않은 파생 자모가 비었다면 바탕 자모가 빈 것이므로, 바탕 자모 쪽에서 알립니다.
    const own = project.jamo[key]
    const drawnHere = own?.base !== undefined || own?.variants !== undefined
    if (isDerivable(key) && !drawnHere) continue
    empty.push({
      key,
      layouts,
      syllables: perKey.get(key) ?? 0,
      layout: layouts.includes(homeLayout(key)) ? homeLayout(key) : layouts[0]!,
    })
  }
  return { empty, affectedSyllables: affected }
}
