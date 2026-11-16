import { createEffect, createSignal, on, onCleanup } from 'solid-js'
import {
  discardUnreadableProject,
  projectSaveFailure,
  projectSavePausedByOtherTab,
  projectSyncedAt,
  unreadableProjectDownloaded,
  unreadableProjectState,
  unreadableProjectText,
} from '@/entities/font'
import { downloadFile } from '@/shared/lib/download'
import { AutosaveNotice } from './AutosaveNotice.tsx'

/** '불러왔습니다' 알림을 보여 주는 시간. 바뀐 결과는 화면에 남으므로 잠시만 둡니다. */
export const SYNCED_NOTICE_MS = 8000

/** 자동 저장 상태(다른 탭에서 불러옴, 저장 실패, 읽지 못해 보관한 작업)를 알립니다. */
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

  const download = () => {
    const text = unreadableProjectText()
    if (!text) return
    downloadFile(text, 'luminous-kr-unreadable-project.json', 'application/json')
    unreadableProjectDownloaded()
  }
  return (
    <AutosaveNotice
      synced={synced()}
      failure={projectSaveFailure()}
      unreadable={unreadableProjectState()}
      pausedByOtherTab={projectSavePausedByOtherTab()}
      onDownloadUnreadable={download}
      onDiscardUnreadable={discardUnreadableProject}
      onReload={() => location.reload()}
    />
  )
}
