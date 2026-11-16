import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEY } from './persistence.ts'
import { createPresetProject } from './preset.ts'
import {
  adoptSavedProject,
  canRedo,
  canUndo,
  editProject,
  flushProjectSave,
  fontProject,
  projectRevision,
  projectSaveFailure,
  projectSyncedAt,
  redo,
  replaceProject,
  resetProjectStoreForTest,
  startProjectSync,
  undo,
  discardInPlaceUnreadable,
  discardKeptUnreadable,
  inPlaceUnreadableState,
  inPlaceUnreadableText,
  keptUnreadableTexts,
  projectSavePausedByOtherTab,
  receiveOtherTabSave,
} from './store.ts'
import {
  MAX_POINTS_PER_STROKE,
  MAX_STROKES_PER_DRAWING,
  ProjectFormatError,
  drawingLimitError,
  normalizeProject,
  parseProjectJson,
} from './validate.ts'

describe('프로젝트 저장소와 되돌리기', () => {
  beforeEach(() => resetProjectStoreForTest())

  it('고친 것을 되돌리고 다시 합니다', () => {
    editProject((d) => void (d.style.weight = 120))
    expect(fontProject.style.weight).toBe(120)
    expect(canUndo()).toBe(true)
    undo()
    expect(fontProject.style.weight).toBe(76)
    expect(canRedo()).toBe(true)
    redo()
    expect(fontProject.style.weight).toBe(120)
  })

  it('같은 이름의 연속 변경(슬라이더 끌기)은 되돌리기 한 번으로 묶습니다', () => {
    for (const weight of [80, 90, 100, 110]) {
      editProject((d) => void (d.style.weight = weight), { coalesce: 'weight' })
    }
    undo()
    expect(fontProject.style.weight).toBe(76)
    expect(canUndo()).toBe(false)
  })

  it('기본 글꼴로 바꾸면 이전 편집(획·배치 변형·굵기·이름·틀)이 하나도 남지 않습니다', () => {
    editProject((d) => {
      d.style.weight = 150
      d.jamo.L0!.base!.strokes.push({
        id: 'extra',
        kind: 'path',
        points: [{ x: 0.1, y: 0.1 }],
        closed: false,
        smooth: false,
      })
      d.jamo.L0!.variants = { B: { strokes: [] } }
      d.jamo.L1 = { base: { strokes: [] } }
      d.meta.familyName = 'Changed'
      d.layouts.A.L.x1 = 0.7
    })
    replaceProject(createPresetProject())
    expect(JSON.parse(JSON.stringify(fontProject))).toEqual(createPresetProject())
  })

  it('프로젝트를 통째로 바꾼 것도 되돌릴 수 있습니다', () => {
    replaceProject({ ...createPresetProject(), name: '다른 글꼴', jamo: {} })
    expect(fontProject.name).toBe('다른 글꼴')
    undo()
    expect(fontProject.name).toBe('루미너스 기본')
  })
})

/** 쓰기를 기록하는 메모리 저장소. full이면 쓰기마다 저장 공간 초과 예외를 던집니다. */
function memoryStorage(full = false) {
  const data = new Map<string, string>()
  const storage = {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => void data.delete(key),
    setItem: (key: string, value: string) => {
      if (storage.full) throw new DOMException('저장 공간 초과', 'QuotaExceededError')
      data.set(key, value)
    },
    full,
  }
  return storage
}

const keptTexts = () => keptUnreadableTexts().map((entry) => entry.text)

