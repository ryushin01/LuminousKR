# CI · 배포

## CI (`.github/workflows/ci.yml`)

pull request와 main push마다 실행합니다. 같은 브랜치에 새 커밋이 오면 이전 실행은 취소합니다.

1. `pnpm install --frozen-lockfile` (pnpm 버전은 `packageManager`, Node는 `.nvmrc`)
2. `pnpm lint` → `lint:fsd` → `format:check` → `typecheck` → `test`
3. `pnpm build:all` (앱 + Storybook)
4. Playwright Chromium 설치 후 `pnpm test:e2e` (실패하면 보고서와 추적 파일을 7일 보관)

pnpm 12는 허용하지 않은 의존성의 빌드 스크립트가 있으면 CI 설치를 실패로 끝냅니다. 의존성을 추가한 뒤 `pnpm ignored-builds`로 확인하고 필요한 것만 `pnpm approve-builds <패키지>`로 `pnpm-workspace.yaml`의 `allowBuilds`에 넣습니다(지금은 esbuild만).

## GitHub Pages (`.github/workflows/pages.yml`)

main에 push하면 `BASE_PATH=/LuminousKR/`로 빌드해 배포합니다.

- 앱: https://ryushin01.github.io/LuminousKR/
- Storybook: https://ryushin01.github.io/LuminousKR/storybook/

정적 호스팅에서는 `/studio` 같은 주소로 바로 들어오면 파일이 없어 404가 납니다. `scripts/postbuild.mjs`가 화면마다 `index.html` 사본(문서 제목 포함)을 만들어 200으로 열리게 하고, 없는 주소는 `404.html`(같은 앱)이 받아 '없는 화면'을 보여 줍니다. 사본마다 그 화면 조각의 JS(`modulepreload`)·CSS를 넣어, 진입 JS를 받은 뒤 화면 조각을 다시 요청하는 왕복을 없앱니다(빌드 매니페스트 `dist/.vite/manifest.json`으로 찾고 다 쓰면 지움). 모든 화면의 첫 화면에 쓰는 글꼴(LuminousSans 화면 글자 400·600·700, Syne 영문)도 `<link rel="preload" as="font">`로 미리 받아, CSS를 읽은 뒤 늦게 도착한 글꼴로 제목 줄 수가 바뀌며 아래가 밀리지 않게 합니다.

Web Worker(`engine.worker`)와 글꼴·이미지는 기준 경로를 따라 상대 경로로 묶이므로 하위 경로에서도 그대로 동작합니다.

## 보안과 공유

- **CSP**: `vite.config.ts`의 `contentSecurityPolicy` 플러그인이 앱 프로덕션 빌드의 HTML에만 `<meta http-equiv="Content-Security-Policy">`를 넣습니다(개발 서버는 HMR, Storybook 빌드는 미리보기의 인라인 설정 스크립트 때문에 `.storybook/main.ts`의 `viteFinal`에서 뺌)(스크립트·워커 같은 출처, eval 금지, 인라인 style 속성·`blob:`·`data:` 그림 허용). GitHub Pages는 응답 헤더를 바꿀 수 없어 `frame-ancestors`·`X-Frame-Options`는 넣지 못합니다(호스팅을 옮기면 헤더로).
- **공유 미리보기**: `index.html`에 운영 주소 기준의 `og:*`·트위터 카드·`canonical`이 있고, `postbuild`가 화면별 사본의 `og:url`·`canonical`을 그 화면 주소로 바꿉니다. `404.html`은 `noindex`.
- **웹 앱 매니페스트**: `public/manifest.webmanifest`와 `public/icons/`(192·512·마스크). 주소는 매니페스트 기준 상대 경로라 하위 경로(`/LuminousKR/`)에서도 맞습니다.
- **서비스 워커**(오프라인): `postbuild`가 `scripts/sw-template.js`에 빌드 결과를 채워 `sw.js`를 씁니다. 앱은 프로덕션 빌드에서 첫 화면을 다 연 뒤 등록합니다(`app/lib/registerServiceWorker.ts`).
  - 화면(HTML)은 네트워크를 먼저 쓰고 연결이 없을 때만 저장해 둔 것을 씁니다. 그래서 온라인이면 지금처럼 새로 고치면 새 판이 열립니다(갱신 안내 없이 `skipWaiting`).
  - 해시가 붙은 `assets/`는 캐시를 먼저 씁니다. 설치할 때 화면별 HTML, JS·CSS, 화면 글자 글꼴을 미리 받습니다(약 1 MB). 쓸 때만 불러오는 pdf.js와 그 자료(표준 글꼴·WASM·색 프로필)·WOFF2 압축기(약 3.9 MB)는 설치를 마친 뒤 페이지가 `'warm'`을 보내면 따로 받아(`WARM` 목록, 데이터 절약 모드면 건너뜀), 한 번도 쓰지 않은 채 연결이 끊겨도 PDF 가져오기·WOFF2가 됩니다. 글자 조각과 한중일 문자표는 쓸 때 저장합니다.
  - pdf.js 자료는 pdf.js가 '주소 + 원래 파일 이름'으로 받아서 해시 없이 `assets/pdfjs-<판>/`에 둡니다(`vite.config.ts`의 `pdfjsData`, 판 번호가 경로에 있어 캐시 먼저와 맞음). 앞 판 정리 목록(`KNOWN_ASSETS`)은 이 하위 폴더까지 셉니다.
  - 이번 판과 바로 앞 판의 자산만 남겨, 배포 전에 연 탭이 옛 화면 조각을 찾아도 캐시에서 받습니다.
  - 서버가 `Vary: Origin`을 붙여도 대조되도록 캐시를 찾을 때 Vary를 보지 않습니다(자산은 이름이 내용마다 다름).
  - E2E는 서비스 워커를 막고(`serviceWorkers: 'block'`, 요청 가로채기로 흉내 낸 실패가 캐시에 가려지지 않게) 오프라인 시험만 켭니다.
- **웹 폰트·WASM 사용 허락**: 배포하는 두 글꼴(LuminousSans·Syne)은 SIL OFL 1.1이라, `postbuild`가 OFL 전문을 `licenses/LuminousSans-OFL.txt`·`licenses/Syne-OFL.txt`로 함께 둡니다(줄인 글꼴 파일의 이름 표에도 저작권·라이선스 설명·주소가 있음). WOFF2 압축에 쓰는 WASM도 함께 배포하므로 `brotli-wasm`의 Apache-2.0 전문(`postbuild`가 복사)과 그 안의 rust-brotli 전문(BSD-3-Clause·MIT, `public/licenses/`)을 둡니다. pdf.js와 그 자료(Liberation Sans OFL·Foxit 표준 글꼴, OpenJPEG·JBIG2·qcms WASM, 색 프로필)의 사용 허락도 `licenses/pdfjs-*.txt`로 둡니다.

