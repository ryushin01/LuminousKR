import { Show, createSignal, onMount } from 'solid-js'
import {
  type ReloadBlock,
  reloadApp,
  reloadBlockedText,
  reloadDiscardLabel,
} from '@/features/app-update'
import { isAssetLoadError, reportAssetLoadFailure } from '@/shared/lib/app-update'
import { Button } from '@/shared/ui/button'
import { Icon } from '@/shared/ui/icon'
import { PageHeader } from '@/shared/ui/page-header'
import styles from './AppShell.module.css'

export type RouteErrorProps = {
  error: unknown
  reset: () => void
}

/**
 * 화면을 그리다 난 오류를 받는 곳(오류 경계의 대체 화면).
 * 앱 파일을 받지 못한 경우(배포 뒤 열린 탭, 연결 끊김)는 새로 고침을, 그 밖에는 다시 시도도 함께 보여 줍니다.
 */
export function RouteError(props: RouteErrorProps) {
  // 오류마다 대체 화면을 새로 그리므로 처음 값만 봅니다.
  // eslint-disable-next-line solid/reactivity
  const asset = isAssetLoadError(props.error)
  const [blocked, setBlocked] = createSignal<ReloadBlock | null>(null)
  const blockedText = () => {
    const block = blocked()
    return block ? reloadBlockedText(block) : ''
  }
  onMount(() => {
    if (asset) reportAssetLoadFailure()
    // 원인을 개발자 도구에서 볼 수 있게 남깁니다(서버가 없어 따로 모으지 않음).
    console.error(props.error)
  })
  return (
    <div class={styles.errorPage}>
      <PageHeader
        number="!"
        label="문제"
        title={asset ? '화면을 불러오지 못했습니다' : '화면을 그리다 문제가 생겼습니다'}
        lead={
          asset
            ? '새 버전이 나왔거나 연결이 끊겼을 수 있습니다. 작업은 자동 저장되어 있으니 새로 고쳐 주세요.'
            : '작업은 자동 저장되어 있습니다. 다시 시도해 보고, 계속되면 새로 고쳐 주세요.'
        }
      >
        {/* 새로 고치면 잃는 것이 있어 새로 고치지 않았을 때 (영역은 처음부터 두고 글자만 바꿈) */}
        <p role="alert" class={styles.errorAlert}>
          {blockedText()}
        </p>
        <div class={styles.errorActions}>
          <Show
            when={blocked()}
            fallback={
              <Button variant="primary" onClick={() => setBlocked(reloadApp())}>
                <Icon name="reset" size={18} />
                새로 고침
              </Button>
            }
          >
            {(block) => (
              <Button variant="danger" onClick={() => setBlocked(reloadApp(block()))}>
                <Icon name="reset" size={18} />
                {reloadDiscardLabel(block())}
              </Button>
            )}
          </Show>
          <Show when={!asset}>
            <Button variant="secondary" onClick={() => props.reset()}>
              다시 시도
            </Button>
          </Show>
        </div>
      </PageHeader>
    </div>
  )
}