const savedWeight = (storage: Storage) =>
  (JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null') as { style: { weight: number } } | null)
    ?.style.weight

describe('자동 저장과 탭 사이 맞추기', () => {
  afterEach(() => {
    vi.useRealTimers()
    resetProjectStoreForTest()
  })

  it('바뀐 뒤 0.4초 동안 더 바뀌지 않으면 저장하고, 탭을 닫기 직전에는 기다리지 않고 저장합니다', () => {
    vi.useFakeTimers()
    const storage = memoryStorage()
    resetProjectStoreForTest(createPresetProject(), { storage })
    const stop = startProjectSync()
    editProject((d) => void (d.style.weight = 90))
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
    vi.advanceTimersByTime(400)
    expect(savedWeight(storage)).toBe(90)

    editProject((d) => void (d.style.weight = 100))
    window.dispatchEvent(new Event('pagehide'))
    expect(savedWeight(storage)).toBe(100)
    stop()
  })

  it('저장 공간이 모자라 실패하면 까닭을 알리고, 다음 저장이 성공하면 거둡니다', () => {
    vi.useFakeTimers()
    const storage = memoryStorage(true)
    resetProjectStoreForTest(createPresetProject(), { storage })
    editProject((d) => void (d.style.weight = 90))
    flushProjectSave()
    expect(projectSaveFailure()).toBe('quota')
    storage.full = false
    editProject((d) => void (d.style.weight = 95))
    flushProjectSave()
    expect(projectSaveFailure()).toBeNull()
    expect(savedWeight(storage)).toBe(95)
  })

  it('다른 탭이 저장하면 이 탭을 그 작업으로 맞추고 되돌리기 기록을 비웁니다', () => {
    const storage = memoryStorage()
    resetProjectStoreForTest(createPresetProject(), { storage })
    const stop = startProjectSync()
    editProject((d) => void (d.style.weight = 90))
    flushProjectSave()
    expect(canUndo()).toBe(true)
    const revision = projectRevision()

    const other = createPresetProject()
    other.jamo.L0!.base!.strokes.push({
      id: 'from-other-tab',
      kind: 'path',
      points: [{ x: 0.2, y: 0.2 }],
      closed: false,
      smooth: false,
    })
    // 다른 탭이 저장소에 쓰고 이벤트가 옵니다.
    const text = JSON.stringify(other)
    storage.setItem(STORAGE_KEY, text)
    const writes = vi.spyOn(storage, 'setItem')
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: text }))
    expect(fontProject.style.weight).toBe(76)
    expect(fontProject.jamo.L0!.base!.strokes.map((s) => s.id)).toContain('from-other-tab')
    expect(canUndo()).toBe(false)
    expect(projectRevision()).toBeGreaterThan(revision)
    expect(projectSyncedAt()).toBeGreaterThan(0)
    // 받은 작업을 이 탭이 다시 쓰지 않습니다(같은 값을 서로 주고받지 않게).
    flushProjectSave()
    expect(writes).not.toHaveBeenCalled()
    stop()
  })

  it('늦게 도착한 지난 이벤트는 이벤트 값이 아니라 지금 저장된 값으로 판단합니다', () => {
    vi.useFakeTimers()
    const storage = memoryStorage()
    resetProjectStoreForTest(createPresetProject(), { storage })
    const stop = startProjectSync()
    const older = createPresetProject()
    older.style.weight = 90
    // 이 탭이 140을 저장한 뒤, 다른 탭이 그보다 먼저 저장했던 90의 이벤트가 늦게 옵니다.
    editProject((d) => void (d.style.weight = 140))
    flushProjectSave()
    window.dispatchEvent(
      new StorageEvent('storage', { key: STORAGE_KEY, newValue: JSON.stringify(older) }),
    )
    expect(fontProject.style.weight).toBe(140)
    expect(projectSyncedAt()).toBe(0)

    // 다른 탭이 두 번 저장했는데 첫 이벤트가 이제 오면, 지금 저장된(나중) 값으로 맞춥니다.
    const newer = createPresetProject()
    newer.style.weight = 160
    storage.setItem(STORAGE_KEY, JSON.stringify(newer))
    window.dispatchEvent(
      new StorageEvent('storage', { key: STORAGE_KEY, newValue: JSON.stringify(older) }),
    )
    expect(fontProject.style.weight).toBe(160)
    // 같은 값의 이벤트가 또 와도 다시 맞추지 않습니다.
    const syncedAt = projectSyncedAt()
    vi.advanceTimersByTime(10)
    window.dispatchEvent(
      new StorageEvent('storage', { key: STORAGE_KEY, newValue: JSON.stringify(newer) }),
    )
    expect(projectSyncedAt()).toBe(syncedAt)
    stop()
  })

  it('읽지 못한 원문을 보관하지 못했으면, 버리기 전까지 자동 저장이 덮어쓰지 않습니다', () => {
    const storage = memoryStorage()
    storage.setItem(STORAGE_KEY, '{원래 작업')
    resetProjectStoreForTest(createPresetProject(), { storage, inPlace: '{원래 작업' })
    expect(inPlaceUnreadableState()).toBe('paused')
    editProject((d) => void (d.style.weight = 90))
    flushProjectSave()
    expect(storage.getItem(STORAGE_KEY)).toBe('{원래 작업')

    // 버리면(사용자가 받은 것을 확인한 뒤) 멈춰 있던 변경을 바로 씁니다.
    discardInPlaceUnreadable()
    expect(inPlaceUnreadableText()).toBeNull()
    expect(savedWeight(storage)).toBe(90)
  })

  it('보관한 원문은 지울 때까지 남고, 지우면 보관 열쇠까지 지웁니다', () => {
    const storage = memoryStorage()
    const key = `${STORAGE_KEY}:unreadable:1`
    storage.setItem(key, '{보관')
    resetProjectStoreForTest(createPresetProject(), { storage, kept: [{ key, text: '{보관' }] })
    expect(keptTexts()).toEqual(['{보관'])
    discardKeptUnreadable()
    expect(keptTexts()).toEqual([])
    expect(storage.getItem(key)).toBeNull()
  })

  it('다른 탭이 원문을 더 보관하면 목록을 맞추고, 지울 때는 보여 준 것만 지웁니다', () => {
    const storage = memoryStorage()
    const a = `${STORAGE_KEY}:unreadable:1`
    storage.setItem(a, '{A')
    resetProjectStoreForTest(createPresetProject(), { storage, kept: [{ key: a, text: '{A' }] })
    const stop = startProjectSync()
    // 이 탭은 {A만 보여 주고 있는데, 다른 탭이 {B를 더 보관합니다(이벤트가 오기 전에 지우기).
    storage.setItem(`${STORAGE_KEY}:unreadable:2`, '{B')
    discardKeptUnreadable()
    expect(keptTexts()).toEqual(['{B'])
    // 이벤트로 목록을 맞춥니다.
    const c = `${STORAGE_KEY}:unreadable:3`
    storage.setItem(c, '{C')
    window.dispatchEvent(new StorageEvent('storage', { key: c }))
    expect(keptTexts()).toEqual(['{B', '{C'])
    stop()
  })

  it('저장이 실패한 채 읽을 수 있는 저장을 받은 뒤 읽지 못하는 저장이 또 오면, 다시 멈춥니다', () => {
    const storage = memoryStorage()
    resetProjectStoreForTest(createPresetProject(), { storage })
    const stop = startProjectSync()
    const unreadable = JSON.stringify({ format: 'luminous-kr', version: 2 })
    const readable = JSON.stringify({ ...createPresetProject(), name: '다른 탭' })
    const send = (text: string) => {
      storage.full = false
      storage.setItem(STORAGE_KEY, text)
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
    }
    send(unreadable) // U: 멈춤
    expect(projectSavePausedByOtherTab()).toBe(true)
    editProject((d) => void (d.style.weight = 99))
    storage.full = true
    storage.setItem = ((original) =>
      function (this: Storage, key: string, value: string) {
        if (storage.full && key === STORAGE_KEY)
          throw new DOMException('가득 참', 'QuotaExceededError')
        return original.call(this, key, value)
      })(storage.setItem)
    // R: 멈춤을 풀고 이 탭의 편집을 써 보지만 실패합니다.
    storage.full = false
    storage.setItem(STORAGE_KEY, readable)
    storage.full = true
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
    expect(projectSavePausedByOtherTab()).toBe(false)
    expect(projectSaveFailure()).toBe('quota')
    // U가 또 오면 새 변화로 알아보고 다시 멈춰, 그 뒤의 저장이 덮어쓰지 않습니다.
    send(unreadable)
    expect(projectSavePausedByOtherTab()).toBe(true)
    editProject((d) => void (d.style.weight = 98))
    flushProjectSave()
    expect(storage.getItem(STORAGE_KEY)).toBe(unreadable)
    stop()
  })

  it('저장이 멈춘 동안 고친 것은, 다른 탭의 읽을 수 있는 저장을 받으면 멈춤을 풀고 먼저 씁니다', () => {
    const storage = memoryStorage()
    resetProjectStoreForTest(createPresetProject(), { storage })
    const newer = JSON.stringify({ format: 'luminous-kr', version: 2 })
    storage.setItem(STORAGE_KEY, newer)
    adoptSavedProject(newer)
    expect(projectSavePausedByOtherTab()).toBe(true)
    editProject((d) => void (d.style.weight = 101))
    flushProjectSave()
    expect(storage.getItem(STORAGE_KEY)).toBe(newer)

    const readable = createPresetProject()
    readable.style.weight = 150
    const text = JSON.stringify(readable)
    storage.setItem(STORAGE_KEY, text)
    receiveOtherTabSave(text)
    expect(projectSavePausedByOtherTab()).toBe(false)
    expect(fontProject.style.weight).toBe(101)
    expect(savedWeight(storage)).toBe(101)
  })

  it('저장이 실패한 변경은 다른 탭의 저장을 받아도 덮어쓰지 않고, 다시 써 봅니다', () => {
    const storage = memoryStorage(true)
    resetProjectStoreForTest(createPresetProject(), { storage })
    editProject((d) => void (d.style.weight = 111))
    flushProjectSave()
    expect(projectSaveFailure()).toBe('quota')

    // 다른 탭은 더 작은 작업을 저장할 수 있었습니다.
    const other = createPresetProject()
    other.style.weight = 140
    const text = JSON.stringify(other)
    storage.full = false
    storage.setItem(STORAGE_KEY, text)
    storage.full = true
    receiveOtherTabSave(text)
    // 다시 써도 실패하면 이 탭의 작업을 그대로 두고 실패 알림을 유지합니다.
    expect(fontProject.style.weight).toBe(111)
    expect(projectSaveFailure()).toBe('quota')
    expect(savedWeight(storage)).toBe(140)

    // 공간이 생기면 다음에 받을 때 이 탭의 작업을 씁니다.
    storage.full = false
    receiveOtherTabSave(text)
    expect(savedWeight(storage)).toBe(111)
    expect(projectSaveFailure()).toBeNull()
  })

  it('이 탭이 기다리던 저장은 다른 탭의 저장을 받으면 버립니다(받은 작업을 덮어쓰지 않게)', () => {
    vi.useFakeTimers()
    const storage = memoryStorage()
    resetProjectStoreForTest(createPresetProject(), { storage })
    editProject((d) => void (d.style.weight = 90))
    const other = createPresetProject()
    other.style.weight = 140
    adoptSavedProject(JSON.stringify(other))
    vi.advanceTimersByTime(1000)
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
    expect(fontProject.style.weight).toBe(140)
  })

  it('다른 탭이 읽지 못하는 형식(더 새 버전)으로 저장하면 맞추지 않고, 덮어쓰지 않도록 저장을 멈춥니다', () => {
    const storage = memoryStorage()
    resetProjectStoreForTest(createPresetProject(), { storage })
    editProject((d) => void (d.style.weight = 90))
    expect(adoptSavedProject(null)).toBe(false)
    expect(projectSavePausedByOtherTab()).toBe(false)

    const newer = JSON.stringify({ format: 'luminous-kr', version: 2 })
    storage.setItem(STORAGE_KEY, newer)
    expect(adoptSavedProject(newer)).toBe(false)
    expect(fontProject.style.weight).toBe(90)
    expect(canUndo()).toBe(true)
    expect(projectSyncedAt()).toBe(0)
    expect(projectSavePausedByOtherTab()).toBe(true)
    // 이 탭에서 더 고쳐도 다른 탭의 새 형식 저장을 덮어쓰지 않습니다.
    editProject((d) => void (d.style.weight = 95))
    flushProjectSave()
    expect(storage.getItem(STORAGE_KEY)).toBe(newer)

    // 다른 탭이 다시 읽을 수 있는 작업을 저장하면 맞추고 저장을 다시 켭니다.
    const readable = createPresetProject()
    readable.style.weight = 130
    adoptSavedProject(JSON.stringify(readable))
    expect(projectSavePausedByOtherTab()).toBe(false)
    expect(fontProject.style.weight).toBe(130)
  })

  it('이 탭에 저장을 기다리는 편집이 있으면, 다른 탭의 저장을 받아도 맞추지 않고 이 편집을 바로 씁니다', () => {
    vi.useFakeTimers()
    const storage = memoryStorage()
    resetProjectStoreForTest(createPresetProject(), { storage })
    editProject((d) => void (d.style.weight = 111))
    const other = createPresetProject()
    other.style.weight = 140
    const text = JSON.stringify(other)
    storage.setItem(STORAGE_KEY, text)
    receiveOtherTabSave(text)
    expect(fontProject.style.weight).toBe(111)
    expect(savedWeight(storage)).toBe(111)
    expect(projectSyncedAt()).toBe(0)
    // 기다리던 편집이 없으면 그대로 맞춥니다.
    storage.setItem(STORAGE_KEY, text)
    receiveOtherTabSave(text)
    expect(fontProject.style.weight).toBe(140)
  })

  it('기다리던 편집이 있어도 다른 탭의 저장을 읽지 못하면(새 형식) 쓰지 않고 멈춥니다', () => {
    vi.useFakeTimers()
    const storage = memoryStorage()
    resetProjectStoreForTest(createPresetProject(), { storage })
    editProject((d) => void (d.style.weight = 111))
    const newer = JSON.stringify({ format: 'luminous-kr', version: 2 })
    storage.setItem(STORAGE_KEY, newer)
    receiveOtherTabSave(newer)
    vi.advanceTimersByTime(1000)
    expect(storage.getItem(STORAGE_KEY)).toBe(newer)
    expect(projectSavePausedByOtherTab()).toBe(true)
  })

  it('보관하지 못한 원문을 다른 탭이 덮어쓰면, 저장은 다시 켜고 원문은 이 탭에서만 받을 수 있다고 알립니다', () => {
    const storage = memoryStorage()
    resetProjectStoreForTest(createPresetProject(), {
      storage,
      kept: [{ key: `${STORAGE_KEY}:unreadable:1`, text: '{먼저 보관한 작업' }],
      inPlace: '{원래 작업',
    })
    expect(inPlaceUnreadableState()).toBe('paused')
    const other = createPresetProject()
    other.style.weight = 120
    adoptSavedProject(JSON.stringify(other))
    expect(inPlaceUnreadableState()).toBe('memory')
    // 먼저 보관한 원문과 이 탭에만 있는 원문을 모두 받을 수 있습니다.
    expect(keptTexts()).toEqual(['{먼저 보관한 작업'])
    expect(inPlaceUnreadableText()).toBe('{원래 작업')
    editProject((d) => void (d.style.weight = 125))
    flushProjectSave()
    expect(savedWeight(storage)).toBe(125)
  })

  it('다른 열쇠의 저장 이벤트는 무시합니다', () => {
    resetProjectStoreForTest(createPresetProject(), { storage: memoryStorage() })
    const stop = startProjectSync()
    const other = createPresetProject()
    other.style.weight = 150
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'other-app:key', newValue: JSON.stringify(other) }),
    )
    expect(fontProject.style.weight).toBe(76)
    stop()
  })
})

