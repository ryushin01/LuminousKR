import { onMount } from 'solid-js'
import { documentTitle } from '@/shared/config'

/** 화면마다 문서 제목을 바꿉니다 (KWCAG 6.4.2 제목 제공). */
export function usePageTitle(title: string): void {
  onMount(() => {
    document.title = documentTitle(title)
  })
}
