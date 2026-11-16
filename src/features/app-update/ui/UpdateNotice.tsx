import { Show } from 'solid-js'
import { flushProjectSave } from '@/entities/font'
import { assetLoadFailed } from '@/shared/lib/app-update'
import { Button } from '@/shared/ui/button'
import { Icon } from '@/shared/ui/icon'
import { NoticeActions, NoticeCard, NoticeMessage } from '@/shared/ui/notice-card'

export type UpdateNoticeViewProps = {
  /** 앱 파일을 받지 못했는지 */
  failed: boolean
  onReload: () => void
}

export const UPDATE_NOTICE_TEXT =
  '앱 파일을 받지 못했습니다. 새 버전이 나왔거나 연결이 끊겼을 수 있습니다. 작업은 자동 저장되어 있으니 새로 고쳐 주세요.'

/** 앱 파일을 받지 못했을 때의 새로 고침 안내 (경고 영역은 처음부터 DOM에, 버튼은 영역 밖) */
export function UpdateNoticeView(props: UpdateNoticeViewProps) {
  return (
    <NoticeCard active={props.failed}>
      <NoticeMessage role="alert">{props.failed ? UPDATE_NOTICE_TEXT : ''}</NoticeMessage>
      <Show when={props.failed}>
        <NoticeActions>
          <Button size="small" variant="primary" onClick={() => props.onReload()}>
            <Icon name="reset" size={16} />
            새로 고침
          </Button>
        </NoticeActions>
      </Show>
    </NoticeCard>
  )
}

/** 새로 고치기 전에 기다리던 자동 저장을 바로 씁니다. */
export function reloadApp(): void {
  flushProjectSave()
  location.reload()
}

export function UpdateNotice() {
  return <UpdateNoticeView failed={assetLoadFailed()} onReload={reloadApp} />
}
