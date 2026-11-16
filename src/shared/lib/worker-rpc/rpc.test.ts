import { describe, expect, it, vi } from 'vitest'
import { RpcClient, WorkerLoadError, serveRpc, type WorkerScopeLike } from './rpc.ts'

type Methods = {
  double: { payload: number; result: number }
  count: { payload: number; result: string; progress: number }
  fail: { payload: null; result: never }
  tooLong: { payload: null; result: never }
  hang: { payload: null; result: never }
}

/** 메시지를 비동기로 주고받는 가짜 워커 쌍 */
function createPair() {
  const workerListeners: ((e: MessageEvent) => void)[] = []
  const scopeListeners: ((e: MessageEvent) => void)[] = []
  let terminated = 0
  const scope: WorkerScopeLike = {
    postMessage: (message) =>
      queueMicrotask(() => workerListeners.forEach((l) => l({ data: message } as MessageEvent))),
    addEventListener: (_type, listener) =>
      scopeListeners.push(listener as (e: MessageEvent) => void),
  }
  const worker = {
    addEventListener: (type: string, listener: (e: MessageEvent) => void) => {
      if (type === 'message') workerListeners.push(listener)
    },
    postMessage: (message: unknown) =>
      queueMicrotask(() => scopeListeners.forEach((l) => l({ data: message } as MessageEvent))),
    terminate: () => {
      terminated += 1
    },
  } as unknown as Worker
  serveRpc(scope, {
    double: (n: number) => n * 2,
    count: async (n: number, context) => {
      for (let i = 1; i <= n; i++) context.progress(i)
      return 'done'
    },
    fail: () => {
      throw new Error('터짐')
    },
    tooLong: () => {
      throw new RangeError('너무 깁니다')
    },
    hang: () => new Promise(() => {}),
  })
  return { worker, terminated: () => terminated }
}

describe('워커 RPC', () => {
  it('요청과 응답을 번호로 짝짓습니다', async () => {
    const { worker } = createPair()
    const client = new RpcClient<Methods>(() => worker)
    const [a, b] = await Promise.all([client.call('double', 2), client.call('double', 21)])
    expect([a, b]).toEqual([4, 42])
  })

  it('진행 상황을 여러 번 받습니다', async () => {
    const { worker } = createPair()
    const client = new RpcClient<Methods>(() => worker)
    const seen: number[] = []
    const result = await client.call('count', 3, { onProgress: (p) => seen.push(p) })
    expect(result).toBe('done')
    expect(seen).toEqual([1, 2, 3])
  })

  it('워커 쪽 오류를 메시지와 함께 돌려줍니다', async () => {
    const { worker } = createPair()
    const client = new RpcClient<Methods>(() => worker)
    await expect(client.call('fail', null)).rejects.toThrow('터짐')
  })

  it('워커 쪽 오류의 종류(name)도 넘겨, 입력 문제와 일시적인 실패를 가릴 수 있습니다', async () => {
    const client = new RpcClient<Methods>(() => createPair().worker)
    const failure = await client.call('tooLong', null).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(Error)
    expect((failure as Error).name).toBe('RangeError')
    expect((failure as Error).message).toBe('너무 깁니다')
  })

  it('취소하면 워커를 끝내고 AbortError로 실패합니다', async () => {
    const pair = createPair()
    const client = new RpcClient<Methods>(() => pair.worker)
    const controller = new AbortController()
    const pending = client.call('hang', null, { signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(pair.terminated()).toBe(1)
  })

  it('끝난 요청의 취소 처리기는 떼어, 오래 쓰는 신호에 처리기가 쌓이지 않습니다', async () => {
    const { worker } = createPair()
    const client = new RpcClient<Methods>(() => worker)
    const controller = new AbortController()
    const added = vi.spyOn(controller.signal, 'addEventListener')
    const removed = vi.spyOn(controller.signal, 'removeEventListener')
    await client.call('double', 1, { signal: controller.signal })
    await expect(client.call('fail', null, { signal: controller.signal })).rejects.toThrow()
    expect(added).toHaveBeenCalledTimes(2)
    expect(removed).toHaveBeenCalledTimes(2)
  })

  it('워커 스크립트를 받지 못하면(문구 없는 오류) WorkerLoadError로 실패하고 알립니다', async () => {
    const listeners: ((event: Event) => void)[] = []
    let created = 0
    const worker = {
      addEventListener: (type: string, listener: (event: Event) => void) => {
        if (type === 'error') listeners.push(listener)
      },
      postMessage: () => queueMicrotask(() => listeners.forEach((l) => l(new Event('error')))),
      terminate: () => {},
    } as unknown as Worker
    const onWorkerError = vi.fn()
    const client = new RpcClient<Methods>(
      () => {
        created += 1
        return worker
      },
      { onWorkerError },
    )
    await expect(client.call('double', 1)).rejects.toBeInstanceOf(WorkerLoadError)
    expect(onWorkerError).toHaveBeenCalledWith(expect.any(WorkerLoadError))
    // 다음 요청 때 새 워커를 띄워 다시 시도합니다.
    await expect(client.call('double', 1)).rejects.toBeInstanceOf(WorkerLoadError)
    expect(created).toBe(2)
  })
})
