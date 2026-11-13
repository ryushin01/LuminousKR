import '@testing-library/jest-dom/vitest'
import { cleanup } from '@solidjs/testing-library'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})

if (typeof window !== 'undefined') {
  // jsdom에는 Web Worker가 없습니다. 화면 테스트에서는 답하지 않는 워커로 둡니다
  // (글리프 그림은 엔진 단위 테스트에서 따로 확인).
  if (!('Worker' in window)) {
    class SilentWorker {
      addEventListener() {}
      removeEventListener() {}
      postMessage() {}
      terminate() {}
    }
    Object.assign(window, { Worker: SilentWorker })
    Object.assign(globalThis, { Worker: SilentWorker })
  }

  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        dispatchEvent: () => false,
      }) as MediaQueryList
  }

  if (!globalThis.CSS?.escape) {
    Object.assign(globalThis, {
      CSS: {
        ...globalThis.CSS,
        escape: (value: string) => value.replace(/[^\w-]/g, (c) => `\\${c}`),
      },
    })
  }

  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '')
    }
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    }
  }
}
