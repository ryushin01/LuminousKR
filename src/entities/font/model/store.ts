import { batch, createSignal } from 'solid-js'
import { createStore, produce, reconcile, unwrap } from 'solid-js/store'
import {
  type KeptText,
  STORAGE_KEY,
  type SaveOutcome,
  UNREADABLE_PREFIX,
  loadSaved,
  parseSaved,
  projectStorage,
  readKept,
  readSavedText,
  removeKept,
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
/** 보관 열쇠에 둔 읽지 못한 원문들 */
const [keptTexts, setKeptTexts] = createSignal<KeptText[]>(loaded.kept)
/** 저장 공간이 모자라 보관하지 못하고 메모리에만 들고 있는 읽지 못한 원문 */
const [inPlaceText, setInPlaceText] = createSignal<string | null>(loaded.inPlace)

/**
 * 자동 저장을 멈춘 까닭. 멈춘 동안 바뀐 것은 저장소에 쓰지 않습니다.
 * - unreadable-here: 읽지 못한 원문을 보관하지 못해 원래 자리에만 있음. 받거나 버리기 전까지 덮어쓰지 않음
 * - unreadable-other-tab: 다른 탭이 이 탭이 읽지 못하는 형식(더 새 버전 등)으로 저장함. 그 작업을 덮어쓰지 않음
 */
export type SavePause = 'unreadable-here' | 'unreadable-other-tab'
const [pause, setPause] = createSignal<SavePause | null>(
  loaded.inPlace !== null ? 'unreadable-here' : null,
)

const past: FontProject[] = []
const future: FontProject[] = []
let lastCoalesce: { key: string; at: number } | null = null
let saveTimer: ReturnType<typeof setTimeout> | undefined
/** 이 탭이 마지막으로 쓰거나 받아 맞춘 저장 원문 (다른 탭의 지난 이벤트를 거르는 기준) */
let lastSeen: string | null = loaded.text
/**
 * 아직 저장소에 쓰지 못한 이 탭의 변경이 있는지(저장을 기다리는 중이거나 저장이 실패함).
 * 있으면 다른 탭의 저장을 받아도 이 탭의 작업을 덮어쓰지 않습니다.
 */
let dirty = false

// 되돌리기용 복사본은 추적하지 않고 그 순간의 값을 뜹니다.
const snapshot = (): FontProject => structuredClone(unwrap(project))

/**
 * 쓰기 바로 전에 저장된 값을 확인합니다. 이 탭이 본 적 없는 읽지 못하는 원문(다른 탭의 더 새 형식 등)이 있으면,
 * storage 이벤트가 아직 오지 않았더라도 덮어쓰지 않고 멈춥니다. 쓸 수 있으면 true
 */
function canOverwrite(): boolean {
  const current = readSavedText(storage)
  if (current === null || current === lastSeen) return true
  try {
    parseSaved(current)
    return true
  } catch {
    lastSeen = current
    setPause('unreadable-other-tab')
    return false
  }
}

function saveNow(): void {
  clearTimeout(saveTimer)
  saveTimer = undefined
  if (pause() || !canOverwrite()) return
  const text = serializeProject(unwrap(project))
  const outcome = writeSaved(storage, text)
  if (outcome === 'ok') {
    lastSeen = text
    dirty = false
  }
  setSaveFailure(outcome === 'ok' ? null : outcome)
}

function scheduleSave(): void {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(saveNow, SAVE_DELAY_MS)
}

/**
 * 기다리는 저장(또는 실패한 저장)이 있으면 바로 씁니다 (탭을 닫거나 새로 고치기 직전).
 * 이 탭의 변경이 모두 저장소에 있으면 true. 저장에 실패했거나 저장을 멈춘 동안 고친 것이 있으면 false.
 */
export function flushProjectSave(): boolean {
  if (saveTimer !== undefined || dirty) saveNow()
  return !dirty
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
  dirty = true
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

/**
 * 보관하지 못한 읽지 못한 원문의 상태.
 * paused: 원래 자리에만 있어 버리기 전까지 자동 저장을 멈춤,
 * memory: 다른 탭이 원래 자리를 덮어써 이 탭에서만 받을 수 있음(닫으면 사라짐), null: 없음
 */
export function inPlaceUnreadableState(): 'paused' | 'memory' | null {
  if (inPlaceText() === null) return null
  return pause() === 'unreadable-here' ? 'paused' : 'memory'
}

/** 다른 탭이 읽지 못하는 형식으로 저장해, 그것을 덮어쓰지 않으려고 이 탭의 자동 저장을 멈췄는지 */
export const projectSavePausedByOtherTab = () => pause() === 'unreadable-other-tab'

function releaseInPlace(): void {
  // 사용자가 버린 원문이므로 이제 덮어써도 됩니다(쓰기 전 확인이 다시 멈추지 않게 본 것으로 적음).
  const text = inPlaceText()
  if (text !== null) lastSeen = text
  setInPlaceText(null)
  if (pause() === 'unreadable-here') {
    setPause(null)
    // 멈춰 있던 동안의 변경을 바로 씁니다.
    saveNow()
  }
}

/**
 * 이 탭이 보관하지 못해 붙잡고 있던 원문을 다른 탭이 보관했으면(같은 원문) 놓습니다.
 * 원문은 보관 열쇠에 남으므로, 원래 자리를 지키려던 멈춤도 풀고 새로 고침을 막지 않습니다.
 */
function releaseInPlaceIfKept(): void {
  const text = inPlaceText()
  if (text !== null && keptTexts().some((entry) => entry.text === text)) releaseInPlace()
}

/** 보관 열쇠에 둔 읽지 못한 원문들 (보관한 차례대로) */
export const keptUnreadableTexts = keptTexts

/** 보관하지 못하고 이 탭에만 있는 읽지 못한 원문 */
export const inPlaceUnreadableText = inPlaceText

/**
 * 화면에 보여 준 보관 원문을 지웁니다. 그사이 다른 탭이 더한 원문은 남겨 다시 보여 줍니다.
 * 지운 원문이 아직 원래 자리에 있으면(편집 없이 지운 경우) 지금 작업으로 바로 써서, 새로 고쳐도 다시 보관되지 않게 합니다.
 */
export function discardKeptUnreadable(): void {
  const shown = keptTexts()
  setKeptTexts(
    removeKept(
      storage,
      shown.map((entry) => entry.key),
    ),
  )
  const current = readSavedText(storage)
  if (current !== null && shown.some((entry) => entry.text === current)) saveNow()
}

/**
 * 보관하지 못한 원문을 버리고 자동 저장을 다시 켭니다.
 * 받기만으로는 놓지 않습니다(브라우저가 내려받기를 막아도 알 수 없으므로, 사용자가 받은 것을 확인하고 버림).
 */
export function discardInPlaceUnreadable(): void {
  releaseInPlace()
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
 * 이 탭은 다시 저장하지 않습니다(이미 같은 값).
 * 읽지 못하는 저장(더 새 버전의 형식 등)이면 맞추지 않고, 그 작업을 덮어쓰지 않도록 이 탭의 자동 저장을 멈춥니다.
 */
export function adoptSavedProject(text: string | null): boolean {
  if (text === null) return false
  let next: FontProject
  try {
    next = parseSaved(text)
  } catch {
    clearTimeout(saveTimer)
    saveTimer = undefined
    lastSeen = text
    setPause('unreadable-other-tab')
    return false
  }
  batch(() => {
    clearTimeout(saveTimer)
    saveTimer = undefined
    lastSeen = text
    dirty = false
    // 다른 탭이 이미 원래 자리를 덮어썼으므로 이 탭이 저장을 멈춰 둘 까닭이 없습니다(원문은 화면에서 계속 받을 수 있음).
    setPause(null)
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
 * 다른 탭이 저장한 것을 받습니다.
 * 이 탭에 아직 저장소에 쓰지 못한 변경(0.4초 기다리는 중이거나 저장이 실패함)이 있으면 그것이 가장 나중의 편집이므로,
 * 맞추지 않고 바로 써서 다른 탭이 이 저장을 받아 맞추게 합니다(지금 보고 있는 탭의 방금 고친 것이 사라지지 않게).
 * 다시 써도 실패하면 이 탭의 작업을 메모리에 그대로 두고 실패 알림을 유지합니다.
 * 다만 다른 탭의 저장을 읽지 못하면(더 새 형식) 덮어쓰지 않도록 쓰지 않고 멈춥니다.
 */
export function receiveOtherTabSave(text: string | null): void {
  if (text === null) return
  let readable = true
  try {
    parseSaved(text)
  } catch {
    readable = false
  }
  if (!readable) {
    adoptSavedProject(text)
    return
  }
  // 다른 탭이 읽을 수 있는 작업을 썼으므로, 원래 자리(읽지 못한 원문이나 새 형식)를 지키려고 멈춰 둘 까닭이 없습니다.
  // 멈춘 동안 고친 것도 아직 쓰지 못한 변경이므로 맞추기 전에 먼저 씁니다.
  if (pause()) setPause(null)
  // 이 값을 본 것으로 적어 둡니다. 다시 써 보다 실패해도, 그 뒤 읽지 못하는 저장이 또 오면 새 변화로 알아봅니다.
  lastSeen = text
  if (dirty) {
    saveNow()
    return
  }
  adoptSavedProject(text)
}

/**
 * 탭 사이 맞추기와 닫기 직전 저장을 켭니다. 앱을 시작할 때 한 번 부르고, 끌 함수를 돌려줍니다.
 * storage 이벤트는 저장한 탭이 아닌 다른 탭에만 옵니다.
 */
export function startProjectSync(): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.storageArea && event.storageArea !== storage) return
    // 다른 탭이 읽지 못한 원문을 보관하거나 지우면 이 탭의 목록도 맞춥니다(clear()면 key가 null).
    if (event.key === null || event.key.startsWith(UNREADABLE_PREFIX)) {
      setKeptTexts(readKept(storage))
      releaseInPlaceIfKept()
    }
    if (event.key === STORAGE_KEY) receiveOtherTabSave(storageChangeToAdopt())
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
  options: {
    storage?: Storage
    kept?: KeptText[]
    inPlace?: string | null
    /** 이 탭이 이미 본 저장 원문 (loadSaved의 text) */
    seen?: string | null
  } = {},
): void {
  clearTimeout(saveTimer)
  saveTimer = undefined
  storage = options.storage ?? projectStorage()
  lastSeen = options.seen ?? null
  dirty = false
  setProject(reconcile(structuredClone(next)))
  clearHistory()
  setSaveFailure(null)
  setSyncedAt(0)
  setKeptTexts(options.kept ?? [])
  setInPlaceText(options.inPlace ?? null)
  setPause((options.inPlace ?? null) !== null ? 'unreadable-here' : null)
}
