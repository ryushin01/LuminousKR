import { RpcClient } from '@/shared/lib/worker-rpc'
import type { TemplateGeometry } from '../lib/template-geometry.ts'
import type { RecognizeOptions } from '../lib/recognize.ts'
import type { PageRecognition, RecognizeMethods, SingleRecognition } from './recognize-protocol.ts'

const client = new RpcClient<RecognizeMethods>(
  () =>
    new Worker(new URL('./recognize.worker.ts', import.meta.url), {
      type: 'module',
      name: 'luminous-recognize',
    }),
)

/** 양식 한 쪽을 인식합니다. 그림(ImageBitmap)은 복사 없이 워커로 넘깁니다. */
export function recognizeTemplatePage(
  bitmap: ImageBitmap,
  geometry: TemplateGeometry,
  options: RecognizeOptions,
): Promise<PageRecognition> {
  return client.call('page', { bitmap, geometry, options }, { transfer: [bitmap] })
}

export function recognizeSingleImage(
  bitmap: ImageBitmap,
  frame: { x0: number; y0: number; x1: number; y1: number },
  options: RecognizeOptions,
): Promise<SingleRecognition> {
  return client.call('single', { bitmap, frame, options }, { transfer: [bitmap] })
}
