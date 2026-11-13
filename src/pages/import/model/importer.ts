import { createSignal, onCleanup } from 'solid-js'
import { createStore, produce } from 'solid-js/store'
import {
  type JamoKey,
  bodyFrame,
  drawingLimitError,
  editProject,
  fontProject,
  frameBox,
  homeLayout,
  jamoLabel,
  strokeFromSyllable,
} from '@/entities/font'
import type { RecognizeOptions, RecognizedStroke } from '../lib/recognize.ts'
import {
  ImportFileError,
  MAX_PDF_PAGES,
  type PageSource,
  type ReadResult,
  readPageSources,
} from '../lib/read-files.ts'
import { recognizeSingleImage, recognizeTemplatePage } from '../worker/recognize-client.ts'
import { templateGeometry, templateSet } from './template-sets.ts'

export type SourceState = 'working' | 'done' | 'error'

export type SourceStatus = { id: number; label: string; state: SourceState; message: string }

export type Candidate = {
  id: string
  key: JamoKey
  strokes: RecognizedStroke[]
  penWidth: number
  /** 칸 그림 주소 (object URL) */
  preview: string
  source: string
  /** 올린 순서. 같은 자모는 나중에 올린 파일의 것을 고릅니다. */
  order: number
  selected: boolean
}

type Deps = {
  readPageSources: typeof readPageSources
  recognizeTemplatePage: typeof recognizeTemplatePage
  recognizeSingleImage: typeof recognizeSingleImage
}

const DEFAULT_DEPS: Deps = { readPageSources, recognizeTemplatePage, recognizeSingleImage }

const errorText = (error: unknown) =>
  error instanceof ImportFileError
    ? error.message
    : '파일을 처리하지 못했습니다. 다른 파일로 다시 시도해 주세요.'

/** 워커로 넘기지 않은 그림은 바로 닫아 메모리를 돌려줍니다. */
const closePages = (pages: readonly PageSource[]) => {
  for (const page of pages) page.bitmap.close()
}

/**
 * 가져오기 상태: 올린 파일(쪽)마다 인식 결과를 모으고, 고른 자모를 프로젝트에 적용합니다.
 * - 자모마다 고른 후보는 하나뿐입니다. 적용하는 수와 펜 굵기 평균이 실제로 들어가는 것과 같습니다.
 * - 여러 파일을 겹쳐 올려도, 끝난 순서가 아니라 올린 순서로 같은 자모의 마지막 것을 고릅니다.
 * - 화면을 떠난 뒤 끝난 인식은 버립니다 (미리보기 주소를 새로 만들지 않음).
 * 적용은 되돌리기 한 번으로 취소할 수 있습니다.
 */
