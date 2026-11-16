import { createEffect, createSignal, on, onCleanup, onMount } from 'solid-js'
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
const DIM_DURATION_MS = 600

/** 유휴 시간을 기다리는 최대 시간. 바쁜 화면에서도 이 안에는 배경을 만듭니다. */
const IDLE_TIMEOUT_MS = 800

/**
 * 첫 화면을 그리고 화면 조각까지 붙인 뒤, 메인 스레드가 한가할 때 부릅니다.
 * (다음 프레임 → requestIdleCallback, 없으면 setTimeout)
 */
export function afterFirstPaint(callback: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let idle: number | undefined
  const frame = requestAnimationFrame(() => {
    if (typeof window.requestIdleCallback === 'function') {
      idle = window.requestIdleCallback(() => callback(), { timeout: IDLE_TIMEOUT_MS })
    } else {
      timer = setTimeout(callback, 0)
    }
  })
  return () => {
    cancelAnimationFrame(frame)
    clearTimeout(timer)
    if (idle !== undefined) window.cancelIdleCallback(idle)
  }
}

/**
 * 꾸밈용 WebGL 배경. 보조기기에서는 숨기고, 멈춤 설정·탭 숨김일 때는 그리지 않습니다.
 * 셰이더 컴파일이 첫 화면 표시를 막지 않도록 첫 화면을 그린 뒤에 만들고, 준비되면 나타납니다.
 */
export function CosmosBackdrop(props: CosmosBackdropProps) {
  let canvas!: HTMLCanvasElement
  const [supported, setSupported] = createSignal(true)
  let renderer: CosmosRenderer | null = null
  let disposed = false
  let frame = 0
  let lastDraw = 0
  let elapsed = 0
  let lastTick = 0
  let dimFrame = 0
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

  const init = async () => {
    const created = await createCosmosRenderer(canvas)
    if (disposed) {
      created?.dispose()
      return
    }
    if (!created) {
      setSupported(false)
      return
    }
    renderer = created
    resize()
    start()
  }

  onMount(() => {
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault()
      stop()
      renderer = null
      setSupported(false)
    })
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', onVisibility)
    const cancelInit = afterFirstPaint(() => void init())
    onCleanup(cancelInit)
  })

  createEffect(
    on(
      () => props.paused,
      (paused) => {
        if (paused) {
          stop()
          draw()
        } else {
          start()
        }
      },
    ),
  )

  createEffect(
    on(
      () => props.dim,
      (target) => {
        // 화면을 옮길 때 밝기를 부드럽게 바꿉니다. 빨리 옮기면 앞의 애니메이션은 멈추고 지금 밝기에서 이어 갑니다.
        cancelAnimationFrame(dimFrame)
        const from = dim
        const started = performance.now()
        const step = (now: number) => {
          const t = Math.min(1, (now - started) / DIM_DURATION_MS)
          dim = from + (target - from) * (1 - (1 - t) ** 3)
          if (props.paused || !frame) draw()
          dimFrame = t < 1 ? requestAnimationFrame(step) : 0
        }
        dimFrame = requestAnimationFrame(step)
      },
      { defer: true },
    ),
  )

  onCleanup(() => {
    disposed = true
    stop()
    cancelAnimationFrame(dimFrame)
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
