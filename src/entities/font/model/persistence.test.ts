import { describe, expect, it } from 'vitest'
import {
  STORAGE_KEY,
  UNREADABLE_PREFIX,
  loadSaved,
  readKept,
  readSavedText,
  removeKept,
  serializeProject,
  writeSaved,
} from './persistence.ts'
import { createPresetProject } from './preset.ts'

/** 메모리 저장소. full이면 쓰기마다 저장 공간 초과 예외를 던집니다. */
function memoryStorage(initial: Record<string, string> = {}, full = false): Storage {
  const data = new Map(Object.entries(initial))
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => {
      if (full) throw new DOMException('저장 공간 초과', 'QuotaExceededError')
      data.set(key, value)
    },
  }
}

const preset = () => serializeProject(createPresetProject())
const texts = (storage: Storage) => readKept(storage).map((entry) => entry.text)

describe('자동 저장 읽기·쓰기', () => {
  it('저장한 프로젝트와 그 원문을 그대로 읽습니다', () => {
    const storage = memoryStorage()
    const project = createPresetProject()
    project.style.weight = 120
    const text = serializeProject(project)
    expect(writeSaved(storage, text)).toBe('ok')
    const loaded = loadSaved(storage)
    expect(loaded.project?.style.weight).toBe(120)
    expect(loaded.text).toBe(text)
    expect(loaded.kept).toEqual([])
    expect(loaded.inPlace).toBeNull()
    expect(readSavedText(storage)).toBe(text)
  })

  it('읽지 못한 저장은 새 보관 열쇠에 복사하고, 원래 자리는 비우지 않습니다', () => {
    const text = JSON.stringify({ format: 'luminous-kr', version: 99 })
    const storage = memoryStorage({ [STORAGE_KEY]: text })
    const loaded = loadSaved(storage)
    expect(loaded.project).toBeNull()
    expect(loaded.inPlace).toBeNull()
    expect(loaded.kept.map((entry) => entry.text)).toEqual([text])
    expect(loaded.kept[0]!.key.startsWith(UNREADABLE_PREFIX)).toBe(true)
    // 그사이 다른 탭이 썼을 수 있는 새 작업을 지우지 않도록 원래 자리는 그대로 둡니다.
    expect(storage.getItem(STORAGE_KEY)).toBe(text)
    // 다시 읽어도 같은 원문은 한 번만 보관합니다.
    expect(loadSaved(storage).kept).toHaveLength(1)

    // 다음 저장이 원래 자리를 덮어써도 보관한 원문은 남습니다.
    writeSaved(storage, preset())
    const again = loadSaved(storage)
    expect(again.project).not.toBeNull()
    expect(again.kept.map((entry) => entry.text)).toEqual([text])
    expect(removeKept(storage, [again.kept[0]!.key])).toEqual([])
    expect(loadSaved(storage).kept).toEqual([])
  })

  it('이미 보관한 원문이 있을 때 또 읽지 못한 원문이 생기면 따로 보관합니다', () => {
    const first = '{"format":"luminous-kr","version":7}'
    const second = '{"format":"luminous-kr","version":8}'
    const storage = memoryStorage({ [STORAGE_KEY]: first })
    loadSaved(storage)
    storage.setItem(STORAGE_KEY, second)
    expect(loadSaved(storage).kept.map((entry) => entry.text)).toEqual([first, second])
    expect(texts(storage)).toEqual([first, second])
  })

  it('보여 준 원문의 열쇠만 지워, 그사이 다른 탭이 보관한 원문은 남깁니다', () => {
    const storage = memoryStorage({ [STORAGE_KEY]: '{A' })
    const shown = loadSaved(storage).kept
    // 다른 탭이 원문을 하나 더 보관합니다.
    storage.setItem(`${UNREADABLE_PREFIX}zzzzzzzzzz-other`, '{B')
    const remaining = removeKept(
      storage,
      shown.map((entry) => entry.key),
    )
    expect(remaining.map((entry) => entry.text)).toEqual(['{B'])
    expect(texts(storage)).toEqual(['{B'])
  })

  it('보관할 공간이 없으면 원래 자리에 두고(inPlace) 앞의 보관도 그대로 둡니다', () => {
    const storage = memoryStorage(
      { [STORAGE_KEY]: '{깨진 JSON', [`${UNREADABLE_PREFIX}1`]: '앞의 원문' },
      true,
    )
    const loaded = loadSaved(storage)
    expect(loaded.project).toBeNull()
    expect(loaded.inPlace).toBe('{깨진 JSON')
    expect(loaded.kept.map((entry) => entry.text)).toEqual(['앞의 원문'])
    expect(storage.getItem(STORAGE_KEY)).toBe('{깨진 JSON')
  })

  it('저장 공간이 가득 차면 quota, 저장소가 없으면 unavailable을 돌려줍니다(예외 없음)', () => {
    expect(writeSaved(memoryStorage({}, true), preset())).toBe('quota')
    expect(writeSaved(undefined, preset())).toBe('unavailable')
    const blocked = memoryStorage()
    blocked.setItem = () => {
      throw new DOMException('막힘', 'SecurityError')
    }
    expect(writeSaved(blocked, preset())).toBe('unavailable')
  })

  it('저장소에 접근하지 못하면 아무것도 읽지 않습니다', () => {
    const broken = memoryStorage()
    broken.getItem = () => {
      throw new DOMException('막힘', 'SecurityError')
    }
    expect(loadSaved(broken)).toMatchObject({ project: null, kept: [], inPlace: null })
    expect(loadSaved(undefined)).toMatchObject({ project: null, kept: [], inPlace: null })
    expect(readSavedText(broken)).toBeNull()
  })
})
