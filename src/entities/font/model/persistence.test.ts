import { describe, expect, it } from 'vitest'
import {
  STORAGE_KEY,
  UNREADABLE_KEY,
  loadSaved,
  parseKept,
  readSavedText,
  removeUnreadable,
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

  it('읽지 못한 저장은 덮어쓰기 전에 보관 열쇠로 옮기고 원문을 돌려줍니다', () => {
    const text = JSON.stringify({ format: 'luminous-kr', version: 99 })
    const storage = memoryStorage({ [STORAGE_KEY]: text })
    const loaded = loadSaved(storage)
    expect(loaded).toMatchObject({ project: null, kept: [text], inPlace: null })
    expect(parseKept(storage.getItem(UNREADABLE_KEY))).toEqual([text])
    expect(storage.getItem(STORAGE_KEY)).toBeNull()

    // 다음 방문에도 보관한 원문을 알립니다(새 작업은 그대로 읽음).
    writeSaved(storage, preset())
    const again = loadSaved(storage)
    expect(again.project).not.toBeNull()
    expect(again.kept).toEqual([text])
    removeUnreadable(storage)
    expect(loadSaved(storage).kept).toEqual([])
  })

  it('이미 보관한 원문이 있을 때 또 읽지 못한 원문이 생기면 앞의 것을 덮어쓰지 않고 목록에 더합니다', () => {
    const first = '{"format":"luminous-kr","version":7}'
    const second = '{"format":"luminous-kr","version":8}'
    const storage = memoryStorage({ [STORAGE_KEY]: first })
    loadSaved(storage)
    storage.setItem(STORAGE_KEY, second)
    expect(loadSaved(storage).kept).toEqual([first, second])
    // 같은 원문은 두 번 넣지 않습니다.
    storage.setItem(STORAGE_KEY, second)
    expect(loadSaved(storage).kept).toEqual([first, second])
    expect(parseKept(storage.getItem(UNREADABLE_KEY))).toEqual([first, second])
  })

  it('보관 열쇠의 값이 목록이 아니면(이전 형식) 원문 하나로 읽습니다', () => {
    expect(parseKept('{"format":"luminous-kr"}')).toEqual(['{"format":"luminous-kr"}'])
    expect(parseKept('["a","b"]')).toEqual(['a', 'b'])
    expect(parseKept('[1,2]')).toEqual(['[1,2]'])
    expect(parseKept(null)).toEqual([])
  })

  it('보관할 공간이 없으면 원래 자리에 두고(inPlace) 앞의 보관도 그대로 둡니다', () => {
    const storage = memoryStorage(
      {
        [STORAGE_KEY]: '{깨진 JSON',
        [UNREADABLE_KEY]: JSON.stringify(['앞의 원문']),
      },
      true,
    )
    const loaded = loadSaved(storage)
    expect(loaded).toMatchObject({ project: null, kept: ['앞의 원문'], inPlace: '{깨진 JSON' })
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
