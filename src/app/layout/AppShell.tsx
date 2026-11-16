import { type RouteSectionProps, useLocation } from '@solidjs/router'
import { ErrorBoundary, Suspense, createEffect, on } from 'solid-js'
import { UpdateNotice } from '@/features/app-update'
import { AutosaveStatus } from '@/features/autosave-status'
import { motionPaused } from '@/shared/lib/motion'
import { CosmosBackdrop } from '@/widgets/cosmos-backdrop'
import { SiteHeader } from '@/widgets/site-header'
import { useUndoShortcuts } from '../lib/undoShortcuts.ts'
import styles from './AppShell.module.css'
import { RouteError } from './RouteError.tsx'
import { SiteFooter } from './SiteFooter.tsx'

/** 화면을 옮긴 뒤 새 화면의 제목(h1)으로 초점을 옮겨, 화면 낭독기가 바뀐 화면을 알 수 있게 합니다. */
function focusPageHeading(): void {
  requestAnimationFrame(() => {
    const heading = document.querySelector<HTMLElement>('main h1')
    if (!heading) return
    heading.setAttribute('tabindex', '-1')
    heading.focus({ preventScroll: true })
    window.scrollTo({ top: 0 })
  })
}

export function AppShell(props: RouteSectionProps) {
  const location = useLocation()
  let resetError: (() => void) | undefined
  createEffect(
    on(
      () => location.pathname,
      () => {
        // 오류 화면에서 다른 화면으로 옮기면 오류 경계를 풀어 새 화면을 그립니다.
        resetError?.()
        resetError = undefined
        focusPageHeading()
      },
      { defer: true },
    ),
  )
  useUndoShortcuts()

  const skipToMain = (event: MouseEvent) => {
    event.preventDefault()
    document.getElementById('main')?.focus()
  }

  return (
    <div class={styles.shell}>
      <a class={styles.skip} href="#main" onClick={skipToMain}>
        본문 바로가기
      </a>
      <CosmosBackdrop dim={location.pathname === '/' ? 1 : 0.42} paused={motionPaused()} />
      <SiteHeader />
      <main id="main" class={styles.main} tabindex="-1">
        <Suspense fallback={<p class={styles.loading}>화면을 불러오는 중입니다…</p>}>
          <ErrorBoundary
            fallback={(error, reset) => {
              resetError = reset
              return <RouteError error={error} reset={reset} />
            }}
          >
            {props.children}
          </ErrorBoundary>
        </Suspense>
      </main>
      <SiteFooter />
      {/* 화면 아래에 떠서 내용을 밀어내지 않는 알림들 */}
      <div class={styles.notices}>
        <UpdateNotice />
        <AutosaveStatus />
      </div>
    </div>
  )
}