export function createImporter(deps: Deps = DEFAULT_DEPS) {
  const [sources, setSources] = createStore<SourceStatus[]>([])
  const [candidates, setCandidates] = createStore<Candidate[]>([])
  const [divisions, setDivisions] = createSignal<number | null>(24)
  const [smooth, setSmooth] = createSignal(false)
  const [announcement, setAnnouncement] = createSignal('')
  const urls: string[] = []
  let seq = 0
  let uploads = 0
  let disposed = false

  onCleanup(() => {
    disposed = true
    urls.forEach((url) => URL.revokeObjectURL(url))
  })

  const options = (): RecognizeOptions => ({ divisions: divisions(), smooth: smooth() })
  const objectUrl = (blob: Blob) => {
    const url = URL.createObjectURL(blob)
    urls.push(url)
    return url
  }

  const startSource = (label: string, message: string) => {
    seq += 1
    const id = seq
    setSources((list) => [...list, { id, label, state: 'working', message }])
    return id
  }

  const setSource = (id: number, state: SourceState, message: string) =>
    setSources((s) => s.id === id, { state, message })

  function addCandidate(candidate: Omit<Candidate, 'id' | 'selected'>) {
    setCandidates(
      produce((list) => {
        // 같은 자모를 더 나중에 올린 결과가 이미 있으면, 늦게 끝난 이것은 고르지 않습니다.
        const newer = list.some((c) => c.key === candidate.key && c.order > candidate.order)
        if (!newer) for (const c of list) if (c.key === candidate.key) c.selected = false
        seq += 1
        list.push({ ...candidate, id: `c${seq}`, selected: !newer })
      }),
    )
  }

  async function readTemplateFile(file: File, order: number): Promise<void> {
    if (disposed) return
    const id = startSource(file.name, '여는 중…')
    let read: ReadResult
    try {
      read = await deps.readPageSources(file)
    } catch (error) {
      if (!disposed) setSource(id, 'error', errorText(error))
      return
    }
    const notes: string[] = []
    let found = 0
    for (const [index, page] of read.pages.entries()) {
      if (disposed) {
        closePages(read.pages.slice(index))
        return
      }
      setSource(id, 'working', `${page.label} 인식 중…`)
      let result
      try {
        result = await deps.recognizeTemplatePage(page.bitmap, templateGeometry(), options())
      } catch {
        // 한 쪽이 실패해도 나머지 쪽과 다음 파일은 계속 읽습니다.
        page.bitmap.close()
        notes.push(
          `${page.label}: 인식하다 멈췄습니다. 그림이 너무 크거나 메모리가 모자랄 수 있으니 해상도를 줄여 다시 올려 주세요.`,
        )
        continue
      }
      // 화면을 떠났으면 결과를 버립니다. 남은 쪽은 다음 바퀴에서 닫습니다.
      if (disposed) continue
      if (!result.ok) {
        notes.push(`${page.label}: ${result.message}`)
        continue
      }
      const skipped: string[] = []
      let accepted = 0
      for (const cell of result.cells) {
        const key = cell.key as JamoKey
        // 한도를 넘는 그림을 넣으면 자동 저장한 작업을 다음에 열 수 없으므로 후보로 받지 않습니다.
        const problem = drawingLimitError(cell.strokes)
        if (problem) {
          skipped.push(
            `${jamoLabel(key)} 칸은 건너뛰었습니다. ${problem} 칸에 잡티나 그림자가 없는지 확인하고 다시 찍어 주세요.`,
          )
          continue
        }
        addCandidate({
          key,
          strokes: cell.strokes,
          penWidth: cell.penWidth,
          preview: objectUrl(cell.preview),
          source: page.label,
          order,
        })
        accepted += 1
      }
      found += accepted
      const name = templateSet(result.setId)?.name ?? '알 수 없는'
      notes.push(
        result.cells.length === 0
          ? `${page.label}: '${name}' 양식을 찾았지만 그린 칸이 없습니다. 칸 안에 진한 펜으로 그렸는지 확인해 주세요.`
          : `${page.label}: '${name}' 양식에서 ${accepted}자를 찾았습니다${
              result.empty.length > 0 ? ` (빈 칸 ${result.empty.length}개)` : ''
            }.`,
        ...skipped,
      )
    }
    if (disposed) return
    if (read.skippedPages > 0) {
      notes.push(
        `${file.name}: 한 번에 ${MAX_PDF_PAGES}쪽까지만 읽어 뒤의 ${read.skippedPages}쪽은 건너뛰었습니다. 나머지는 PDF를 나눠 다시 올려 주세요.`,
      )
    }
    setSource(id, found > 0 ? 'done' : 'error', notes.join(' '))
    setAnnouncement(notes.join(' '))
  }

  /** 양식 사진·PDF를 차례로 읽습니다. 올린 순서는 기다리기 전에 정해 둡니다. */
  async function addTemplateFiles(files: readonly File[]): Promise<void> {
    const orders = files.map(() => ++uploads)
    for (const [i, file] of files.entries()) {
      // 화면을 떠났으면 남은 파일은 열지 않습니다.
      if (disposed) return
      await readTemplateFile(file, orders[i]!)
    }
  }

  /** 양식 없이 그림 한 장을 고른 자모로 읽습니다. PDF는 첫 쪽만 씁니다. */
  async function addSingleFile(file: File, key: JamoKey): Promise<void> {
    const order = ++uploads
    const id = startSource(file.name, '인식 중…')
    const fail = (message: string) => {
      if (disposed) return
      setSource(id, 'error', message)
      setAnnouncement(message)
    }
    let page: PageSource | undefined
    try {
      const { pages, skippedPages } = await deps.readPageSources(file)
      const rest = pages.slice(1)
      page = pages[0]
      closePages(rest)
      if (!page) throw new ImportFileError(`${file.name}: 그림이 없습니다.`)
      if (disposed) {
        page.bitmap.close()
        return
      }
      const frame = frameBox(fontProject.layouts, key, homeLayout(key))
      const result = await deps.recognizeSingleImage(page.bitmap, frame, options())
      if (disposed) return
      if (!result.ok) {
        fail(`${file.name}: ${result.message}`)
        return
      }
      const problem = drawingLimitError(result.strokes)
      if (problem) {
        fail(
          `${file.name}: ${problem} 잡티나 그림자가 없는지 확인하고, 자모만 크게 다시 찍어 주세요.`,
        )
        return
      }
      addCandidate({
        key,
        strokes: result.strokes,
        penWidth: result.penWidth,
        preview: objectUrl(result.preview),
        source: file.name,
        order,
      })
      const firstOnly = rest.length + skippedPages > 0 ? ' PDF는 첫 쪽만 썼습니다.' : ''
      const message = `${file.name}: ${jamoLabel(key)}의 획 ${result.strokes.length}개를 찾았습니다.${firstOnly}`
      setSource(id, 'done', message)
      setAnnouncement(message)
    } catch (error) {
      page?.bitmap.close()
      fail(errorText(error))
    }
  }

  /** 고르면 같은 자모의 다른 후보는 풉니다 (자모마다 하나만 적용). */
  function toggle(id: string, selected: boolean) {
    setCandidates(
      produce((list) => {
        const target = list.find((c) => c.id === id)
        if (!target) return
        if (selected) for (const c of list) if (c.key === target.key) c.selected = false
        target.selected = selected
      }),
    )
  }

  /** 모두 고르기는 자모마다 마지막에 올린 후보 하나씩 고릅니다. */
  function selectAll(selected: boolean) {
    setCandidates(
      produce((list) => {
        const latest = new Map<JamoKey, Candidate>()
        for (const c of list) {
          const best = latest.get(c.key)
          if (!best || c.order >= best.order) latest.set(c.key, c)
        }
        for (const c of list) c.selected = selected && latest.get(c.key) === c
      }),
    )
  }

  const chosen = () => candidates.filter((c) => c.selected)
  const selectedCount = () => chosen().length

  /** 고른 자모를 기본 그림으로 적용합니다. 펜 굵기를 함께 쓰면 글꼴 굵기도 바꿉니다. */
  function apply(usePenWidth: boolean): number {
    const list = chosen()
    if (list.length === 0) return 0
    const stamp = Date.now().toString(36)
    editProject((draft) => {
      for (const candidate of list) {
        const frame = frameBox(draft.layouts, candidate.key, homeLayout(candidate.key))
        const entry = (draft.jamo[candidate.key] ??= {})
        entry.base = {
          strokes: candidate.strokes.map((stroke, i) =>
            strokeFromSyllable(stroke, frame, `${candidate.key}-${stamp}${i}`),
          ),
        }
      }
      if (usePenWidth) {
        const pen = list.reduce((sum, c) => sum + c.penWidth, 0) / list.length
        const body = bodyFrame(draft.metrics, draft.style)
        draft.style.weight = Math.min(180, Math.max(30, Math.round(pen * (body.x1 - body.x0))))
      }
    })
    setAnnouncement(
      `${list.length}자를 작업 중인 글꼴에 적용했습니다. 작업실의 되돌리기로 취소할 수 있습니다.`,
    )
    return list.length
  }

  return {
    sources,
    candidates,
    divisions,
    setDivisions,
    smooth,
    setSmooth,
    announcement,
    addTemplateFiles,
    addSingleFile,
    toggle,
    selectAll,
    selectedCount,
    apply,
  }
}

export type Importer = ReturnType<typeof createImporter>
