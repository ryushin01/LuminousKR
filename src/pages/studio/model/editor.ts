/* eslint-disable solid/reactivity -- 이 파일의 함수들은 화면의 이벤트 처리기에서만 불립니다. */
import { batch, createMemo, createSignal } from 'solid-js'
import {
  type Box,
  type JamoKey,
  type LayoutId,
  MAX_POINTS_PER_STROKE,
  MAX_STROKES_PER_DRAWING,
  type PlacedStroke,
  type Point,
  bodyFrame,
  drawingLimitError,
  editProject,
  fontProject,
  frameBox,
  homeLayout,
  isDerivable,
  jamoLabel,
  latinAdvance,
  latinDrawing,
  latinFrame,
  latinLabel,
  latinWidth as latinWidthOf,
  layoutsOf,
  placedStrokesFor,
  strokeToSyllable,
} from '@/entities/font'
import { LAYOUT_INFO } from '@/entities/font'
import { clampPoint, hitNode, hitStroke, samePoint, snapPoint } from '../lib/canvas-geometry.ts'
import {
  type EditTarget,
  addStroke,
  adoptStrokes,
  clearDrawing,
  drawingOf,
  ellipseFromCorners,
  moveNode,
  moveStroke,
  removeDrawing,
  removeStroke,
  setLatinWidth as storeLatinWidth,
  setStrokeSmooth,
} from '../lib/drawing-ops.ts'

export type Tool = 'line' | 'curve' | 'ellipse' | 'select'

export const TOOL_LABEL: Record<Tool, string> = {
  line: '직선',
  curve: '곡선',
  ellipse: '원',
  select: '고르기',
}

/**
 * 그리는 그림이 어디서 왔는지
 * - own: 이 배치(영문은 이 글자)에서 직접 그린 그림 (고칠 수 있음)
 * - derived: 다른 자모로 자동으로 만든 그림 (ㄲ = ㄱ + ㄱ 등)
 * - inherited: 기본 배치의 그림을 이 배치 틀에 맞춘 것
 * - preset: 영문·숫자·문장부호의 기본 뼈대
 * - empty: 아무것도 없음 (바로 그리면 직접 그린 그림이 됨)
 */
export type DrawingSource = 'own' | 'derived' | 'inherited' | 'preset' | 'empty'

/** 영문 글자는 그 글자의 뼈대 틀 전체가 그림 좌표입니다. */
const WHOLE_BOX: Box = { x0: 0, y0: 0, x1: 1, y1: 1 }

const GRID_STEP_LABEL = (n: number) => Math.round(n)

/**
 * @param initialKey 처음 열 자모 (작업실 주소의 ?jamo=)
 * @param initialLayout 처음 열 배치 (작업실 주소의 ?layout=). 그 자모가 놓이지 않는 배치면 기본 배치
 * @param initialLatin 처음 열 영문·숫자·문장부호 (작업실 주소의 ?char=). 있으면 자모 대신 이 글자를 엽니다.
 */
