import type { FontProject } from './types.ts'
import { normalizeProject } from './validate.ts'

/** 작업 중인 프로젝트를 자동 저장하는 열쇠 */
export const STORAGE_KEY = 'luminous-kr:project:v1'
/**
 * 읽지 못한 저장 원문을 지우지 않고 옮겨 두는 열쇠 (덮어쓰기 전에 사용자가 받아 갈 수 있게).
 * 원문 목록(JSON 배열)이라, 보관한 것이 있을 때 또 읽지 못한 원문이 생겨도 앞의 것을 덮어쓰지 않습니다.
 */
export const UNREADABLE_KEY = `${STORAGE_KEY}:unreadable`

/** 저장 결과. quota: 저장 공간이 모자람, unavailable: 브라우저가 저장소를 막음 */
export type SaveOutcome = 'ok' | 'quota' | 'unavailable'

/** 저장소에 닿지 못하면(사생활 보호 설정 등으로 접근만 해도 예외) undefined */
export function projectStorage(): Storage | undefined {
  try {
    return globalThis.localStorage ?? undefined
  } catch {
    return undefined
  }
}

function isQuotaError(error: unknown): boolean {
  if (!(error instanceof DOMException)) return false
  // 옛 Firefox는 이름이 다르고, 옛 WebKit은 code 22만 줍니다.
  return (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error.code === 22
  )
}

export function serializeProject(project: FontProject): string {
  return JSON.stringify(project)
}

/** 저장 원문을 프로젝트로 읽습니다. 형식이 맞지 않으면 예외 */
export function parseSaved(text: string): FontProject {
  return normalizeProject(JSON.parse(text))
}

/** 지금 저장되어 있는 원문 (없거나 저장소에 닿지 못하면 null) */
export function readSavedText(storage: Storage | undefined): string | null {
  try {
    return storage?.getItem(STORAGE_KEY) ?? null
  } catch {
    return null
  }
}

export type LoadResult = {
  project: FontProject | null
  /** 읽은 프로젝트의 저장 원문 (이 탭이 저장소와 맞춰진 기준) */
  text: string | null
  /** 보관 열쇠에 둔 읽지 못한 원문들 (전에 보관한 것과 이번에 옮긴 것) */
  kept: string[]
  /**
   * 읽지 못했는데 저장 공간이 모자라 옮기지 못하고 원래 자리에만 있는 원문.
   * 사용자가 받거나 버리기 전까지 자동 저장이 덮어쓰면 안 됩니다.
   */
  inPlace: string | null
}

/** 보관 열쇠의 값을 원문 목록으로 (목록이 아니면 원문 하나로 봄) */
export function parseKept(value: string | null): string[] {
  if (value === null) return []
  try {
    const list = JSON.parse(value) as unknown
    if (Array.isArray(list) && list.every((item) => typeof item === 'string')) return list
  } catch {
    // 목록이 아니면 원문 하나
  }
  return [value]
}

function readBoth(storage: Storage): { kept: string[]; text: string | null } | null {
  try {
    return { kept: parseKept(storage.getItem(UNREADABLE_KEY)), text: storage.getItem(STORAGE_KEY) }
  } catch {
    return null
  }
}

/**
 * 저장된 작업을 읽습니다.
 * 읽지 못하면 다음 자동 저장이 덮어쓰기 전에 원문을 보관 목록 끝에 더하고 원래 자리를 비웁니다.
 * 보관해 둔 앞의 원문은 지우지 않습니다. 저장 공간이 모자라 더하지 못하면 원래 자리에 둡니다(inPlace).
 */
export function loadSaved(storage: Storage | undefined): LoadResult {
  const read = storage ? readBoth(storage) : null
  if (!storage || !read) return { project: null, text: null, kept: [], inPlace: null }
  const { kept, text } = read
  if (!text) return { project: null, text: null, kept, inPlace: null }
  try {
    return { project: parseSaved(text), text, kept, inPlace: null }
  } catch {
    const next = kept.includes(text) ? kept : [...kept, text]
    try {
      if (next !== kept) storage.setItem(UNREADABLE_KEY, JSON.stringify(next))
    } catch {
      // 더하지 못하면 원래 자리에 그대로 두고, 덮어쓰지 않도록 알립니다.
      return { project: null, text: null, kept, inPlace: text }
    }
    try {
      storage.removeItem(STORAGE_KEY)
    } catch {
      // 보관은 했으므로 원래 자리는 다음 저장이 덮어써도 됩니다.
    }
    return { project: null, text: null, kept: next, inPlace: null }
  }
}

/** 저장 원문을 씁니다. 실패해도 예외를 던지지 않고 까닭을 돌려줍니다. */
export function writeSaved(storage: Storage | undefined, text: string): SaveOutcome {
  if (!storage) return 'unavailable'
  try {
    storage.setItem(STORAGE_KEY, text)
    return 'ok'
  } catch (error) {
    return isQuotaError(error) ? 'quota' : 'unavailable'
  }
}

/** 보관해 둔 읽지 못한 원문을 모두 지웁니다. */
export function removeUnreadable(storage: Storage | undefined): void {
  try {
    storage?.removeItem(UNREADABLE_KEY)
  } catch {
    // 지우지 못해도 화면에서는 닫습니다.
  }
}