describe('프로젝트 파일 검사', () => {
  it('다른 형식의 파일은 원인과 함께 거부합니다', () => {
    expect(() => parseProjectJson('{"hello":1}')).toThrow(ProjectFormatError)
    expect(() => parseProjectJson('not json')).toThrow('JSON')
    expect(() => normalizeProject({ format: 'luminous-kr', version: 9 })).toThrow('판')
  })

  it('획·점이 한도를 넘는 파일은 말없이 자르지 않고 원인과 함께 거부합니다', () => {
    const raw = JSON.parse(JSON.stringify(createPresetProject()))
    const point = { x: 0.5, y: 0.5 }
    raw.jamo.L0.base.strokes = [{ id: 'big', kind: 'path', points: Array(2001).fill(point) }]
    expect(() => normalizeProject(raw)).toThrow('점이 너무 많은 획')
    raw.jamo.L0.base.strokes = Array.from({ length: 301 }, (_, i) => ({
      id: `s${i}`,
      kind: 'path',
      points: [point],
    }))
    expect(() => normalizeProject(raw)).toThrow('획이 너무 많은 자모')
    // 한도 안의 큰 그림은 잘리지 않고 그대로 읽습니다.
    raw.jamo.L0.base.strokes = Array.from({ length: 120 }, (_, i) => ({
      id: `s${i}`,
      kind: 'path',
      points: Array(500).fill(point),
    }))
    const project = normalizeProject(raw)
    expect(project.jamo.L0!.base!.strokes).toHaveLength(120)
    expect(
      project.jamo.L0!.base!.strokes[0]!.kind === 'path' &&
        project.jamo.L0!.base!.strokes[0]!.points,
    ).toHaveLength(500)
  })

  it('넣기 전 검사는 파일 검사와 같은 한도를 씁니다 (한도 안이면 저장한 뒤 다시 열림)', () => {
    const point = { x: 0.5, y: 0.5 }
    const dot = { kind: 'path' as const, points: [point] }
    const atLimit = Array.from({ length: MAX_STROKES_PER_DRAWING }, () => dot)
    expect(drawingLimitError(atLimit)).toBeNull()
    expect(drawingLimitError([...atLimit, dot])).toContain(
      `${MAX_STROKES_PER_DRAWING}개를 넘습니다`,
    )
    const longest = { kind: 'path' as const, points: Array(MAX_POINTS_PER_STROKE).fill(point) }
    expect(drawingLimitError([longest, { kind: 'ellipse' }])).toBeNull()
    expect(drawingLimitError([{ ...longest, points: [...longest.points, point] }])).toContain(
      `${MAX_POINTS_PER_STROKE}개를 넘습니다`,
    )

    // 검사를 통과한 그림은 자동 저장한 뒤 다시 열 수 있습니다.
    const raw = JSON.parse(JSON.stringify(createPresetProject()))
    raw.jamo.L0.base.strokes = atLimit.map((s, i) => ({ ...s, id: `s${i}` }))
    expect(normalizeProject(raw).jamo.L0!.base!.strokes).toHaveLength(MAX_STROKES_PER_DRAWING)
  })

  it('저장한 프로젝트는 그대로 읽고, 범위를 벗어난 값은 바로잡습니다', () => {
    const original = createPresetProject()
    const raw = JSON.parse(JSON.stringify(original))
    raw.style.weight = 999
    raw.style.cap = 'weird'
    raw.jamo.L99 = { base: { strokes: [] } }
    raw.jamo.L0.base.strokes.push({ kind: 'path', points: 'nope' })
    const project = normalizeProject(raw)
    expect(project.style.weight).toBe(200)
    expect(project.style.cap).toBe('round')
    expect(project.jamo).not.toHaveProperty('L99')
    expect(project.jamo.L0!.base!.strokes).toEqual(original.jamo.L0!.base!.strokes)
  })
})
