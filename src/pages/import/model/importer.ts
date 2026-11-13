import { createSignal, onCleanup } from 'solid-js'
import { createStore, produce } from 'solid-js/store'
import {
  type JamoKey,
  bodyFrame,
  editProject,
  fontProject,
  frameBox,
  homeLayout,
  jamoLabel,
  strokeFromSyllable,
} from '@/entities/font'
import type { RecognizedStroke } from '../lib/recognize.ts'
import { ImportFileError, readPageSources } from '../lib/read-files.ts'
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

/**
 * 가져오기 상태: 올린 파일(쪽)마다 인식 결과를 모으고, 고른 자모를 프로젝트에 적용합니다.
 * 적용은 되돌리기 한 번으로 취소할 수 있습니다.
 */
export function createImporter(deps: Deps = DEFAULT_DEPS) {
  const [sources, setSources] = createStore<SourceStatus[]>([])
  const [candidates, setCandidates] = createStore<Candidate[]>([])
  const [divisions, setDivisions] = createSignal<number | null>(24)
  const [smooth, setSmooth] = createSignal(false)
  const [busy, setBusy] = createSignal(false)
  const [announcement, setAnnouncement] = createSignal('')
  const urls: string[] = []
  let seq = 0

  onCleanup(() => urls.forEach((url) => URL.revokeObjectURL(url)))

  const options = () => ({ divisions: divisions(), smooth: smooth() })
  const objectUrl = (blob: Blob) => {
    const url = URL.createObjectURL(blob)
    urls.push(url)
    return url
  }

  const setSource = (id: number, state: SourceState, message: string) =>
    setSources((s) => s.id === id, { state, message })

  function addCandidate(candidate: Omit<Candidate, 'id' | 'selected'>) {
    setCandidates(
      produce((list) => {
        // 같은 자모를 여러 번 올리면 마지막 것만 고른 상태로 둡니다.
        for (const item of list) if (item.key === candidate.key) item.selected = false
        seq += 1
        list.push({ ...candidate, id: `c${seq}`, selected: true })
      }),
    )
  }

  async function addTemplateFiles(files: readonly File[]): Promise<void> {
    if (files.length === 0) return
    setBusy(true)
    try {
      for (const file of files) {
        seq += 1
        const id = seq
        setSources((list) => [
          ...list,
          { id, label: file.name, state: 'working', message: '여는 중…' },
        ])
        let pages
        try {
          pages = await deps.readPageSources(file)
        } catch (error) {
          setSource(id, 'error', errorText(error))
          continue
        }
        const notes: string[] = []
        let found = 0
        for (const page of pages) {
          setSource(id, 'working', `${page.label} 인식 중…`)
          const result = await deps.recognizeTemplatePage(
            page.bitmap,
            templateGeometry(),
            options(),
          )
          if (!result.ok) {
            notes.push(`${page.label}: ${result.message}`)
            continue
          }
          for (const cell of result.cells) {
            addCandidate({
              key: cell.key as JamoKey,
              strokes: cell.strokes,
              penWidth: cell.penWidth,
              preview: objectUrl(cell.preview),
              source: page.label,
            })
          }
          found += result.cells.length
          const name = templateSet(result.setId)?.name ?? '알 수 없는'
          notes.push(
            result.cells.length === 0
              ? `${page.label}: '${name}' 양식을 찾았지만 그린 칸이 없습니다. 칸 안에 진한 펜으로 그렸는지 확인해 주세요.`
              : `${page.label}: '${name}' 양식에서 ${result.cells.length}자를 찾았습니다${
                  result.empty.length > 0 ? ` (빈 칸 ${result.empty.length}개)` : ''
                }.`,
          )
        }
        setSource(id, found > 0 ? 'done' : 'error', notes.join(' '))
        setAnnouncement(notes.join(' '))
      }
    } finally {
      setBusy(false)
    }
  }

  async function addSingleFile(file: File, key: JamoKey): Promise<void> {
    setBusy(true)
    seq += 1
    const id = seq
    setSources((list) => [...list, { id, label: file.name, state: 'working', message: '인식 중…' }])
    try {
      const [page] = await deps.readPageSources(file)
      if (!page) throw new ImportFileError(`${file.name}: 그림이 없습니다.`)
      const frame = frameBox(fontProject.layouts, key, homeLayout(key))
      const result = await deps.recognizeSingleImage(page.bitmap, frame, options())
      if (!result.ok) {
        setSource(id, 'error', `${file.name}: ${result.message}`)
        setAnnouncement(result.message)
        return
      }
      addCandidate({
        key,
        strokes: result.strokes,
        penWidth: result.penWidth,
        preview: objectUrl(result.preview),
        source: file.name,
      })
      const message = `${file.name}: ${jamoLabel(key)}의 획 ${result.strokes.length}개를 찾았습니다.`
      setSource(id, 'done', message)
      setAnnouncement(message)
    } catch (error) {
      setSource(id, 'error', errorText(error))
      setAnnouncement(errorText(error))
    } finally {
      setBusy(false)
    }
  }

  function toggle(id: string, selected: boolean) {
    setCandidates((c) => c.id === id, 'selected', selected)
  }

  function selectAll(selected: boolean) {
    setCandidates(() => true, 'selected', selected)
  }

  const selectedCount = () => candidates.filter((c) => c.selected).length

  /** 고른 자모를 기본 그림으로 적용합니다. 펜 굵기를 함께 쓰면 글꼴 굵기도 바꿉니다. */
  function apply(usePenWidth: boolean): number {
    const chosen = candidates.filter((c) => c.selected)
    if (chosen.length === 0) return 0
    const stamp = Date.now().toString(36)
    editProject((draft) => {
      for (const candidate of chosen) {
        const frame = frameBox(draft.layouts, candidate.key, homeLayout(candidate.key))
        const entry = (draft.jamo[candidate.key] ??= {})
        entry.base = {
          strokes: candidate.strokes.map((stroke, i) =>
            strokeFromSyllable(stroke, frame, `${candidate.key}-${stamp}${i}`),
          ),
        }
      }
      if (usePenWidth) {
        const pen = chosen.reduce((sum, c) => sum + c.penWidth, 0) / chosen.length
        const body = bodyFrame(draft.metrics, draft.style)
        draft.style.weight = Math.min(180, Math.max(30, Math.round(pen * (body.x1 - body.x0))))
      }
    })
    setAnnouncement(
      `${chosen.length}자를 작업 중인 글꼴에 적용했습니다. 작업실의 되돌리기로 취소할 수 있습니다.`,
    )
    return chosen.length
  }

  return {
    sources,
    candidates,
    divisions,
    setDivisions,
    smooth,
    setSmooth,
    busy,
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
