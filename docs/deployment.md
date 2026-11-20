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
- **웹 폰트·WASM 사용 허락**: 배포하는 두 글꼴(LuminousSans·Syne)은 SIL OFL 1.1이라, `postbuild`가 OFL 전문을 `licenses/LuminousSans-OFL.txt`·`licenses/Syne-OFL.txt`로 함께 둡니다(줄인 글꼴 파일의 이름 표에도 저작권·라이선스 설명·주소가 있음). WOFF2 압축에 쓰는 WASM도 함께 배포하므로 `brotli-wasm`의 Apache-2.0 전문(`postbuild`가 복사)과 그 안의 rust-brotli 전문(BSD-3-Clause·MIT, `public/licenses/`)을 둡니다.

