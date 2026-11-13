# 개발 가이드

## 구조

[Feature-Sliced Design v2.1](https://feature-sliced.design) 계층을 따르고 `pnpm lint:fsd`(Steiger)로 검사합니다. 슬라이스는 공개 API(`index.ts`)로만 가져옵니다.

| 계층 | 슬라이스 | 하는 일 |
|---|---|---|
| app | (세그먼트) `routes`, `layout`, `styles` | 라우터, 본문 바로가기·배경·머리글·바닥글, 전역 스타일과 제목 글꼴 |
| pages | home, studio, import, preview, export, guide, not-found | 화면. 한 화면에서만 쓰는 코드는 그 화면 슬라이스 안에 둡니다 (예: 그리기 판 편집기, 손글씨 양식·인식 워커) |
| widgets | site-header, cosmos-backdrop | 머리글과 전체 메뉴(`<dialog>`), WebGL 배경 |
| features | adjust-style, manage-project | 획 스타일 조절, 프로젝트 저장·열기 (작업실·미리보기·내보내기에서 함께 씀) |
| entities | font | 자모 모델·배치·파생 규칙, 조합 엔진, 조합 워커, 글리프 표시 |
| shared | lib(hangul, geometry, font-file, pdf, image, worker-rpc …), ui, config | 업무와 무관한 도구와 공용 UI |

경로 별칭은 `@/` → `src/`입니다. 같은 슬라이스 안에서는 확장자를 붙인 상대 경로(`./layout.ts`)로 가져옵니다.

## 명령

| 명령 | 설명 |
|---|---|
| `pnpm dev` | 개발 서버 (`http://localhost:5173`) |
| `pnpm build` | 프로덕션 빌드 + 화면별 HTML 사본(`scripts/postbuild.mjs`) |
| `pnpm build:all` | 앱 빌드 뒤 Storybook을 `dist/storybook`에 빌드 |
| `pnpm preview` | 빌드 결과 띄우기 (`http://localhost:4173`) |
| `pnpm lint` / `lint:fsd` / `format:check` / `typecheck` | ESLint / Steiger / Prettier / TypeScript |
| `pnpm test` | Vitest 단위·화면 테스트 |
| `pnpm test:e2e` | Playwright E2E (먼저 `build:all`) |
| `pnpm storybook` | Storybook 개발 서버 |
| `pnpm fonts:display` | 제목용 글꼴 다시 만들기 |
| `node scripts/screenshots.mjs` | README 화면 사진 다시 찍기 (먼저 `build`) |

## 테스트

- **엔진**: 한글 조합표, 곡선 맞춤(원·사각형·둥근 끝), 스플라인, OTF 쓰기와 다시 읽기, WOFF 규격·압축 해제 비교, 워커 RPC(진행·오류·취소), 배치·파생 규칙, 획 두께가 틀 크기와 무관한지, 음절 윤곽이 글자 틀 안에 드는지, 프로젝트 파일 검사·되돌리기.
- **인식**: 합성한 양식 그림(원근·기울기·한쪽이 어두운 조명·뒤집힘)에서 양식 번호와 칸별 획 인식, 세선화·뼈대 추적(꺾임·교차·고리), 호모그래피, 적응형 이진화, PDF 교차 참조 표, 양식 비트, 가져오기 적용·되돌리기.
- **화면**: 그리기 편집기(점 찍기·닫힌 획·원·취소·옮기기·자동 자모 가져오기·배치 변형), 내보내기(두 번 눌러도 한 번만, 실패·취소 처리, 입력 검사), 탭 키보드 조작, 입력칸 오류 연결, 메뉴 대화상자 초점 복귀.
- **E2E**(프로덕션 빌드): 모든 화면 axe(WCAG 2.2 AA 태그) 위반 없음, 화면 폭 320~1440px 가로 넘침 없음, 본문 바로가기, 메뉴 초점 가두기와 복귀, 키보드만으로 그리기, 포인터 그리기와 되돌리기, 자동 저장, 11,172자 OTF·WOFF 내려받아 서명(`OTTO`·`wOFF`) 확인, 미리보기 글꼴과 588자 표, Storybook 모든 스토리 axe 검사, 앱이 만든 양식 PDF를 다시 올려 pdf.js로 알아보기, 손으로 채운 양식 사진을 인식해 적용하기, 배경 움직임 멈춤 버튼.

jsdom에는 Web Worker가 없어 `vitest.setup.ts`에서 답하지 않는 워커로 둡니다. 실제 워커 동작은 E2E에서 확인합니다. E2E는 `reducedMotion: 'reduce'`로 돌려 소프트웨어 WebGL 배경이 CPU를 차지하지 않게 합니다(앱은 이 설정이면 배경을 멈춤).

## 제목용 글꼴

화면의 한글 제목은 이 앱의 조합기가 기본 프리셋을 조금 굵게(96단위) 만든 **Luminous Display**로 그립니다(`src/app/styles/fonts/luminous-display.woff`). 화면 문구(주석 제외)에 쓰인 음절만 담아 약 19KB입니다. 문구를 바꾸면 `pnpm fonts:display`로 다시 만드세요. 빠진 글자가 있으면 `display-font.test.ts`가 실패합니다.

## 접근성 점검

KWCAG 2.2 항목을 직접 확인한 내용입니다.

| 항목 | 처리 |
|---|---|
| 5.1.1 대체 텍스트 | 글리프 그림은 숨기고 글자를 숨긴 텍스트로 함께 둠, WebGL 배경·진행 그림은 꾸밈(aria-hidden) |
| 5.3.1 표 구성 | 588자 표·규칙 표에 caption·scope, 가로 스크롤 영역에 이름과 tabindex |
| 5.4.3 명도 대비 | 모든 글자색 4.5:1 이상(토큰 계산), 선택된 밝은 칸 위 꼬리표 색 보정 |
| 6.1.1 키보드 | 그리기 판(application 역할)에서 화살표·스페이스·Enter·Esc·Delete, 획 옮기기 버튼, APG 탭 |
| 6.1.2 초점 | 화면을 옮기면 새 화면 h1로 초점, 메뉴를 닫으면 여는 버튼으로 복귀, 만드는 중에도 버튼 초점 유지(aria-disabled) |
| 6.1.4 문자 단축키 | 글자 하나 단축키는 그리기 판에 초점이 있을 때만 |
| 6.2.2 정지 | 배경 움직임 멈추기 버튼, 운영체제 '동작 줄이기'면 처음부터 멈춤 |
| 6.4.1 반복 영역 건너뛰기 | 본문 바로가기 |
| 6.4.2 제목 | 화면마다 문서 제목, 정적 HTML 사본에도 제목 |
| 6.5.1 단일 포인터 | 점은 누르기만으로 찍고, 끌기(꼭짓점 이동)는 버튼으로도 가능 |
| 7.3.1 오류 정정 | aria-invalid(잘못된 값일 때만) + aria-describedby·aria-errormessage, 원인과 고치는 방법, 첫 오류 칸으로 초점 |

화면 낭독기로 직접 들어 보는 확인(VoiceOver, NVDA)은 사람이 해야 합니다.
