/**
 * 손글씨 인식 워커: 그림 해독, 원근 바로잡기, 세선화·뼈대 추적을 모두 메인 스레드 밖에서 합니다.
 */
import { type GrayImage, rgbaToGray } from '@/shared/lib/image'
import { serveRpc, type WorkerScopeLike } from '@/shared/lib/worker-rpc'
import { recognizePage, recognizeSingle } from '../lib/recognize.ts'
import type { RecognizeMethods } from './recognize-protocol.ts'

/** 큰 사진은 이 크기로 줄여 다룹니다 (표식·칸을 찾기에 충분) */
const MAX_SIDE = 1800

function bitmapToGray(bitmap: ImageBitmap): GrayImage {
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = new OffscreenCanvas(width, height)
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  context.fillStyle = '#fff'
  context.fillRect(0, 0, width, height)
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return rgbaToGray(context.getImageData(0, 0, width, height).data, width, height)
}

function rasterToPng(raster: GrayImage): Promise<Blob> {
  const canvas = new OffscreenCanvas(raster.width, raster.height)
  const context = canvas.getContext('2d')!
  const image = context.createImageData(raster.width, raster.height)
  raster.data.forEach((v, i) => {
    image.data[i * 4] = v
    image.data[i * 4 + 1] = v
    image.data[i * 4 + 2] = v
    image.data[i * 4 + 3] = 255
  })
  context.putImageData(image, 0, 0)
  return canvas.convertToBlob({ type: 'image/png' })
}

serveRpc(self as unknown as WorkerScopeLike, {
  async page(payload: RecognizeMethods['page']['payload']) {
    const result = recognizePage(bitmapToGray(payload.bitmap), payload.geometry, payload.options)
    if (!result.ok) return result
    const cells = await Promise.all(
      result.cells.map(async ({ raster, ...cell }) => ({
        ...cell,
        preview: await rasterToPng(raster),
      })),
    )
    return { ok: true, setId: result.setId, cells, empty: result.empty }
  },

  async single(payload: RecognizeMethods['single']['payload']) {
    const result = recognizeSingle(bitmapToGray(payload.bitmap), payload.frame, payload.options)
    if (!result) {
      return {
        ok: false,
        message:
          '그림에서 잉크(어두운 선)를 찾지 못했습니다. 밝은 종이에 진한 펜으로 그린 그림을 올려 주세요.',
      }
    }
    return {
      ok: true,
      strokes: result.strokes,
      penWidth: result.penWidth,
      preview: await rasterToPng(result.raster),
    }
  },
})
