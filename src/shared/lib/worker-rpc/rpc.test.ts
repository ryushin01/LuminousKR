import { describe, expect, it } from 'vitest'
import { RpcClient, serveRpc, type WorkerScopeLike } from './rpc.ts'

type Methods = {
  double: { payload: number; result: number }
  count: { payload: number; result: string; progress: number }
  fail: { payload: null; result: never }
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

  it('취소하면 워커를 끝내고 AbortError로 실패합니다', async () => {
    const pair = createPair()
    const client = new RpcClient<Methods>(() => pair.worker)
    const controller = new AbortController()
    const pending = client.call('hang', null, { signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(pair.terminated()).toBe(1)
  })
})
