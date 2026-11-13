import { createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import { type CosmosRenderer, createCosmosRenderer } from '../lib/renderer.ts'
import styles from './CosmosBackdrop.module.css'

export type CosmosBackdropProps = {
  /** 밝기 0~1 (작업 화면에서는 어둡게) */
  dim: number
  paused: boolean
}

/** 화면 크기에 비해 낮은 해상도로 그립니다 (성운은 부드러워 티가 나지 않고 GPU 부담이 줄어듦). */
const RESOLUTION_SCALE = 0.6
const FRAME_INTERVAL = 1000 / 30

/** 꾸밈용 WebGL 배경. 보조기기에서는 숨기고, 멈춤 설정·탭 숨김일 때는 그리지 않습니다. */
export function CosmosBackdrop(props: CosmosBackdropProps) {
  let canvas!: HTMLCanvasElement
  const [supported, setSupported] = createSignal(true)
  let renderer: CosmosRenderer | null = null
  let frame = 0
  let lastDraw = 0
  let elapsed = 0
  let lastTick = 0
  // 밝기 애니메이션의 시작값으로 처음 값만 씁니다(이후 변화는 아래 효과에서 처리).
  // eslint-disable-next-line solid/reactivity
  let dim = props.dim

  const draw = () => renderer?.render(elapsed / 1000, dim)

  const loop = (now: number) => {
    frame = requestAnimationFrame(loop)
    if (lastTick) elapsed += Math.min(now - lastTick, 100)
    lastTick = now
    if (now - lastDraw < FRAME_INTERVAL) return
    lastDraw = now
    draw()
  }

  const stop = () => {
    cancelAnimationFrame(frame)
    frame = 0
    lastTick = 0
  }

  const start = () => {
    if (frame || !renderer || props.paused || document.hidden) return
    frame = requestAnimationFrame(loop)
  }

  const resize = () => {
    if (!renderer) return
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5) * RESOLUTION_SCALE
    renderer.resize(
      Math.max(1, Math.round(innerWidth * ratio)),
      Math.max(1, Math.round(innerHeight * ratio)),
    )
    draw()
  }

  const onVisibility = () => (document.hidden ? stop() : start())

  onMount(() => {
    renderer = createCosmosRenderer(canvas)
    if (!renderer) {
      setSupported(false)
      return
    }
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault()
      stop()
      renderer = null
      setSupported(false)
    })
    resize()
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', onVisibility)
    start()
  })

  createEffect(() => {
    if (props.paused) {
      stop()
      draw()
    } else {
      start()
    }
  })

  createEffect(() => {
    // 화면을 옮길 때 밝기를 부드럽게 바꿉니다.
    const target = props.dim
    const from = dim
    const started = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / 600)
      dim = from + (target - from) * (1 - (1 - t) ** 3)
      if (props.paused || !frame) draw()
      if (t < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })

  onCleanup(() => {
    stop()
    window.removeEventListener('resize', resize)
    document.removeEventListener('visibilitychange', onVisibility)
    renderer?.dispose()
  })

  return (
    <div
      class={styles.backdrop}
      classList={{ [styles.fallback!]: !supported() }}
      aria-hidden="true"
    >
      <canvas ref={canvas} class={styles.canvas} />
    </div>
  )
}
