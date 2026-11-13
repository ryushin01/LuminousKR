import { For, Index, Show, createMemo, createSignal, createUniqueId } from 'solid-js'
import {
  type LayoutBoxes,
  type Point,
  type RenderItem,
  createRenderedGlyphs,
  fontProject,
  jamoLabel,
  sampleSyllable,
} from '@/entities/font'
import { boxToSvg, strokeToSvgPath, toSvg, fromSvg } from '../lib/canvas-geometry.ts'
import { ellipseFromCorners } from '../lib/drawing-ops.ts'
import type { Editor } from '../model/editor.ts'
import styles from './JamoCanvas.module.css'

const ARROWS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
}

/** 뼈대를 그리는 판. 화면 표시는 SVG, 조작은 포인터와 키보드 모두 됩니다. */
export function JamoCanvas(props: { editor: Editor }) {
  // eslint-disable-next-line solid/reactivity -- 편집기 객체는 화면마다 한 번 만들어지고 바뀌지 않습니다.
  const editor = props.editor
  const helpId = createUniqueId()
  let svg!: SVGSVGElement
  const [focused, setFocused] = createSignal(false)
  const [hovering, setHovering] = createSignal(false)
  let drag: { id: string; index: number; pointer: number } | null = null

  const advance = () => fontProject.metrics.advance
  const frame = editor.frame

  const items = createMemo<RenderItem[]>(() => [
    { type: 'char', char: sampleSyllable(editor.key(), editor.layout()) },
    { type: 'jamo', key: editor.key(), layout: editor.layout() },
  ])
  const glyphs = createRenderedGlyphs(items)

  const layoutBoxes = createMemo(() => {
    const boxes: LayoutBoxes = fontProject.layouts[editor.layout()]
    return (['L', 'V', 'Vh', 'Vv', 'T'] as const)
      .filter((part) => boxes[part] && !(part === 'V' && boxes.Vh))
      .map((part) => ({ part, rect: boxToSvg(frame(), boxes[part]!) }))
  })

  const gridLines = createMemo(() => {
    const n = editor.divisions()
    const major = n >= 24 ? n / 4 : n / 2
    const lines: { x1: number; y1: number; x2: number; y2: number; major: boolean }[] = []
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const a = toSvg(frame(), { x: t, y: 0 })
      const b = toSvg(frame(), { x: t, y: 1 })
      const c = toSvg(frame(), { x: 0, y: t })
      const d = toSvg(frame(), { x: 1, y: t })
      const isMajor = i % major === 0
      lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, major: isMajor })
      lines.push({ x1: c.x, y1: c.y, x2: d.x, y2: d.y, major: isMajor })
    }
    return lines
  })

  const toSyllable = (event: PointerEvent | MouseEvent): Point => {
    const matrix = svg.getScreenCTM()
    if (!matrix) return { x: 0, y: 0 }
    const pt = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    return fromSvg(frame(), { x: pt.x, y: pt.y })
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    event.preventDefault()
    ;(event.currentTarget as HTMLElement).focus({ preventScroll: true })
    const p = toSyllable(event)
    if (editor.tool() === 'select' && editor.canDraw()) {
      const node = editor.nodeAt(p)
      if (node) {
        drag = { ...node, pointer: event.pointerId }
        editor.selectStroke(node.id)
        svg.setPointerCapture(event.pointerId)
        return
      }
    }
    editor.place(p)
  }

  const onPointerMove = (event: PointerEvent) => {
    const p = toSyllable(event)
    editor.setCursor(editor.normalize(p))
    if (drag && drag.pointer === event.pointerId) editor.dragNode(drag.id, drag.index, p)
  }

  const endDrag = (event: PointerEvent) => {
    if (drag && drag.pointer === event.pointerId) {
      drag = null
      if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId)
    }
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const arrow = ARROWS[event.key]
    if (arrow) {
      event.preventDefault()
      const step = event.shiftKey ? 4 : 1
      editor.moveCursor(arrow[0] * step, arrow[1] * step)
      return
    }
    switch (event.key) {
      case ' ':
        event.preventDefault()
        editor.place(editor.cursor())
        break
      case 'Enter':
        event.preventDefault()
        editor.finish()
        break
      case 'Escape':
        if (editor.pending().length > 0 || editor.selectedId()) {
          event.preventDefault()
          editor.cancel()
        }
        break
      case 'Delete':
      case 'Backspace':
        if (editor.selectedId()) {
          event.preventDefault()
          editor.deleteSelected()
        }
        break
    }
  }

  const pendingPath = () => {
    const points = editor.pending().map((p) => toSvg(frame(), p))
    if (points.length === 0) return ''
    const cursor = toSvg(frame(), editor.cursor())
    return [...points, cursor]
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join('')
  }

  const pendingEllipse = () => {
    const [first] = editor.pending()
    if (editor.tool() !== 'ellipse' || !first) return null
    const e = ellipseFromCorners(first, editor.cursor())
    if (e.kind !== 'ellipse') return null
    const c = toSvg(frame(), { x: e.cx, y: e.cy })
    const w = frame().x1 - frame().x0
    const h = frame().yTop - frame().yBottom
    return { cx: c.x, cy: c.y, rx: e.rx * w, ry: e.ry * h }
  }

  const cursorSvg = () => toSvg(frame(), editor.cursor())
  const showCursor = () => focused() || hovering()
  const nodeRadius = () => Math.max(9, advance() / 90)

  return (
    <div class={styles.wrap}>
      {/* 그리기 판은 키보드 조작을 직접 구현한 application 역할입니다(안내 문구를 aria-describedby로 연결). */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        class={styles.surface}
        classList={{
          [styles.readonly!]: !editor.canDraw(),
          [styles.selecting!]: editor.tool() === 'select',
        }}
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabindex="0"
        role="application"
        aria-roledescription="그리기 판"
        aria-label={`${jamoLabel(editor.key())} 그리기 판`}
        aria-describedby={helpId}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onPointerEnter={() => setHovering(true)}
        onPointerLeave={() => setHovering(false)}
      >
        <svg
          ref={svg}
          class={styles.svg}
          viewBox={`0 0 ${advance()} 1000`}
          aria-hidden="true"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDblClick={() => editor.finish()}
        >
          <rect class={styles.em} x="0" y="0" width={advance()} height="1000" />
          <g class={styles.grid}>
            <For each={gridLines()}>
              {(line) => (
                <line
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  class={line.major ? styles.gridMajor : styles.gridMinor}
                />
              )}
            </For>
          </g>
          <g>
            <For each={layoutBoxes()}>{(item) => <rect class={styles.box} {...item.rect} />}</For>
            <rect class={styles.frame} {...boxToSvg(frame(), editor.box())} />
          </g>
          <Show when={glyphs()?.[0]}>
            {(glyph) => <path class={styles.context} d={glyph().d} />}
          </Show>
          <Show when={glyphs()?.[1]}>
            {(glyph) => <path class={styles.outline} d={glyph().d} />}
          </Show>
          <Show
            when={editor.source() === 'own'}
            fallback={
              <g class={styles.ghost}>
                <For each={editor.placedStrokes()}>
                  {(stroke) => <path d={strokeToSvgPath(frame(), stroke)} />}
                </For>
              </g>
            }
          >
            <g>
              <For each={editor.ownStrokes()}>
                {(stroke) => (
                  <g
                    classList={{
                      [styles.skeleton!]: true,
                      [styles.selected!]: editor.selectedId() === stroke.id,
                    }}
                  >
                    <path d={strokeToSvgPath(frame(), stroke)} />
                    <Show when={stroke.kind === 'path' ? stroke : null}>
                      {(path) => (
                        <Index each={path().points}>
                          {(point) => {
                            const at = () => toSvg(frame(), point())
                            return (
                              <circle
                                class={styles.node}
                                cx={at().x}
                                cy={at().y}
                                r={nodeRadius()}
                              />
                            )
                          }}
                        </Index>
                      )}
                    </Show>
                  </g>
                )}
              </For>
            </g>
          </Show>
          <path class={styles.pending} d={pendingPath()} />
          <Index each={editor.pending()}>
            {(point) => {
              const at = () => toSvg(frame(), point())
              return <circle class={styles.pendingNode} cx={at().x} cy={at().y} r={nodeRadius()} />
            }}
          </Index>
          <Show when={pendingEllipse()}>
            {(e) => (
              <ellipse class={styles.pending} cx={e().cx} cy={e().cy} rx={e().rx} ry={e().ry} />
            )}
          </Show>
          <Show when={showCursor()}>
            <g class={styles.cursor} transform={`translate(${cursorSvg().x} ${cursorSvg().y})`}>
              <line x1="-26" y1="0" x2="26" y2="0" />
              <line x1="0" y1="-26" x2="0" y2="26" />
              <circle r="7" />
            </g>
          </Show>
        </svg>
      </div>
      <p id={helpId} class={styles.help}>
        포인터로 점을 찍고 두 번 누르거나 Enter로 획을 마칩니다. 첫 점을 다시 누르면 닫힌 획이
        됩니다. 키보드: 화살표로 점 위치(Shift와 함께 4칸), 스페이스로 점 찍기, Enter 마치기, Esc
        취소, Delete 고른 획 지우기.
      </p>
    </div>
  )
}
