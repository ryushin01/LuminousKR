import {
  ALL_JAMO_KEYS,
  type FontProject,
  type JamoKey,
  type LayoutId,
  type MissingDrawing,
  homeLayout,
  layoutFor,
  layoutsOf,
  missingDrawings,
} from '@/entities/font'
import { SYLLABLE_BASE, SYLLABLE_COUNT, decomposeCode } from '@/shared/lib/hangul'

/** 내보내기 전에 알릴 빈 자모 하나 (직접 그려야 고쳐지는 자모) */
export type EmptyJamo = {
  key: JamoKey
  /** 비어 있는 그림의 배치: 기본 획이 비었으면 기본 배치, 따로 그린 배치(벌)가 비었으면 그 배치 */
  layouts: LayoutId[]
  /** 이 자모의 빈 그림 때문에 획이 빠지는 음절 수 (파생 자모·겹받침의 한 부분으로 빠지는 음절 포함) */
  syllables: number
  /** 작업실에서 이 자모를 열 배치 (기본 획이 비었으면 기본 배치, 아니면 비어 있는 첫 배치) */
  layout: LayoutId
}

export type Precheck = {
  /** 직접 그려야 고칠 수 있는 빈 자모 (파생 자모는 그 바탕 자모로 알림) */
  empty: EmptyJamo[]
  /** 획이 하나라도 빠지는 음절 수 */
  affectedSyllables: number
}

/** 이 음절을 그릴 때 비어 있어 획이 빠지는 그림 (자모·그림마다 한 번) */
export function syllableMissing(
  project: FontProject,
  code: number,
  missingAt: (key: JamoKey, layout: LayoutId) => MissingDrawing[] = (key, layout) =>
    missingDrawings(project, key, layout),
): MissingDrawing[] {
  const parts = decomposeCode(code)
  if (!parts) return []
  const layout = layoutFor(parts.vowel, parts.tail)
  const keys: JamoKey[] = [`L${parts.lead}`, `V${parts.vowel}`]
  if (parts.tail > 0) keys.push(`T${parts.tail}`)
  const seen = new Map<string, MissingDrawing>()
  for (const key of keys) {
    for (const missing of missingAt(key, layout))
      seen.set(`${missing.key}:${missing.drawing}`, missing)
  }
  return [...seen.values()]
}

/**
 * 내보내기 전 점검: 음절마다 비어 있어 획이 빠지는 그림을 찾아(파생 자모·겹받침은 부분까지 따라감),
 * 그 그림을 그려야 할 자모와 그 때문에 획이 빠지는 음절 수를 셉니다.
 * '빈 글꼴로 시작'했거나 기본 자모의 획을 모두 지운 채 만들면 그 자모가 들어간 음절의 획이 빠지므로 알립니다.
 */
export function precheckProject(project: FontProject): Precheck {
  const cache = new Map<string, MissingDrawing[]>()
  const missingAt = (key: JamoKey, layout: LayoutId) => {
    const id = `${key}@${layout}`
    let found = cache.get(id)
    if (!found) {
      found = missingDrawings(project, key, layout)
      cache.set(id, found)
    }
    return found
  }

  const perKey = new Map<JamoKey, { syllables: number; base: boolean; layouts: Set<LayoutId> }>()
  let affected = 0
  for (let code = SYLLABLE_BASE; code < SYLLABLE_BASE + SYLLABLE_COUNT; code++) {
    const missing = syllableMissing(project, code, missingAt)
    if (missing.length === 0) continue
    affected += 1
    const keysHere = new Set<JamoKey>()
    for (const { key, drawing } of missing) {
      let entry = perKey.get(key)
      if (!entry) {
        entry = { syllables: 0, base: false, layouts: new Set() }
        perKey.set(key, entry)
      }
      if (drawing === 'base') entry.base = true
      else entry.layouts.add(drawing)
      keysHere.add(key)
    }
    for (const key of keysHere) perKey.get(key)!.syllables += 1
  }

  const empty: EmptyJamo[] = []
  for (const key of ALL_JAMO_KEYS) {
    const entry = perKey.get(key)
    if (!entry) continue
    const home = homeLayout(key)
    const layouts = layoutsOf(key).filter(
      (layout) => (entry.base && layout === home) || entry.layouts.has(layout),
    )
    empty.push({
      key,
      layouts,
      syllables: entry.syllables,
      layout: entry.base ? home : layouts[0]!,
    })
  }
  return { empty, affectedSyllables: affected }
}
