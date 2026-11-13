import { A, useLocation } from '@solidjs/router'
import { For, createEffect, createUniqueId, on } from 'solid-js'
import { APP_VERSION, NAV_ITEMS, REPO_URL } from '@/shared/config'
import { Button } from '@/shared/ui/button'
import { Icon } from '@/shared/ui/icon'
import { LogoMark } from '@/shared/ui/logo'
import styles from './SiteHeader.module.css'

/** 화면 위쪽에 늘 보이는 짧은 단계 링크 (넓은 화면) */
const QUICK_LINKS = NAV_ITEMS.filter((item) =>
  ['/studio', '/import', '/preview', '/export'].includes(item.path),
)

function Brand() {
  return (
    <A href="/" end class={styles.brand}>
      <LogoMark size={34} />
      <span class={styles.wordmark}>
        Luminous<span class={styles.kr}>KR</span>
      </span>
      <span class="visually-hidden"> 홈</span>
    </A>
  )
}

/**
 * 머리글: 로고, 단계 링크, 전체 메뉴 버튼.
 * 전체 메뉴는 네이티브 <dialog>(showModal)라 초점 가두기·Esc·배경 비활성화가 따라옵니다.
 */
export function SiteHeader() {
  const location = useLocation()
  const titleId = createUniqueId()
  let dialog!: HTMLDialogElement
  let toggle!: HTMLButtonElement

  const openMenu = () => dialog.showModal()
  const closeMenu = () => dialog.close()

  // 메뉴에서 화면을 옮기면 닫습니다.
  createEffect(
    on(
      () => location.pathname,
      () => dialog?.open && dialog.close(),
      { defer: true },
    ),
  )

  return (
    <header class={styles.header}>
      <Brand />
      <nav class={styles.quick} aria-label="작업 단계">
        <ul class={styles.quickList}>
          <For each={QUICK_LINKS}>
            {(item) => (
              <li>
                <A href={item.path} class={styles.quickLink}>
                  <span class={`${styles.quickNumber} numeric`} aria-hidden="true">
                    {item.number}
                  </span>
                  {item.label}
                </A>
              </li>
            )}
          </For>
        </ul>
      </nav>
      <Button ref={toggle} variant="orbit" aria-haspopup="dialog" onClick={openMenu}>
        <Icon name="menu" size={22} />
        <span class="visually-hidden">전체 메뉴 열기</span>
      </Button>

      <dialog
        ref={dialog}
        class={styles.menu}
        aria-labelledby={titleId}
        onClose={() => toggle.focus()}
      >
        <div class={styles.menuTop}>
          <Brand />
          <Button variant="orbit" onClick={closeMenu}>
            <Icon name="close" size={22} />
            <span class="visually-hidden">전체 메뉴 닫기</span>
          </Button>
        </div>
        <nav class={styles.menuNav} aria-labelledby={titleId}>
          <h2 id={titleId} class="visually-hidden">
            전체 메뉴
          </h2>
          <ul class={styles.menuList}>
            <For each={NAV_ITEMS}>
              {(item) => (
                <li>
                  <A href={item.path} end={item.path === '/'} class={styles.menuLink}>
                    <span class={`${styles.menuNumber} numeric`}>{item.number}</span>
                    <span class={styles.menuLabel}>{item.label}</span>
                    <span class={styles.menuDescription}>{item.description}</span>
                  </A>
                </li>
              )}
            </For>
          </ul>
        </nav>
        <div class={styles.menuFooter}>
          <span class="numeric">v{APP_VERSION}</span>
          <a class={styles.repoLink} href={REPO_URL} target="_blank" rel="noopener noreferrer">
            GitHub 저장소
            <Icon name="external" size={14} />
            <span class="visually-hidden">(새 창)</span>
          </a>
        </div>
      </dialog>
    </header>
  )
}
