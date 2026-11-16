import { Show, createSignal } from 'solid-js'
import { flushProjectSave, inPlaceUnreadableOnlyHere } from '@/entities/font'
import { assetLoadFailed } from '@/shared/lib/app-update'
import { Button } from '@/shared/ui/button'
import { Icon } from '@/shared/ui/icon'
import { NoticeActions, NoticeCard, NoticeMessage } from '@/shared/ui/notice-card'

/**
 * 새로 고치면 잃는 것.
 * changes: 자동 저장하지 못한 변경, unreadable: 이 탭에만 남은 원래 작업(읽지 못하고 보관하지도 못한 저장), both: 둘 다
 */
export type ReloadBlock = 'changes' | 'unreadable' | 'both'

export type UpdateNoticeViewProps = {
  /** 앱 파일을 받지 못했는지 */
  failed: boolean
  /** 새로 고치면 잃는 것이 있어 새로 고치지 않았으면 그 까닭 */
  blocked: ReloadBlock | null
  onReload: () => void
  /** 알린 까닭(blocked)의 것을 버리고 새로 고침 */
  onForceReload: () => void
}

export const UPDATE_NOTICE_TEXT =
  '앱 파일을 받지 못했습니다. 새 버전이 나왔거나 연결이 끊겼을 수 있습니다. 작업은 자동 저장되어 있으니 새로 고쳐 주세요.'

const BLOCKED: Record<ReloadBlock, { text: string; discard: string }> = {
  changes: {
    text: '자동 저장하지 못한 변경이 있어 새로 고치지 않았습니다. 작업실이나 내보내기에서 프로젝트 파일(.json)로 저장한 뒤 새로 고치거나, 그 변경을 버리고 새로 고치세요.',
    discard: '변경을 버리고 새로 고침',
  },
  unreadable: {
    text: "이 탭에만 남은 원래 작업(열지 못하고 보관하지도 못한 저장)이 있어 새로 고치지 않았습니다. 화면 아래 안내의 '원래 작업 받기'로 받아 둔 뒤 새로 고치거나, 원래 작업을 버리고 새로 고치세요.",
    discard: '원래 작업을 버리고 새로 고침',
  },
  both: {
    text: "자동 저장하지 못한 변경과 이 탭에만 남은 원래 작업(열지 못하고 보관하지도 못한 저장)이 있어 새로 고치지 않았습니다. 프로젝트 파일(.json)로 저장하고 화면 아래 안내의 '원래 작업 받기'로 받아 둔 뒤 새로 고치거나, 모두 버리고 새로 고치세요.",
    discard: '모두 버리고 새로 고침',
  },
}

/** 새로 고치지 않은 까닭과 할 일 */
export const reloadBlockedText = (block: ReloadBlock) => BLOCKED[block].text

/** 잃는 것을 버리고 새로 고치는 버튼의 이름 */
export const reloadDiscardLabel = (block: ReloadBlock) => BLOCKED[block].discard

/** 앱 파일을 받지 못했을 때의 새로 고침 안내 (경고 영역은 처음부터 DOM에, 버튼은 영역 밖) */
export function UpdateNoticeView(props: UpdateNoticeViewProps) {
  const text = () => {
    if (!props.failed) return ''
    return props.blocked ? reloadBlockedText(props.blocked) : UPDATE_NOTICE_TEXT
  }
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
            {(block) => (
              <Button size="small" variant="danger" onClick={() => props.onForceReload()}>
                <Icon name="reset" size={16} />
                {reloadDiscardLabel(block())}
              </Button>
            )}
          </Show>
        </NoticeActions>
      </Show>
    </NoticeCard>
  )
}

function lossOf(changes: boolean, unreadable: boolean): ReloadBlock | null {
  if (changes && unreadable) return 'both'
  if (changes) return 'changes'
  return unreadable ? 'unreadable' : null
}

/**
 * 새로 고치기 전에 기다리던(또는 실패한) 자동 저장을 바로 씁니다. 그래도 새로 고치면 잃는 것이 남으면
 * (저장 공간 초과로 쓰지 못한 변경, 이 탭에만 남은 원래 작업) 새로 고치지 않고 그 까닭을 돌려줍니다.
 * @param discard 사용자가 버리기로 확인한 까닭(화면에 알린 것). 그 뒤 새로 생긴 잃을 것이 있으면 버리지 않고
 *   늘어난 까닭을 돌려주어 다시 확인받습니다.
 */
export function reloadApp(discard: ReloadBlock | null = null): ReloadBlock | null {
  const loss = lossOf(!flushProjectSave(), inPlaceUnreadableOnlyHere())
  if (loss !== null && discard !== 'both' && discard !== loss) return loss
  location.reload()
  return null
}

export function UpdateNotice() {
  const [blocked, setBlocked] = createSignal<ReloadBlock | null>(null)
  return (
    <UpdateNoticeView
      failed={assetLoadFailed()}
      blocked={blocked()}
      onReload={() => setBlocked(reloadApp())}
      onForceReload={() => setBlocked(reloadApp(blocked()))}
    />
  )
}
