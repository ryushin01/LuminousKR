import { createEffect, onMount } from 'solid-js'
import styles from './ConstellationProgress.module.css'

/** 초성 19개 묶음(가로 28 종성 × 세로 21 중성)을 5×4로 늘어놓은 11,172칸 */
const COLS_PER_BLOCK = 28
const ROWS_PER_BLOCK = 21
const BLOCKS_PER_ROW = 5
const CELL = 4
const GAP = 1
const BLOCK_GAP = 10
const COMPAT = 51
const BLOCK_W = COLS_PER_BLOCK * (CELL + GAP)
const BLOCK_H = ROWS_PER_BLOCK * (CELL + GAP)
const WIDTH = BLOCKS_PER_ROW * BLOCK_W + (BLOCKS_PER_ROW - 1) * BLOCK_GAP
const HEIGHT = 4 * BLOCK_H + 3 * BLOCK_GAP

function cellPosition(syllableIndex: number): [number, number] {
  const block = Math.floor(syllableIndex / (COLS_PER_BLOCK * ROWS_PER_BLOCK))
  const inBlock = syllableIndex % (COLS_PER_BLOCK * ROWS_PER_BLOCK)
  const row = Math.floor(inBlock / COLS_PER_BLOCK)
  const col = inBlock % COLS_PER_BLOCK
  const bx = (block % BLOCKS_PER_ROW) * (BLOCK_W + BLOCK_GAP)
  const by = Math.floor(block / BLOCKS_PER_ROW) * (BLOCK_H + BLOCK_GAP)
  return [bx + col * (CELL + GAP), by + row * (CELL + GAP)]
}

/**
 * 조합된 음절이 별처럼 하나씩 켜지는 진행 그림 (꾸밈).
 * 진행 정도는 옆의 <progress>와 상태 문구로 따로 알립니다.
 */
export function ConstellationProgress(props: { done: number; complete: boolean }) {
  let canvas!: HTMLCanvasElement
  let lit = 0

  const reset = (context: CanvasRenderingContext2D) => {
    context.clearRect(0, 0, WIDTH, HEIGHT)
    context.fillStyle = 'rgba(255,255,255,0.07)'
    for (let i = 0; i < 11_172; i++) {
      const [x, y] = cellPosition(i)
      context.fillRect(x, y, CELL, CELL)
    }
    lit = 0
  }

  onMount(() => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = WIDTH * ratio
    canvas.height = HEIGHT * ratio
    const context = canvas.getContext('2d')
    if (!context) return
    context.scale(ratio, ratio)
    reset(context)
  })

  createEffect(() => {
    const context = canvas?.getContext('2d')
    if (!context) return
    const target = Math.max(0, Math.min(11_172, (props.complete ? 11_223 : props.done) - COMPAT))
    if (target < lit) reset(context)
    context.fillStyle = '#ffe9d4'
    context.shadowColor = 'rgba(255,140,70,0.9)'
    context.shadowBlur = 6
    for (let i = lit; i < target; i++) {
      const [x, y] = cellPosition(i)
      context.fillRect(x, y, CELL, CELL)
    }
    context.shadowBlur = 0
    lit = target
  })

  return (
    <canvas
      ref={canvas}
      class={styles.canvas}
      style={{ 'aspect-ratio': `${WIDTH} / ${HEIGHT}` }}
      aria-hidden="true"
    />
  )
}
