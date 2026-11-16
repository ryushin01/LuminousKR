import type { BuildProgress, BuildRequest, BuildResult } from '../lib/build-font.ts'
import type { FontProject, JamoKey, LayoutId } from '../model/types.ts'

export type RenderItem =
  { type: 'char'; char: string } | { type: 'jamo'; key: JamoKey; layout: LayoutId }

/** SVG path 데이터 (1em = 1000, 위가 0인 화면 좌표) */
export type RenderedGlyph = { d: string; advance: number }

export type EngineMethods = {
  render: {
    payload: { project: FontProject; revision: number; items: RenderItem[] }
    result: RenderedGlyph[]
  }
  build: {
    payload: { project: FontProject; request: BuildRequest }
    result: BuildResult
    progress: BuildProgress
  }
  /** 만든 파일들을 ZIP 하나로 (굵기 여러 벌 내보내기) */
  zip: {
    payload: { entries: { name: string; data: ArrayBuffer }[] }
    result: ArrayBuffer
  }
}
