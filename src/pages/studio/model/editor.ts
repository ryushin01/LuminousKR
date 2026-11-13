/* eslint-disable solid/reactivity -- 이 파일의 함수들은 화면의 이벤트 처리기에서만 불립니다. */
import { batch, createMemo, createSignal } from 'solid-js'
import {
  type JamoKey,
  type LayoutId,
  type PlacedStroke,
  type Point,
  bodyFrame,
  editProject,
  fontProject,
  frameBox,
  homeLayout,
  isDerivable,
  jamoLabel,
  layoutsOf,
  placedStrokesFor,
} from '@/entities/font'
import { LAYOUT_INFO } from '@/entities/font'
import { clampPoint, hitNode, hitStroke, samePoint, snapPoint } from '../lib/canvas-geometry.ts'
import {
  addStroke,
  adoptStrokes,
  clearDrawing,
  drawingOf,
  ellipseFromCorners,
  moveNode,
  moveStroke,
  removeDrawing,
  removeStroke,
  setStrokeSmooth,
  strokeToSyllable,
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
 * - own: 이 배치에서 직접 그린 그림 (고칠 수 있음)
 * - derived: 다른 자모로 자동으로 만든 그림 (ㄲ = ㄱ + ㄱ 등)
 * - inherited: 기본 배치의 그림을 이 배치 틀에 맞춘 것
 * - empty: 아무것도 없음 (바로 그리면 직접 그린 그림이 됨)
 */
export type DrawingSource = 'own' | 'derived' | 'inherited' | 'empty'

const GRID_STEP_LABEL = (n: number) => Math.round(n)

export function createEditor(initialKey: JamoKey = 'L0') {
  const [key, setKey] = createSignal<JamoKey>(initialKey)
  const [layout, setLayout] = createSignal<LayoutId>(homeLayout(initialKey))
  const [tool, setToolSignal] = createSignal<Tool>('line')
  const [pending, setPending] = createSignal<Point[]>([])
  const [selectedId, setSelectedId] = createSignal<string | null>(null)
  const [cursor, setCursor] = createSignal<Point>({ x: 0.5, y: 0.5 })
  const [divisions, setDivisions] = createSignal(24)
  const [snap, setSnap] = createSignal(true)
  const [announcement, setAnnouncement] = createSignal('')

  const target = () => ({ key: key(), layout: layout() })
  const box = createMemo(() => frameBox(fontProject.layouts, key(), layout()))
  const frame = createMemo(() => bodyFrame(fontProject.metrics, fontProject.style))
  const ownDrawing = () => drawingOf(fontProject, target())
  const ownStrokes = createMemo(() =>
    (ownDrawing()?.strokes ?? []).map((s) => strokeToSyllable(s, box())),
  )
  /** 이 배치에서 실제로 쓰이는 획 (직접 그린 것이 없을 때 참고로 보여 줌) */
  const placedStrokes = createMemo(() => placedStrokesFor(fontProject, key(), layout()))

  const source = createMemo<DrawingSource>(() => {
    if (ownDrawing()) return 'own'
    if (placedStrokes().length === 0) return 'empty'
    return layout() === homeLayout(key()) && isDerivable(key()) && !fontProject.jamo[key()]?.base
      ? 'derived'
      : 'inherited'
  })
  /** 바로 그릴 수 있는지 (직접 그린 그림이 있거나 비어 있을 때) */
  const canDraw = () => source() === 'own' || source() === 'empty'
  const isHome = () => layout() === homeLayout(key())

  const say = (message: string) => setAnnouncement(message)
  const gridLabel = (p: Point) =>
    `가로 ${GRID_STEP_LABEL(p.x * divisions())}, 세로 ${GRID_STEP_LABEL(p.y * divisions())}`

  const normalize = (p: Point) => clampPoint(snap() ? snapPoint(p, divisions()) : p)

  function selectJamo(next: JamoKey) {
    batch(() => {
      setKey(next)
      setLayout(homeLayout(next))
      setPending([])
      setSelectedId(null)
    })
    say(`${jamoLabel(next)}을 골랐습니다. '${LAYOUT_INFO[homeLayout(next)].sample}' 모양 틀입니다.`)
  }

  function selectLayout(next: LayoutId) {
    if (!layoutsOf(key()).includes(next)) return
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

  function commitPath(points: Point[], closed: boolean) {
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
      say('이 그림은 자동으로 만들어진 것입니다. 먼저 "직접 그리기"를 눌러 주세요.')
      return
    }
    const p = normalize(raw)
    setCursor(p)
    const current = tool()
    if (current === 'select') {
      selectAt(p)
      return
    }
    if (current === 'ellipse') {
      const [first] = pending()
      if (!first) {
        setPending([p])
        say(`원의 첫 모서리: ${gridLabel(p)}. 반대쪽 모서리를 고르세요.`)
        return
      }
      if (samePoint(first, p)) return
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

  /** 자동·기본 획을 가져와 이 배치에서 직접 고칠 수 있게 합니다. */
  function adopt() {
    const strokes = placedStrokes()
    editProject((draft) => adoptStrokes(draft, target(), box(), strokes))
    say(
      isHome()
        ? '자동으로 만든 획을 가져왔습니다. 이제 직접 고칠 수 있습니다.'
        : '이 배치만 따로 그립니다. 다른 배치는 그대로입니다.',
    )
  }

  function clearAll() {
    editProject((draft) => clearDrawing(draft, target()))
    setSelectedId(null)
    setPending([])
    say('이 자모의 획을 모두 지웠습니다.')
  }

  /** 직접 그린 것을 지우고 자동(파생) 또는 기본 그림으로 되돌립니다. */
  function revert() {
    editProject((draft) => removeDrawing(draft, target()))
    setSelectedId(null)
    setPending([])
    say(
      isHome()
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
