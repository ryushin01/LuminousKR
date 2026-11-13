import { APP_NAME, APP_VERSION, REPO_URL } from '@/shared/config'
import { motionPaused, setMotionPaused } from '@/shared/lib/motion'
import { Button } from '@/shared/ui/button'
import { Icon } from '@/shared/ui/icon'
import styles from './AppShell.module.css'

export function SiteFooter() {
  return (
    <footer class={styles.footer}>
      <p class={styles.footerText}>
        <span class="numeric">
          {APP_NAME} v{APP_VERSION}
        </span>
        <span aria-hidden="true"> · </span>
        만든 글꼴과 그 권리는 만든 사람의 것입니다. 그림과 글꼴은 이 브라우저 안에서만 처리하고
        어디에도 보내지 않습니다.
      </p>
      <div class={styles.footerActions}>
        {/* 글자가 '멈추기/재생'으로 바뀌므로 aria-pressed는 쓰지 않습니다. */}
        <Button variant="ghost" size="small" onClick={() => setMotionPaused(!motionPaused())}>
          <Icon name={motionPaused() ? 'play' : 'pause'} size={16} />
          {motionPaused() ? '배경 움직임 재생' : '배경 움직임 멈추기'}
        </Button>
        <a class={styles.footerLink} href={REPO_URL} target="_blank" rel="noopener noreferrer">
          GitHub
          <span class="visually-hidden">(새 창)</span>
        </a>
      </div>
    </footer>
  )
}
