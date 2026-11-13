/** 올린 파일을 그림(ImageBitmap)으로 바꿉니다. PDF는 쪽마다 한 장씩. */

export class ImportFileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImportFileError'
  }
}

export type PageSource = { label: string; bitmap: ImageBitmap }

/** 읽은 쪽과, 쪽 수 한도 때문에 건너뛴 쪽 수 */
export type ReadResult = { pages: PageSource[]; skippedPages: number }

export const MAX_PDF_PAGES = 6
const MAX_FILE_BYTES = 40 * 1024 * 1024
/** PDF를 그림으로 바꿀 때의 배율 (1 = 72dpi, 2.5 ≈ 180dpi) */
const PDF_SCALE = 2.5
/** 쪽 하나를 그림으로 바꿀 때의 최대 픽셀 수 (RGBA 약 95MiB). 큰 판형도 메모리를 넘치지 않게 */
const MAX_PAGE_PIXELS = 25_000_000

export function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

async function renderPdf(file: File): Promise<ReadResult> {
  // pdf.js는 PDF를 올렸을 때만 받습니다 (큰 라이브러리와 워커).
  const [pdfjs, { default: workerUrl }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  const document_ = await task.promise
  try {
    const pages: PageSource[] = []
    const count = Math.min(document_.numPages, MAX_PDF_PAGES)
    for (let i = 1; i <= count; i++) {
      const page = await document_.getPage(i)
      const natural = page.getViewport({ scale: 1 })
      const scale = Math.min(
        PDF_SCALE,
        Math.sqrt(MAX_PAGE_PIXELS / (natural.width * natural.height)),
      )
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(viewport.width)
      canvas.height = Math.round(viewport.height)
      await page.render({ canvas, viewport }).promise
      pages.push({ label: `${file.name} ${i}쪽`, bitmap: await createImageBitmap(canvas) })
      page.cleanup()
    }
    return { pages, skippedPages: document_.numPages - count }
  } finally {
    await task.destroy()
  }
}

export async function readPageSources(file: File): Promise<ReadResult> {
  if (file.size > MAX_FILE_BYTES) {
    throw new ImportFileError(
      `${file.name}: 파일이 너무 큽니다(40MB 넘음). 해상도를 줄이거나 쪽을 나눠 올려 주세요.`,
    )
  }
  if (isPdf(file)) {
    try {
      return await renderPdf(file)
    } catch {
      throw new ImportFileError(
        `${file.name}: PDF를 열지 못했습니다. 암호가 걸렸거나 손상되지 않았는지 확인해 주세요.`,
      )
    }
  }
  if (!file.type.startsWith('image/')) {
    throw new ImportFileError(`${file.name}: PDF나 그림 파일(PNG·JPEG·WebP)만 올릴 수 있습니다.`)
  }
  try {
    return { pages: [{ label: file.name, bitmap: await createImageBitmap(file) }], skippedPages: 0 }
  } catch {
    throw new ImportFileError(
      `${file.name}: 그림을 열지 못했습니다. HEIC 사진이면 JPEG로 바꾸거나 화면을 찍어 올려 주세요.`,
    )
  }
}
