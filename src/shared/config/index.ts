export const APP_NAME = 'LuminousKR'
export const APP_SUBTITLE = '한글 모듈 글꼴 조합기'
export const APP_VERSION: string = __APP_VERSION__
export const REPO_URL = 'https://github.com/ryushin01/LuminousKR'

export type NavItem = {
  number: string
  path: string
  label: string
  description: string
  /** 문서 제목(title)에 쓰는 이름 */
  title: string
}

/** 전체 메뉴 (참고 디자인처럼 번호를 붙인 화면 목록) */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    number: '01',
    path: '/',
    label: '홈',
    description: '11,172자가 빛나는 곳',
    title: '한글 모듈 글꼴 조합기',
  },
  {
    number: '02',
    path: '/studio',
    label: '작업실',
    description: '자모의 뼈대 획 그리기',
    title: '작업실',
  },
  {
    number: '03',
    path: '/preview',
    label: '미리보기',
    description: '글과 11,172자 둘러보기',
    title: '미리보기',
  },
  {
    number: '04',
    path: '/export',
    label: '내보내기',
    description: 'OTF·WOFF 글꼴 파일 만들기',
    title: '내보내기',
  },
  {
    number: '05',
    path: '/guide',
    label: '안내',
    description: '조합 원리와 키보드 조작',
    title: '안내',
  },
]

export function documentTitle(page: string): string {
  return page === NAV_ITEMS[0]!.title ? `${APP_NAME} — ${page}` : `${page} — ${APP_NAME}`
}
