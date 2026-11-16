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
  /** 읽지 못해 보관해 둔 저장이 있는지 */
  unreadable: boolean
  onDownloadUnreadable: () => void
  onDiscardUnreadable: () => void
}

const FAILURE_TEXT: Record<SaveFailure, string> = {
  quota:
    '자동 저장하지 못했습니다. 이 브라우저의 저장 공간이 가득 찼습니다. 작업을 잃지 않도록 작업실이나 내보내기에서 프로젝트 파일(.json)로 저장해 두세요.',
  unavailable:
    '자동 저장하지 못했습니다. 브라우저가 저장 공간을 막고 있습니다(사생활 보호 설정 등). 작업을 잃지 않도록 작업실이나 내보내기에서 프로젝트 파일(.json)로 저장해 두세요.',
}

const UNREADABLE_TEXT =
  '저장된 작업을 열지 못해 기본 글꼴로 시작했습니다. 원래 작업은 지우지 않고 따로 보관했으니 받아 두세요.'

const SYNCED_TEXT =
  '다른 탭에서 바뀐 작업을 불러왔습니다. 이 탭의 되돌리기 기록은 여기서 새로 시작합니다.'

/**
 * 자동 저장 알림. 화면 아래쪽에 떠서 내용을 밀어내지 않습니다.
 * 상태(불러옴)와 경고(저장 실패, 보관한 작업) 영역은 처음부터 DOM에 두고 글자만 바꿉니다.
 */
export function AutosaveNotice(props: AutosaveNoticeProps) {
  const alertText = () =>
    [props.failure ? FAILURE_TEXT[props.failure] : '', props.unreadable ? UNREADABLE_TEXT : '']
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
        <Show when={props.unreadable}>
          <div class={styles.actions}>
            <Button size="small" variant="secondary" onClick={() => props.onDownloadUnreadable()}>
              <Icon name="download" size={16} />
              보관한 작업 받기
            </Button>
            <Button size="small" variant="ghost" onClick={() => props.onDiscardUnreadable()}>
              <Icon name="trash" size={16} />
              보관한 작업 지우기
            </Button>
          </div>
        </Show>
      </div>
    </div>
  )
}
