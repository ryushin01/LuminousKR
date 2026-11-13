import { type Accessor, createEffect, createSignal, on, onCleanup } from 'solid-js'
import { isCompatJamoCode, isSyllableCode } from '@/shared/lib/hangul'
import { buildPreviewFont } from '../api/engine-client.ts'
import { type RenderSource, currentSource } from './rendered.ts'

export type PreviewFontState = 'building' | 'ready' | 'error'

let familySeq = 0

/** 글에 쓰인 한글 음절·자모만 중복 없이 뽑습니다. */
export function composableChars(text: string): string {
  const seen = new Set<string>()
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    if (isSyllableCode(code) || isCompatJamoCode(code)) seen.add(char)
  }
  return [...seen].join('')
}

/**
 * 입력한 글에 쓰인 글자만 담은 진짜 글꼴 파일(OTF)을 워커에서 만들어
 * FontFace로 등록합니다. 브라우저가 이 파일로 줄바꿈·글자 사이를 직접 처리합니다.
 */
export function createPreviewFont(
  text: Accessor<string>,
  source: Accessor<RenderSource> = currentSource,
) {
  const [family, setFamily] = createSignal<string>()
  const [state, setState] = createSignal<PreviewFontState>('building')
  const [glyphCount, setGlyphCount] = createSignal(0)
  const [bytes, setBytes] = createSignal(0)
  let current: FontFace | undefined
  let latest = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  const rebuild = () => {
    clearTimeout(timer)
    timer = setTimeout(async () => {
      const token = ++latest
      setState('building')
      try {
        const { project } = source()
        const result = await buildPreviewFont(project, composableChars(text()))
        if (token !== latest) return
        familySeq += 1
        const name = `Luminous Preview ${familySeq}`
        const face = new FontFace(name, result.otf)
        await face.load()
        if (token !== latest) return
        document.fonts.add(face)
        if (current) document.fonts.delete(current)
        current = face
        setFamily(name)
        setGlyphCount(result.glyphCount)
        setBytes(result.otf.byteLength)
        setState('ready')
      } catch {
        if (token === latest) setState('error')
      }
    }, 220)
  }

  createEffect(on([text, () => source().revision], rebuild))
  onCleanup(() => {
    clearTimeout(timer)
    latest += 1
    if (current) document.fonts.delete(current)
  })

  return { family, state, glyphCount, bytes }
}
