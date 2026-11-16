import type { FontProject } from './types.ts'
import { normalizeProject } from './validate.ts'

/** 작업 중인 프로젝트를 자동 저장하는 열쇠 */
export const STORAGE_KEY = 'luminous-kr:project:v1'
/**
 * 읽지 못한 저장 원문을 지우지 않고 옮겨 두는 열쇠의 앞부분. 원문마다 열쇠를 하나씩 씁니다
 * (목록 하나를 읽고-고치고-쓰면 그사이 다른 탭이 쓴 것을 덮으므로, 더하기·지우기가 열쇠 하나만 건드리게).
 */
export const UNREADABLE_PREFIX = `${STORAGE_KEY}:unreadable:`

/** 저장 결과. quota: 저장 공간이 모자람, unavailable: 브라우저가 저장소를 막음 */
export type SaveOutcome = 'ok' | 'quota' | 'unavailable'

/** 보관한 읽지 못한 원문 하나 */
export type KeptText = { key: string; text: string }

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

/** 지금 보관 열쇠들에 있는 원문 (보관한 차례대로) */
export function readKept(storage: Storage | undefined): KeptText[] {
  if (!storage) return []
  try {
    const kept: KeptText[] = []
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (!key?.startsWith(UNREADABLE_PREFIX)) continue
      const text = storage.getItem(key)
      if (text !== null) kept.push({ key, text })
    }
    return kept.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  } catch {
    return []
  }
}

let keySeq = 0
/** 보관한 차례대로 정렬되는 새 보관 열쇠 */
function newKeptKey(): string {
  keySeq += 1
  const time = Date.now().toString(36).padStart(10, '0')
  const tail = `${keySeq.toString(36)}${Math.random().toString(36).slice(2, 8)}`
  return `${UNREADABLE_PREFIX}${time}-${tail}`
}

export type LoadResult = {
  project: FontProject | null
  /** 읽은 프로젝트의 저장 원문 (이 탭이 저장소와 맞춰진 기준) */
  text: string | null
  /** 보관 열쇠에 둔 읽지 못한 원문들 (전에 보관한 것과 이번에 보관한 것) */
  kept: KeptText[]
  /**
   * 읽지 못했는데 저장 공간이 모자라 보관하지 못하고 원래 자리에만 있는 원문.
   * 사용자가 받아 두고 버리기 전까지 자동 저장이 덮어쓰면 안 됩니다.
   */
  inPlace: string | null
}

/**
 * 저장된 작업을 읽습니다.
 * 읽지 못하면 원문을 새 보관 열쇠에 복사해 둡니다(이미 같은 원문을 보관했으면 그대로).
 * 원래 자리는 비우지 않습니다. 그사이 다른 탭이 쓴 새 작업을 지울 수 있고, 보관했으니 다음 저장이 덮어써도 됩니다.
 * 저장 공간이 모자라 보관하지 못하면 원래 자리에만 있다고(inPlace) 알립니다.
 */
export function loadSaved(storage: Storage | undefined): LoadResult {
  const empty: LoadResult = { project: null, text: null, kept: [], inPlace: null }
  if (!storage) return empty
  let text: string | null
  try {
    text = storage.getItem(STORAGE_KEY)
  } catch {
    return empty
  }
  const kept = readKept(storage)
  if (!text) return { ...empty, kept }
  try {
    return { project: parseSaved(text), text, kept, inPlace: null }
  } catch {
    if (kept.some((entry) => entry.text === text)) return { ...empty, kept }
    const key = newKeptKey()
    try {
      storage.setItem(key, text)
    } catch {
      return { ...empty, kept, inPlace: text }
    }
    return { ...empty, kept: [...kept, { key, text }] }
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

/**
 * 보여 준 보관 원문의 열쇠만 지우고, 지금 남아 있는 보관 원문을 돌려줍니다.
 * 열쇠마다 따로 지우므로 그사이 다른 탭이 더한 원문은 지우지 않습니다.
 */
export function removeKept(storage: Storage | undefined, keys: readonly string[]): KeptText[] {
  for (const key of keys) {
    try {
      storage?.removeItem(key)
    } catch {
      // 지우지 못해도 화면에서는 닫습니다.
    }
  }
  return readKept(storage)
}
