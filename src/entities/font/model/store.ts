import { batch, createSignal } from 'solid-js'
import { createStore, produce, reconcile, unwrap } from 'solid-js/store'
import {
  STORAGE_KEY,
  type SaveOutcome,
  loadSaved,
  parseSaved,
  projectStorage,
  readSavedText,
  removeUnreadable,
  serializeProject,
  writeSaved,
} from './persistence.ts'
import { createPresetProject } from './preset.ts'
import type { FontProject } from './types.ts'

const HISTORY_LIMIT = 80
/** 같은 묶음 이름으로 이 시간 안에 이어진 변경은 되돌리기 한 번으로 묶습니다 (슬라이더 끌기 등). */
const COALESCE_MS = 900
/** 바뀐 뒤 이만큼 더 바뀌지 않으면 저장합니다 (끄는 동안 매번 쓰지 않게). */
const SAVE_DELAY_MS = 400

let storage = projectStorage()
const loaded = loadSaved(storage)

const [project, setProject] = createStore<FontProject>(loaded.project ?? createPresetProject())
const [revision, setRevision] = createSignal(0)
const [pastSize, setPastSize] = createSignal(0)
const [futureSize, setFutureSize] = createSignal(0)
const [saveFailure, setSaveFailure] = createSignal<Exclude<SaveOutcome, 'ok'> | null>(null)
const [syncedAt, setSyncedAt] = createSignal(0)
const [unreadable, setUnreadable] = createSignal<string | null>(loaded.unreadable)
const [unreadableKept, setUnreadableKept] = createSignal(loaded.kept)

const past: FontProject[] = []
const future: FontProject[] = []
let lastCoalesce: { key: string; at: number } | null = null
let saveTimer: ReturnType<typeof setTimeout> | undefined
/** 이 탭이 마지막으로 쓰거나 받아 맞춘 저장 원문 (다른 탭의 지난 이벤트를 거르는 기준) */
let lastSeen: string | null = loaded.text
/**
 * 읽지 못한 원문을 보관하지 못해 원래 자리에만 있을 때는, 사용자가 받거나 버리기 전까지 저장하지 않습니다
 * (작은 새 작업이 원래 작업을 덮어써 되찾을 수 없게 되는 것을 막음).
 */
let saveBlocked = loaded.unreadable !== null && !loaded.kept

// 되돌리기용 복사본은 추적하지 않고 그 순간의 값을 뜹니다.
const snapshot = (): FontProject => structuredClone(unwrap(project))

function saveNow(): void {
  clearTimeout(saveTimer)
  saveTimer = undefined
  if (saveBlocked) return
  const text = serializeProject(unwrap(project))
  const outcome = writeSaved(storage, text)
  if (outcome === 'ok') lastSeen = text
  setSaveFailure(outcome === 'ok' ? null : outcome)
}

function scheduleSave(): void {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(saveNow, SAVE_DELAY_MS)
}

/** 기다리는 저장이 있으면 바로 씁니다 (탭을 닫거나 새로 고치기 직전). */
export function flushProjectSave(): void {
  if (saveTimer !== undefined) saveNow()
}

function syncHistorySignals(): void {
  setPastSize(past.length)
  setFutureSize(future.length)
}

function clearHistory(): void {
  past.length = 0
  future.length = 0
  lastCoalesce = null
  syncHistorySignals()
}

function pushHistory(coalesceKey?: string): void {
  const now = Date.now()
  if (coalesceKey && lastCoalesce?.key === coalesceKey && now - lastCoalesce.at < COALESCE_MS) {
    lastCoalesce.at = now
    return
  }
  past.push(snapshot())
  if (past.length > HISTORY_LIMIT) past.shift()
  future.length = 0
  lastCoalesce = coalesceKey ? { key: coalesceKey, at: now } : null
}

function committed(): void {
  setRevision((r) => r + 1)
  syncHistorySignals()
  scheduleSave()
}

/** 현재 글꼴 프로젝트 (읽기 전용 스토어). 읽는 곳의 JSX·효과에서 추적됩니다. */
// eslint-disable-next-line solid/reactivity
export const fontProject: FontProject = project

/** 프로젝트가 바뀔 때마다 1씩 커지는 판 번호. 워커 캐시를 맞추는 데 씁니다. */
export const projectRevision = revision

export const canUndo = () => pastSize() > 0
export const canRedo = () => futureSize() > 0

/** 마지막 자동 저장이 실패했으면 그 까닭 (다음 저장이 성공하면 null) */
export const projectSaveFailure = saveFailure

/** 다른 탭에서 저장한 작업을 이 탭에 마지막으로 맞춘 시각 (없으면 0) */
export const projectSyncedAt = syncedAt

/** 읽지 못한 저장 원문 (없으면 null) */
export const unreadableProjectText = unreadable

/**
 * 읽지 못한 원문을 보관 열쇠에 두었는지. false면 원래 자리에만 있어 받거나 버리기 전까지 자동 저장을 멈춥니다.
 */
export const unreadableProjectKept = unreadableKept

