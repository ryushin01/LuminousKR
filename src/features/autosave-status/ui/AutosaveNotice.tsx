import { For, Show } from 'solid-js'
import { Button } from '@/shared/ui/button'
import { Icon } from '@/shared/ui/icon'
import { NoticeActions, NoticeCard, NoticeMessage } from '@/shared/ui/notice-card'

export type SaveFailure = 'quota' | 'unavailable'

export type AutosaveNoticeProps = {
  /** 다른 탭에서 바뀐 작업을 방금 불러왔는지 */
  synced: boolean
  /** 마지막 자동 저장이 실패한 까닭 */
  failure: SaveFailure | null
  /** 따로 보관한 읽지 못한 원문 수 */
  keptCount: number
  /**
   * 보관하지 못한 읽지 못한 원문. paused: 버리기 전까지 자동 저장을 멈춤,
   * memory: 이 탭에만 있음(닫으면 사라짐), null: 없음
   */
  inPlace: 'paused' | 'memory' | null
  /** 다른 탭이 이 탭이 읽지 못하는 형식으로 저장해 자동 저장을 멈췄는지 */
  pausedByOtherTab: boolean
  onDownloadKept: (index: number) => void
  onDiscardKept: () => void
  onDownloadInPlace: () => void
  onDiscardInPlace: () => void
  onReload: () => void
}

const FAILURE_TEXT: Record<SaveFailure, string> = {
  quota:
    '자동 저장하지 못했습니다. 이 브라우저의 저장 공간이 가득 찼습니다. 작업을 잃지 않도록 작업실이나 내보내기에서 프로젝트 파일(.json)로 저장해 두세요.',
  unavailable:
    '자동 저장하지 못했습니다. 브라우저가 저장 공간을 막고 있습니다(사생활 보호 설정 등). 작업을 잃지 않도록 작업실이나 내보내기에서 프로젝트 파일(.json)로 저장해 두세요.',
}

const KEPT_TEXT =
  '저장된 작업을 열지 못해 기본 글꼴로 시작했습니다. 원래 작업은 지우지 않고 따로 보관했으니 받아 두세요.'

const IN_PLACE_TEXT = {
  paused:
    "저장된 작업을 열지 못해 기본 글꼴로 시작했습니다. 저장 공간이 모자라 원래 작업을 따로 보관하지 못해 자동 저장을 멈췄습니다. 원래 작업을 받아 두고 '원래 작업 버리기'를 누르면 다시 저장합니다.",
  memory:
    '저장된 작업을 열지 못했는데 저장 공간이 모자라 따로 보관하지 못했습니다. 원래 작업은 이 탭을 닫으면 사라지니 받아 두세요.',
} as const

const OTHER_TAB_TEXT =
  '다른 탭이 이 탭에서 읽지 못하는 형식으로 작업을 저장했습니다(더 새 버전일 수 있음). 그 작업을 덮어쓰지 않도록 이 탭의 자동 저장을 멈췄습니다. 이 탭의 작업이 필요하면 프로젝트 파일로 저장한 뒤 새로 고쳐 주세요.'

const SYNCED_TEXT =
  '다른 탭에서 바뀐 작업을 불러왔습니다. 이 탭의 되돌리기 기록은 여기서 새로 시작합니다.'

/**
 * 자동 저장 알림. 상태(불러옴)와 경고(저장 실패, 멈춤, 읽지 못한 작업) 영역은 처음부터 DOM에 두고 글자만 바꿉니다.
 * 원문은 하나씩 받습니다(한 번에 여러 파일을 받으면 브라우저가 막을 수 있음).
 */
export function AutosaveNotice(props: AutosaveNoticeProps) {
  const alertText = () =>
    [
      props.pausedByOtherTab ? OTHER_TAB_TEXT : '',
      props.failure ? FAILURE_TEXT[props.failure] : '',
      props.inPlace ? IN_PLACE_TEXT[props.inPlace] : '',
      props.keptCount > 0 ? KEPT_TEXT : '',
    ]
      .filter(Boolean)
      .join(' ')
  const keptLabel = (index: number) =>
    props.keptCount > 1 ? `보관한 작업 ${index + 1} 받기` : '보관한 작업 받기'

  return (
    <NoticeCard active={props.synced || alertText() !== ''}>
      <NoticeMessage role="status">{props.synced ? SYNCED_TEXT : ''}</NoticeMessage>
      <NoticeMessage role="alert" tone="danger">
        {alertText()}
      </NoticeMessage>
      <Show when={props.pausedByOtherTab}>
        <NoticeActions>
          <Button size="small" variant="primary" onClick={() => props.onReload()}>
            <Icon name="reset" size={16} />
            새로 고침
          </Button>
        </NoticeActions>
      </Show>
      <Show when={props.inPlace}>
        <NoticeActions>
          <Button size="small" variant="secondary" onClick={() => props.onDownloadInPlace()}>
            <Icon name="download" size={16} />
            원래 작업 받기
          </Button>
          <Button size="small" variant="ghost" onClick={() => props.onDiscardInPlace()}>
            <Icon name="trash" size={16} />
            원래 작업 버리기
          </Button>
        </NoticeActions>
      </Show>
      <Show when={props.keptCount > 0}>
        <NoticeActions>
          <For each={Array.from({ length: props.keptCount }, (_, i) => i)}>
            {(index) => (
              <Button size="small" variant="secondary" onClick={() => props.onDownloadKept(index)}>
                <Icon name="download" size={16} />
                {keptLabel(index)}
              </Button>
            )}
          </For>
          <Button size="small" variant="ghost" onClick={() => props.onDiscardKept()}>
            <Icon name="trash" size={16} />
            보관한 작업 지우기
          </Button>
        </NoticeActions>
      </Show>
    </NoticeCard>
  )
}
