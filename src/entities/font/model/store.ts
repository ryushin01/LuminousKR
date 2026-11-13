import { batch, createSignal } from 'solid-js'
import { createStore, produce, reconcile, unwrap } from 'solid-js/store'
import { createPresetProject } from './preset.ts'
import type { FontProject } from './types.ts'
import { normalizeProject } from './validate.ts'

const STORAGE_KEY = 'luminous-kr:project:v1'
const HISTORY_LIMIT = 80
/** 같은 묶음 이름으로 이 시간 안에 이어진 변경은 되돌리기 한 번으로 묶습니다 (슬라이더 끌기 등). */
const COALESCE_MS = 900

function readSaved(): FontProject | null {
  try {
    const text = globalThis.localStorage?.getItem(STORAGE_KEY)
    return text ? normalizeProject(JSON.parse(text)) : null
  } catch {
    return null
  }
}

const [project, setProject] = createStore<FontProject>(readSaved() ?? createPresetProject())
const [revision, setRevision] = createSignal(0)
const [pastSize, setPastSize] = createSignal(0)
const [futureSize, setFutureSize] = createSignal(0)

const past: FontProject[] = []
const future: FontProject[] = []
let lastCoalesce: { key: string; at: number } | null = null
let saveTimer: ReturnType<typeof setTimeout> | undefined

// 되돌리기용 복사본은 추적하지 않고 그 순간의 값을 뜹니다.
const snapshot = (): FontProject => structuredClone(unwrap(project))

function scheduleSave(): void {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(unwrap(project)))
    } catch {
      // 저장 공간이 없거나 막혀 있으면 이번 세션 안에서만 유지합니다.
    }
  }, 400)
}

function syncHistorySignals(): void {
  setPastSize(past.length)
  setFutureSize(future.length)
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

/** 테스트용: 저장소를 기본 프리셋으로 되돌리고 기록을 비웁니다. */
export function resetProjectStoreForTest(next: FontProject = createPresetProject()): void {
  past.length = 0
  future.length = 0
  lastCoalesce = null
  setProject(reconcile(structuredClone(next)))
  syncHistorySignals()
}