export function createEditor(
  initialKey: JamoKey = 'L0',
  initialLayout?: LayoutId,
  initialLatin?: string,
) {
  const [key, setKey] = createSignal<JamoKey>(initialKey)
  /** 고르고 있는 영문 글자 (자모를 고치는 중이면 null) */
  const [latin, setLatin] = createSignal<string | null>(initialLatin ?? null)
  const [layout, setLayout] = createSignal<LayoutId>(
    initialLayout && layoutsOf(initialKey).includes(initialLayout)
      ? initialLayout
      : homeLayout(initialKey),
  )
  const [tool, setToolSignal] = createSignal<Tool>('line')
  const [pending, setPending] = createSignal<Point[]>([])
  const [selectedId, setSelectedId] = createSignal<string | null>(null)
  const [cursor, setCursor] = createSignal<Point>({ x: 0.5, y: 0.5 })
  const [divisions, setDivisions] = createSignal(24)
  const [snap, setSnap] = createSignal(true)
  const [announcement, setAnnouncement] = createSignal('')

  const isLatin = () => latin() !== null
  const target = (): EditTarget => {
    const char = latin()
    return char === null ? { key: key(), layout: layout() } : { latin: char }
  }
  /** 고치는 대상의 이름 (예: 'ㄱ 초성', '대문자 A') */
  const label = () => {
    const char = latin()
    return char === null ? jamoLabel(key()) : latinLabel(char)
  }
  const box = createMemo(() =>
    isLatin() ? WHOLE_BOX : frameBox(fontProject.layouts, key(), layout()),
  )
  const frame = createMemo(() =>
    isLatin()
      ? latinFrame(fontProject.metrics, fontProject.style)
      : bodyFrame(fontProject.metrics, fontProject.style),
  )
  const ownDrawing = () => drawingOf(fontProject, target())
  const ownStrokes = createMemo(() =>
    (ownDrawing()?.strokes ?? []).map((s) => strokeToSyllable(s, box())),
  )
  /** 실제로 쓰이는 획 (직접 그린 것이 없을 때 참고로 보여 줌). 영문은 직접 그린 것이 없으면 기본 뼈대 */
  const placedStrokes = createMemo<PlacedStroke[]>(() => {
    const char = latin()
    return char === null
      ? placedStrokesFor(fontProject, key(), layout())
      : [...latinDrawing(fontProject, char).strokes]
  })

  const source = createMemo<DrawingSource>(() => {
    if (ownDrawing()) return 'own'
    if (placedStrokes().length === 0) return 'empty'
    if (isLatin()) return 'preset'
    return layout() === homeLayout(key()) && isDerivable(key()) && !fontProject.jamo[key()]?.base
      ? 'derived'
      : 'inherited'
  })
  /** 바로 그릴 수 있는지 (직접 그린 그림이 있거나 비어 있을 때) */
  const canDraw = () => source() === 'own' || source() === 'empty'
  const isHome = () => isLatin() || layout() === homeLayout(key())

  /** 영문 글자의 뼈대 너비 (틀 높이 = 1) */
  const latinWidth = () => {
    const char = latin()
    return char === null ? 0 : latinWidthOf(fontProject, char)
  }
  /** 영문 글자의 너비(글꼴 단위): 뼈대 너비 + 세로획 굵기 + 좌우 여백 */
  const latinAdvanceUnits = () => latinAdvance(fontProject.metrics, fontProject.style, latinWidth())

  const say = (message: string) => setAnnouncement(message)
  const gridLabel = (p: Point) =>
    `가로 ${GRID_STEP_LABEL(p.x * divisions())}, 세로 ${GRID_STEP_LABEL(p.y * divisions())}`

  const normalize = (p: Point) => clampPoint(snap() ? snapPoint(p, divisions()) : p)

  function selectJamo(next: JamoKey) {
    batch(() => {
      setLatin(null)
      setKey(next)
      setLayout(homeLayout(next))
      setPending([])
      setSelectedId(null)
    })
    say(`${jamoLabel(next)}을 골랐습니다. '${LAYOUT_INFO[homeLayout(next)].sample}' 모양 틀입니다.`)
  }

  /** 영문·숫자·문장부호 한 글자를 고릅니다. */
  function selectLatin(char: string) {
    batch(() => {
      setLatin(char)
      setPending([])
      setSelectedId(null)
    })
    say(`'${latinLabel(char)}' 글자를 골랐습니다.`)
  }

  /** 영문 글자의 뼈대 너비를 바꿉니다 (끄는 동안의 변경은 되돌리기 한 번으로 묶음). */
  function setLatinWidth(width: number) {
    const char = latin()
    if (char === null) return
    editProject((draft) => storeLatinWidth(draft, char, width), { coalesce: `latin-width-${char}` })
  }

  function selectLayout(next: LayoutId) {
    if (isLatin() || !layoutsOf(key()).includes(next)) return
    batch(() => {
      setLayout(next)
      setPending([])
      setSelectedId(null)
    })
  }

  function setTool(next: Tool) {
    batch(() => {
      setToolSignal(next)
      setPending([])
      if (next !== 'select') setSelectedId(null)
    })
  }

  /**
   * 획이 한도만큼 있으면 알리고 true를 돌려줍니다. 한도를 넘는 그림은 자동 저장한 작업을
   * 다음에 열 수 없게 하므로, 획을 시작할 때와 마칠 때(그 사이 되돌리기·다시하기가 있어도) 모두 봅니다.
   */
  function strokesFull(): boolean {
    if (ownStrokes().length < MAX_STROKES_PER_DRAWING) return false
    say(
      `${isLatin() ? '글자' : '자모'} 하나에는 획을 ${MAX_STROKES_PER_DRAWING}개까지 넣을 수 있습니다. 쓰지 않는 획을 지운 뒤 그려 주세요.`,
    )
    return true
  }

  function commitPath(points: Point[], closed: boolean) {
    if (strokesFull()) return
    const smooth = tool() === 'curve'
    const stroke: PlacedStroke = { kind: 'path', points, closed, smooth }
    let id = ''
    editProject((draft) => {
      id = addStroke(draft, target(), box(), stroke)
    })
    setPending([])
    setSelectedId(id)
    say(
      `${closed ? '닫힌 ' : ''}${smooth ? '곡선' : '직선'} 획을 마쳤습니다. 점 ${points.length}개, 획 ${ownStrokes().length}개`,
    )
  }

  /** 지금 도구로 점 하나를 놓습니다 (포인터 누름·스페이스). */
  function place(raw: Point) {
    if (!canDraw() && tool() !== 'select') {
      say(
        isLatin()
          ? '기본 뼈대입니다. 먼저 "직접 고치기"를 눌러 주세요.'
          : '이 그림은 자동으로 만들어진 것입니다. 먼저 "직접 그리기"를 눌러 주세요.',
      )
      return
    }
    const p = normalize(raw)
    setCursor(p)
    const current = tool()
    if (current === 'select') {
      selectAt(p)
      return
    }
    if (pending().length === 0 && strokesFull()) return
    if (current === 'ellipse') {
      const [first] = pending()
      if (!first) {
        setPending([p])
        say(`원의 첫 모서리: ${gridLabel(p)}. 반대쪽 모서리를 고르세요.`)
        return
      }
      if (samePoint(first, p) || strokesFull()) return
      const stroke = ellipseFromCorners(first, p)
      let id = ''
      editProject((draft) => {
        id = addStroke(draft, target(), box(), stroke)
      })
      setPending([])
      setSelectedId(id)
      say(`원을 그렸습니다. 획 ${ownStrokes().length}개`)
      return
    }
    const points = pending()
    const first = points[0]
    const last = points[points.length - 1]
    if (first && points.length >= 3 && samePoint(first, p)) {
      commitPath(points, true)
      return
    }
    if (last && samePoint(last, p)) {
      if (points.length >= 1) commitPath(points, false)
      return
    }
    if (points.length >= MAX_POINTS_PER_STROKE) {
      say(
        `획 하나에는 점을 ${MAX_POINTS_PER_STROKE}개까지 넣을 수 있습니다. '획 마치기'(Enter)로 이 획을 마친 뒤 이어서 그려 주세요.`,
      )
      return
    }
    setPending([...points, p])
    say(`점 ${points.length + 1}개: ${gridLabel(p)}`)
  }

  /** 그리던 획을 마칩니다 (Enter·두 번 누르기·마치기 버튼). */
  function finish() {
    const points = pending()
    if (tool() === 'ellipse' || points.length === 0) return
    commitPath(points, false)
  }

  function cancel() {
    if (pending().length > 0) {
      setPending([])
      say('그리던 획을 취소했습니다.')
    } else if (selectedId()) {
      setSelectedId(null)
      say('선택을 풀었습니다.')
    }
  }

  function selectAt(p: Point) {
    const hit = hitStroke(p, ownStrokes(), 0.05)
    setSelectedId(hit?.id ?? null)
    say(hit ? `획 ${ownStrokes().indexOf(hit) + 1}을 골랐습니다.` : '고른 획이 없습니다.')
  }

  function selectStroke(id: string | null) {
    setSelectedId(id)
    if (id) say(`획 ${ownStrokes().findIndex((s) => s.id === id) + 1}을 골랐습니다.`)
  }

  function deleteSelected() {
    const id = selectedId()
    if (!id) return
    editProject((draft) => removeStroke(draft, target(), id))
    setSelectedId(null)
    say(`획을 지웠습니다. 남은 획 ${ownStrokes().length}개`)
  }

  function deleteStroke(id: string) {
    editProject((draft) => removeStroke(draft, target(), id))
    if (selectedId() === id) setSelectedId(null)
    say(`획을 지웠습니다. 남은 획 ${ownStrokes().length}개`)
  }

  /** 고른 획을 격자 칸 단위로 옮깁니다. */
  function nudge(dx: number, dy: number) {
    const id = selectedId()
    if (!id) return
    const step = 1 / divisions()
    editProject((draft) => moveStroke(draft, target(), box(), id, { x: dx * step, y: dy * step }), {
      coalesce: `nudge-${id}`,
    })
  }

  function toggleSmooth(id: string, smooth: boolean) {
    editProject((draft) => setStrokeSmooth(draft, target(), id, smooth))
  }

  /** 꼭짓점 끌기 */
  function dragNode(id: string, index: number, raw: Point) {
    const p = normalize(raw)
    editProject((draft) => moveNode(draft, target(), box(), id, index, p), {
      coalesce: `drag-${id}-${index}`,
    })
  }

  function nodeAt(p: Point) {
    return hitNode(p, ownStrokes(), 0.035)
  }

  /** 자동·기본 획(영문은 기본 뼈대)을 가져와 직접 고칠 수 있게 합니다. */
  function adopt() {
    const strokes = placedStrokes()
    const problem = drawingLimitError(strokes)
    if (problem) {
      say(`가져오지 못했습니다. ${problem} 바탕이 되는 자모의 획을 줄인 뒤 다시 가져와 주세요.`)
      return
    }
    editProject((draft) => adoptStrokes(draft, target(), box(), strokes))
    say(
      isLatin()
        ? '기본 뼈대를 가져왔습니다. 이제 직접 고칠 수 있습니다.'
        : isHome()
          ? '자동으로 만든 획을 가져왔습니다. 이제 직접 고칠 수 있습니다.'
          : '이 배치만 따로 그립니다. 다른 배치는 그대로입니다.',
    )
  }

  function clearAll() {
    editProject((draft) => clearDrawing(draft, target()))
    setSelectedId(null)
    setPending([])
    say(
      isLatin()
        ? '이 글자의 획을 모두 지웠습니다. 획이 없는 글자는 글꼴에 넣지 않습니다.'
        : '이 자모의 획을 모두 지웠습니다.',
    )
  }

  /** 직접 그린 것을 지우고 자동(파생)·기본 그림(영문은 기본 뼈대)으로 되돌립니다. */
  function revert() {
    editProject((draft) => removeDrawing(draft, target()))
    setSelectedId(null)
    setPending([])
    say(
      isLatin()
        ? '기본 뼈대로 되돌렸습니다.'
        : isHome()
          ? '자동으로 만든 획으로 되돌렸습니다.'
          : '이 배치의 따로 그린 획을 지우고 기본 획을 씁니다.',
    )
  }

  function moveCursor(dx: number, dy: number) {
    const step = 1 / divisions()
    const next = clampPoint({ x: cursor().x + dx * step, y: cursor().y + dy * step }, 0.1)
    setCursor(snapPoint(next, divisions()))
    say(gridLabel(cursor()))
  }

  return {
    key,
    layout,
    latin,
    isLatin,
    label,
    latinWidth,
    latinAdvance: latinAdvanceUnits,
    tool,
    pending,
    selectedId,
    cursor,
    divisions,
    snap,
    announcement,
    box,
    frame,
    ownStrokes,
    placedStrokes,
    source,
    canDraw,
    isHome,
    setCursor,
    setDivisions,
    setSnap,
    selectJamo,
    selectLatin,
    setLatinWidth,
    selectLayout,
    setTool,
    place,
    finish,
    cancel,
    selectStroke,
    deleteSelected,
    deleteStroke,
    nudge,
    toggleSmooth,
    dragNode,
    nodeAt,
    adopt,
    clearAll,
    revert,
    moveCursor,
    normalize,
    say,
  }
}

export type Editor = ReturnType<typeof createEditor>
