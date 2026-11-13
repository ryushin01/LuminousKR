/**
 * Web Worker와 주고받는 작은 RPC
 *
 * - 요청마다 번호를 붙여 응답을 짝지음
 * - 오래 걸리는 작업은 진행 상황(progress)을 여러 번 보냄
 * - 취소(AbortSignal)하면 워커를 끝내고, 다음 요청 때 새 워커를 띄움
 *   (계산이 동기로 돌고 있으면 메시지를 받을 수 없어 terminate가 가장 확실함)
 */

export type RpcRequest = { id: number; method: string; payload: unknown }

export type RpcResponse =
  | { id: number; kind: 'progress'; data: unknown }
  | { id: number; kind: 'result'; data: unknown }
  | { id: number; kind: 'error'; message: string }

/** 워커 전역 객체 중 필요한 부분 (DOM·WebWorker 타입 정의가 겹치지 않게 직접 적음) */
export type WorkerScopeLike = {
  postMessage(message: unknown, transfer?: Transferable[]): void
  addEventListener(type: 'message', listener: (event: MessageEvent<RpcRequest>) => void): void
}

export type HandlerContext = {
  progress(data: unknown): void
  /** 결과와 함께 복사 없이 넘길 버퍼 */
  transfer(...list: Transferable[]): void
}

// 각 처리기의 payload 타입은 서로 다르므로 등록할 때만 느슨하게 받습니다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Handlers = Record<string, (payload: any, context: HandlerContext) => unknown>

/** 워커 쪽: 요청을 받아 처리기를 부르고 응답합니다. */
export function serveRpc(scope: WorkerScopeLike, handlers: Handlers): void {
  scope.addEventListener('message', async (event) => {
    const { id, method, payload } = event.data
    const handler = handlers[method]
    if (!handler) {
      scope.postMessage({
        id,
        kind: 'error',
        message: `알 수 없는 요청: ${method}`,
      } satisfies RpcResponse)
      return
    }
    const transfer: Transferable[] = []
    try {
      const data = await handler(payload, {
        progress: (progressData) =>
          scope.postMessage({ id, kind: 'progress', data: progressData } satisfies RpcResponse),
        transfer: (...list) => transfer.push(...list),
      })
      scope.postMessage({ id, kind: 'result', data } satisfies RpcResponse, transfer)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      scope.postMessage({ id, kind: 'error', message } satisfies RpcResponse)
    }
  })
}

export type MethodSpec = { payload: unknown; result: unknown; progress?: unknown }

export type CallOptions<P> = {
  onProgress?: (progress: P) => void
  signal?: AbortSignal
  transfer?: Transferable[]
}

type Pending = {
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
  onProgress?: (progress: unknown) => void
}

export class RpcAbortError extends Error {
  constructor() {
    super('작업을 취소했습니다.')
    this.name = 'AbortError'
  }
}

/** 메인 스레드 쪽: 워커를 필요할 때 띄우고 요청을 보냅니다. */
export class RpcClient<Methods extends Record<string, MethodSpec>> {
  private worker: Worker | null = null
  private nextId = 1
  private readonly pending = new Map<number, Pending>()
  private readonly createWorker: () => Worker

  constructor(createWorker: () => Worker) {
    this.createWorker = createWorker
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker
    const worker = this.createWorker()
    worker.addEventListener('message', (event: MessageEvent<RpcResponse>) => {
      const response = event.data
      const entry = this.pending.get(response.id)
      if (!entry) return
      if (response.kind === 'progress') {
        entry.onProgress?.(response.data)
        return
      }
      this.pending.delete(response.id)
      if (response.kind === 'result') entry.resolve(response.data)
      else entry.reject(new Error(response.message))
    })
    worker.addEventListener('error', (event) => {
      event.preventDefault()
      this.failAll(new Error(event.message || '작업 스레드를 시작하지 못했습니다.'))
      this.worker?.terminate()
      this.worker = null
    })
    this.worker = worker
    return worker
  }

  private failAll(reason: unknown): void {
    for (const entry of this.pending.values()) entry.reject(reason)
    this.pending.clear()
  }

  call<K extends keyof Methods & string>(
    method: K,
    payload: Methods[K]['payload'],
    options: CallOptions<Methods[K]['progress']> = {},
  ): Promise<Methods[K]['result']> {
    if (options.signal?.aborted) return Promise.reject(new RpcAbortError())
    const worker = this.ensureWorker()
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        onProgress: options.onProgress as ((progress: unknown) => void) | undefined,
      })
      options.signal?.addEventListener(
        'abort',
        () => {
          if (!this.pending.has(id)) return
          // 동기 계산 중인 워커는 메시지를 못 받으므로 끝내고 새로 띄웁니다.
          this.terminate(new RpcAbortError())
        },
        { once: true },
      )
      worker.postMessage({ id, method, payload } satisfies RpcRequest, options.transfer ?? [])
    })
  }

  /** 워커를 끝냅니다. 기다리던 요청은 모두 reason으로 실패합니다. */
  terminate(reason: unknown = new RpcAbortError()): void {
    this.worker?.terminate()
    this.worker = null
    this.failAll(reason)
  }
}
