import { createEffect, createSignal, on, onCleanup } from 'solid-js'
import {
  discardInPlaceUnreadable,
  discardKeptUnreadable,
  inPlaceUnreadableState,
  inPlaceUnreadableText,
  keptUnreadableTexts,
  projectSaveFailure,
  projectSavePausedByOtherTab,
  projectSyncedAt,
} from '@/entities/font'
import { downloadFile } from '@/shared/lib/download'
import { AutosaveNotice } from './AutosaveNotice.tsx'

/** '불러왔습니다' 알림을 보여 주는 시간. 바뀐 결과는 화면에 남으므로 잠시만 둡니다. */
export const SYNCED_NOTICE_MS = 8000

const saveJson = (text: string, name: string) => downloadFile(text, name, 'application/json')

/** 자동 저장 상태(다른 탭에서 불러옴, 저장 실패, 멈춤, 읽지 못한 작업)를 알립니다. */
export function AutosaveStatus() {
  const [synced, setSynced] = createSignal(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  createEffect(
    on(
      projectSyncedAt,
      (at) => {
        if (!at) return
        setSynced(true)
        clearTimeout(timer)
        timer = setTimeout(() => setSynced(false), SYNCED_NOTICE_MS)
      },
      { defer: true },
    ),
  )
  onCleanup(() => clearTimeout(timer))

  const downloadKept = (index: number) => {
    const texts = keptUnreadableTexts()
    const text = texts[index]
    if (text === undefined) return
    const suffix = texts.length > 1 ? `-${index + 1}` : ''
    saveJson(text, `luminous-kr-kept-project${suffix}.json`)
  }
  const downloadInPlace = () => {
    const text = inPlaceUnreadableText()
    if (text !== null) saveJson(text, 'luminous-kr-unreadable-project.json')
  }

  return (
    <AutosaveNotice
      synced={synced()}
      failure={projectSaveFailure()}
      keptCount={keptUnreadableTexts().length}
      inPlace={inPlaceUnreadableState()}
      pausedByOtherTab={projectSavePausedByOtherTab()}
      onDownloadKept={downloadKept}
      onDiscardKept={discardKeptUnreadable}
      onDownloadInPlace={downloadInPlace}
      onDiscardInPlace={discardInPlaceUnreadable}
      onReload={() => location.reload()}
    />
  )
}
