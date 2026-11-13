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

정적 호스팅에서는 `/studio` 같은 주소로 바로 들어오면 파일이 없어 404가 납니다. `scripts/postbuild.mjs`가 화면마다 `index.html` 사본(문서 제목 포함)을 만들어 200으로 열리게 하고, 없는 주소는 `404.html`(같은 앱)이 받아 '없는 화면'을 보여 줍니다.

Web Worker(`engine.worker`)와 글꼴·이미지는 기준 경로를 따라 상대 경로로 묶이므로 하위 경로에서도 그대로 동작합니다.