function releaseUnreadable(): void {
  setUnreadable(null)
  setUnreadableKept(true)
  if (saveBlocked) {
    saveBlocked = false
    // 멈춰 있던 동안의 변경을 바로 씁니다.
    saveNow()
  }
}

/** 읽지 못한 원문을 받았을 때. 보관하지 못한 원문이면 이제 덮어써도 되므로 자동 저장을 다시 켭니다. */
export function unreadableProjectDownloaded(): void {
  if (!unreadableKept()) releaseUnreadable()
}

/** 읽지 못한 원문을 버립니다 (보관 열쇠도 지움). */
export function discardUnreadableProject(): void {
  removeUnreadable(storage)
  releaseUnreadable()
}

/**
 * 프로젝트를 고칩니다.
 * @param coalesce 같은 이름의 연속 변경을 되돌리기 한 번으로 묶을 때
 */
export function editProject(
  recipe: (draft: FontProject) => void,
  options: { coalesce?: string } = {},
): void {
  batch(() => {
    pushHistory(options.coalesce)
    setProject(produce(recipe))
    committed()
  })
}

/** 프로젝트를 통째로 바꿉니다 (파일 열기, 기본값으로 되돌리기). 되돌리기로 이전 상태로 갈 수 있습니다. */
export function replaceProject(next: FontProject): void {
  batch(() => {
    pushHistory()
    setProject(reconcile(structuredClone(next)))
    committed()
  })
}

export function undo(): void {
  const previous = past.pop()
  if (!previous) return
  batch(() => {
    future.push(snapshot())
    setProject(reconcile(previous))
    lastCoalesce = null
    committed()
  })
}

export function redo(): void {
  const next = future.pop()
  if (!next) return
  batch(() => {
    past.push(snapshot())
    setProject(reconcile(next))
    lastCoalesce = null
    committed()
  })
}

export function projectToJson(): string {
  return JSON.stringify(unwrap(project), null, 2)
}

/**
 * 다른 탭이 저장한 작업으로 이 탭을 맞춥니다.
 * 되돌리기 기록은 프로젝트 전체를 떠 둔 것이라, 그대로 두면 되돌리기가 다른 탭의 변경까지 지우므로 비웁니다.
 * 읽지 못하는 저장(나중 판 형식 등)이면 맞추지 않습니다. 이 탭은 다시 저장하지 않습니다(이미 같은 값).
 */
export function adoptSavedProject(text: string | null): boolean {
  if (text === null) return false
  let next: FontProject
  try {
    next = parseSaved(text)
  } catch {
    return false
  }
  batch(() => {
    clearTimeout(saveTimer)
    saveTimer = undefined
    lastSeen = text
    // 다른 탭이 이미 원래 자리를 덮어썼으므로 이 탭이 저장을 멈춰 둘 까닭이 없습니다(원문은 화면에서 계속 받을 수 있음).
    saveBlocked = false
    setProject(reconcile(next))
    clearHistory()
    setRevision((r) => r + 1)
    setSaveFailure(null)
    setSyncedAt(Date.now())
  })
  return true
}

/**
 * 다른 탭의 저장 이벤트를 받았을 때 맞출 원문.
 * 이벤트는 쌓여 있다가 오므로 이벤트의 값이 아니라 지금 저장된 값을 봅니다(두 탭이 거의 함께 저장하면 지난 값이
 * 늦게 도착할 수 있음). 지금 값이 이 탭이 마지막으로 쓰거나 맞춘 것이면 맞출 것이 없습니다.
 */
export function storageChangeToAdopt(): string | null {
  const current = readSavedText(storage)
  return current === null || current === lastSeen ? null : current
}

/**
 * 탭 사이 맞추기와 닫기 직전 저장을 켭니다. 앱을 시작할 때 한 번 부르고, 끌 함수를 돌려줍니다.
 * storage 이벤트는 저장한 탭이 아닌 다른 탭에만 옵니다.
 */
export function startProjectSync(): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || (event.storageArea && event.storageArea !== storage)) return
    adoptSavedProject(storageChangeToAdopt())
  }
  const onPageHide = () => flushProjectSave()
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') flushProjectSave()
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener('pagehide', onPageHide)
  document.addEventListener('visibilitychange', onVisibility)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('pagehide', onPageHide)
    document.removeEventListener('visibilitychange', onVisibility)
  }
}

/** 테스트용: 저장소를 기본 프리셋으로 되돌리고 기록·알림을 비웁니다. */
export function resetProjectStoreForTest(
  next: FontProject = createPresetProject(),
  options: { storage?: Storage; unreadable?: string | null; kept?: boolean } = {},
): void {
  clearTimeout(saveTimer)
  saveTimer = undefined
  storage = options.storage ?? projectStorage()
  lastSeen = null
  setProject(reconcile(structuredClone(next)))
  clearHistory()
  setSaveFailure(null)
  setSyncedAt(0)
  setUnreadable(options.unreadable ?? null)
  setUnreadableKept(options.kept ?? true)
  saveBlocked = (options.unreadable ?? null) !== null && options.kept === false
}
