import { Show, createSignal } from 'solid-js'
import { flushProjectSave } from '@/entities/font'
import { assetLoadFailed } from '@/shared/lib/app-update'
import { Button } from '@/shared/ui/button'
import { Icon } from '@/shared/ui/icon'
import { NoticeActions, NoticeCard, NoticeMessage } from '@/shared/ui/notice-card'

export type UpdateNoticeViewProps = {
  /** 앱 파일을 받지 못했는지 */
  failed: boolean
  /** 저장하지 못한 변경이 있어 새로 고치지 않았는지 */
  blocked: boolean
  onReload: () => void
  /** 저장하지 못한 변경을 버리고 새로 고침 */
  onForceReload: () => void
}

export const UPDATE_NOTICE_TEXT =
  '앱 파일을 받지 못했습니다. 새 버전이 나왔거나 연결이 끊겼을 수 있습니다. 작업은 자동 저장되어 있으니 새로 고쳐 주세요.'

export const RELOAD_BLOCKED_TEXT =
  '자동 저장하지 못한 변경이 있어 새로 고치지 않았습니다. 작업실이나 내보내기에서 프로젝트 파일(.json)로 저장한 뒤 새로 고치거나, 그 변경을 버리고 새로 고치세요.'

/** 앱 파일을 받지 못했을 때의 새로 고침 안내 (경고 영역은 처음부터 DOM에, 버튼은 영역 밖) */
export function UpdateNoticeView(props: UpdateNoticeViewProps) {
  const text = () =>
    props.failed ? (props.blocked ? RELOAD_BLOCKED_TEXT : UPDATE_NOTICE_TEXT) : ''
  return (
    <NoticeCard active={props.failed}>
      <NoticeMessage role="alert">{text()}</NoticeMessage>
      <Show when={props.failed}>
        <NoticeActions>
          <Show
            when={props.blocked}
            fallback={
              <Button size="small" variant="primary" onClick={() => props.onReload()}>
                <Icon name="reset" size={16} />
                새로 고침
              </Button>
            }
          >
            <Button size="small" variant="danger" onClick={() => props.onForceReload()}>
              <Icon name="reset" size={16} />
              변경을 버리고 새로 고침
            </Button>
          </Show>
        </NoticeActions>
      </Show>
    </NoticeCard>
  )
}

/**
 * 새로 고치기 전에 기다리던(또는 실패한) 자동 저장을 바로 씁니다. 저장하지 못한 변경이 남으면
 * 새로 고치지 않고 false를 돌려줍니다(저장 공간 초과 등). force면 그 변경을 버리고 새로 고칩니다.
 */
export function reloadApp(force = false): boolean {
  if (!flushProjectSave() && !force) return false
  location.reload()
  return true
}

export function UpdateNotice() {
  const [blocked, setBlocked] = createSignal(false)
  return (
    <UpdateNoticeView
      failed={assetLoadFailed()}
      blocked={blocked()}
      onReload={() => setBlocked(!reloadApp())}
      onForceReload={() => reloadApp(true)}
    />
  )
}
