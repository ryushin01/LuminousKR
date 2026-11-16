import { Show } from 'solid-js'
import { Button } from '@/shared/ui/button'
import { Icon } from '@/shared/ui/icon'
import styles from './AutosaveNotice.module.css'

export type SaveFailure = 'quota' | 'unavailable'

export type AutosaveNoticeProps = {
  /** 다른 탭에서 바뀐 작업을 방금 불러왔는지 */
  synced: boolean
  /** 마지막 자동 저장이 실패한 까닭 */
  failure: SaveFailure | null
  /**
   * 읽지 못한 저장. kept: 따로 보관함, paused: 보관하지 못해 받거나 버리기 전까지 자동 저장을 멈춤,
   * memory: 보관하지 못했고 이 탭에서만 받을 수 있음(닫으면 사라짐), null: 없음
   */
  unreadable: 'kept' | 'paused' | 'memory' | null
  /** 다른 탭이 이 탭이 읽지 못하는 형식으로 저장해 자동 저장을 멈췄는지 */
  pausedByOtherTab: boolean
  onDownloadUnreadable: () => void
  onDiscardUnreadable: () => void
  onReload: () => void
}

const FAILURE_TEXT: Record<SaveFailure, string> = {
  quota:
    '자동 저장하지 못했습니다. 이 브라우저의 저장 공간이 가득 찼습니다. 작업을 잃지 않도록 작업실이나 내보내기에서 프로젝트 파일(.json)로 저장해 두세요.',
  unavailable:
    '자동 저장하지 못했습니다. 브라우저가 저장 공간을 막고 있습니다(사생활 보호 설정 등). 작업을 잃지 않도록 작업실이나 내보내기에서 프로젝트 파일(.json)로 저장해 두세요.',
}

const UNREADABLE_TEXT = {
  kept: '저장된 작업을 열지 못해 기본 글꼴로 시작했습니다. 원래 작업은 지우지 않고 따로 보관했으니 받아 두세요.',
  paused:
    '저장된 작업을 열지 못해 기본 글꼴로 시작했습니다. 저장 공간이 모자라 원래 작업을 따로 보관하지 못해, 받거나 버리기 전까지 자동 저장을 멈춥니다.',
  memory:
    '저장된 작업을 열지 못해 기본 글꼴로 시작했습니다. 원래 작업은 따로 보관하지 못해 이 탭을 닫으면 사라지니 받아 두세요.',
} as const

const UNREADABLE_LABEL = {
  kept: { download: '보관한 작업 받기', discard: '보관한 작업 지우기' },
  paused: { download: '원래 작업 받기', discard: '원래 작업 버리기' },
  memory: { download: '원래 작업 받기', discard: '원래 작업 버리기' },
} as const

const OTHER_TAB_TEXT =
  '다른 탭이 이 탭에서 읽지 못하는 형식으로 작업을 저장했습니다(더 새 버전일 수 있음). 그 작업을 덮어쓰지 않도록 이 탭의 자동 저장을 멈췄습니다. 이 탭의 작업이 필요하면 프로젝트 파일로 저장한 뒤 새로 고쳐 주세요.'

const SYNCED_TEXT =
  '다른 탭에서 바뀐 작업을 불러왔습니다. 이 탭의 되돌리기 기록은 여기서 새로 시작합니다.'

/**
 * 자동 저장 알림. 화면 아래쪽에 떠서 내용을 밀어내지 않습니다.
 * 상태(불러옴)와 경고(저장 실패, 보관한 작업) 영역은 처음부터 DOM에 두고 글자만 바꿉니다.
 */
export function AutosaveNotice(props: AutosaveNoticeProps) {
  const alertText = () =>
    [
      props.pausedByOtherTab ? OTHER_TAB_TEXT : '',
      props.failure ? FAILURE_TEXT[props.failure] : '',
      props.unreadable ? UNREADABLE_TEXT[props.unreadable] : '',
    ]
      .filter(Boolean)
      .join(' ')
  const active = () => props.synced || alertText() !== ''

  return (
    <div class={styles.root}>
      <div class={styles.card} classList={{ [styles.active!]: active() }}>
        <p role="status" class={styles.text}>
          {props.synced ? SYNCED_TEXT : ''}
        </p>
        <p role="alert" class={`${styles.text} ${styles.danger}`}>
          {alertText()}
        </p>
        <Show when={props.pausedByOtherTab}>
          <div class={styles.actions}>
            <Button size="small" variant="primary" onClick={() => props.onReload()}>
              <Icon name="reset" size={16} />
              새로 고침
            </Button>
          </div>
        </Show>
        <Show when={props.unreadable}>
          {(state) => (
            <div class={styles.actions}>
              <Button size="small" variant="secondary" onClick={() => props.onDownloadUnreadable()}>
                <Icon name="download" size={16} />
                {UNREADABLE_LABEL[state()].download}
              </Button>
              <Button size="small" variant="ghost" onClick={() => props.onDiscardUnreadable()}>
                <Icon name="trash" size={16} />
                {UNREADABLE_LABEL[state()].discard}
              </Button>
            </div>
          )}
        </Show>
      </div>
    </div>
  )
}
