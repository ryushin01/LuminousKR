# LuminousKR — 에이전트 작업 안내

이 저장소에서 일하는 에이전트(Codex, Claude Code 등)를 위한 규칙입니다. 자세한 설명은 [개발 가이드](docs/development.md), [CI · 배포](docs/deployment.md), [조합 원리](docs/engine.md), [손글씨 가져오기](docs/import.md)에 있습니다.

## 1. 프로젝트 개요

- 초·중·종성 획의 뼈대만 그리면 한글 11,172자를 조합해 OTF·WOFF·WOFF2 글꼴로 내보내는 웹 도구입니다. 서버 없이 브라우저 안에서만 동작하며, 그린 획·올린 사진·만든 글꼴은 어디에도 보내지 않습니다.
- 화면 축: 웹 앱(홈, 작업실 `/studio`, 가져오기, 미리보기, 내보내기, 안내). `/studio` 그리기 판은 같은 앱의 기능입니다.
- 운영: https://ryushin01.github.io/LuminousKR/ · Storybook: https://ryushin01.github.io/LuminousKR/storybook/

## 2. 기술 스택과 구조

- SolidJS 1.9, @solidjs/router, TypeScript 6, Vite 8, opentype.js 2, Clipper2(clipper2-ts), pdf.js, brotli-wasm, Web Worker, WebGL2, CSS Modules.
- Feature-Sliced Design v2.1. 층 순서(위가 아래를 가져옴): `src/app` → `src/pages` → `src/widgets` → `src/features` → `src/entities` → `src/shared`.
  - 슬라이스는 공개 API(`index.ts`)로만 가져옵니다. 경로 별칭은 `@/` → `src/`이고, 같은 슬라이스 안에서는 확장자를 붙인 상대 경로(`./layout.ts`)로 가져옵니다.
  - 한 화면에서만 쓰는 코드는 그 화면 슬라이스 안에 둡니다(그리기 판 편집기, 손글씨 양식·인식 워커 등).
  - Steiger(`pnpm lint:fsd`)로 검사합니다.
- 조합·글꼴 만들기·이미지 인식은 모두 Web Worker에서 돕니다. 화면 스레드에서 무거운 계산을 하지 않습니다.

## 3. 설치·개발 명령

- Node.js 26(`.nvmrc`), pnpm 12(`packageManager: pnpm@12.16.1`).

```bash
nvm use
corepack enable pnpm
pnpm install
pnpm dev              # http://localhost:5173
pnpm storybook        # http://localhost:6006
pnpm build            # 앱 + 화면별 HTML 사본·서비스 워커(scripts/postbuild.mjs)
pnpm build:all        # 앱 + Storybook(dist/storybook)
pnpm preview          # http://localhost:4173
```

- 화면 문구를 바꾸면 `pnpm fonts`(fontTools 필요)로 LuminousSans 화면 글자 파일을 다시 만듭니다. 빠뜨리면 `fonts.test.ts`가 실패합니다.
- README 화면: 먼저 `pnpm build`, 그다음 `pnpm screenshots`(macOS Metal로 배경을 그림).
- 환경 변수: 앱이 읽는 비밀값은 없습니다. Pages 빌드만 `BASE_PATH=/LuminousKR/`를 씁니다. 외부 API·CDN이 없어 `.env`·인터넷 없이 모든 화면이 열립니다(글꼴·brotli-wasm·pdf.js 모두 빌드에 포함).

## 4. 검사·테스트 명령

CI(`.github/workflows/ci.yml`)가 PR과 `main` 푸시마다 도는 순서입니다. PR 전에 로컬에서도 돌립니다.

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm lint:fsd
pnpm format:check
pnpm typecheck
pnpm test                 # Vitest(jsdom)
pnpm build:all
pnpm exec playwright install --with-deps chromium webkit
pnpm test:e2e             # 크로미움·WebKit, axe, 화면 폭별 넘침, 키보드·터치 그리기, 글꼴 파일, 스토리 axe, 오프라인
```

- 의존성을 더하면 `pnpm ignored-builds`로 확인하고 필요한 것만 `pnpm approve-builds <패키지>`로 `allowBuilds`에 넣습니다(지금은 esbuild만). 허용하지 않은 빌드 스크립트가 있으면 CI 설치가 실패합니다.
- jsdom에는 Web Worker가 없어 실제 워커 동작은 E2E에서 확인합니다. E2E는 `reducedMotion: 'reduce'`, 서비스 워커를 막고(오프라인 시험만 켬) 돕니다. 오프라인은 두 가지입니다: `e2e/offline-network.spec.ts`는 localhost 밖 요청을 모두 막고 처음 연 모든 화면이 외부 요청·axe 위반·콘솔 오류 없이 뜨는지, `e2e/offline.spec.ts`는 한 번 연 뒤 연결이 끊겨도 서비스 워커로 열리는지 봅니다. 외부로 요청을 보내는 코드를 더하면 `offline-network.spec.ts`가 실패합니다.
- **Testing Library 원칙**: 구현 세부가 아니라 사용자가 보는 동작을 검사하고, 요소는 역할·이름(`getByRole`)으로 찾습니다. 단위·컴포넌트는 Vitest + Solid Testing Library(`@solidjs/testing-library`, `user-event`, `jest-dom`), 화면 흐름은 Playwright E2E, 접근성은 axe(`@axe-core/playwright`, Storybook `addon-a11y`의 `a11y.test: 'error'`, 스토리 axe는 E2E에서)로 검사합니다.
- 버그를 고치면 고치기 전에 실패하는 테스트를 함께 넣습니다.

## 5. 코드 스타일

- **TypeScript strict**(`tsconfig.json`의 `strict: true`)를 유지합니다. `any`·`as` 단언·`@ts-ignore`는 피하고, 열어 들인 프로젝트 파일 같은 외부 입력은 검사합니다.
- 코드 모양은 **Prettier**(`prettier.config.js`: `semi: false`, `singleQuote`, `trailingComma: 'all'`, `printWidth: 100`)를 따르고 ESLint(eslint-plugin-solid, jsx-a11y)를 지킵니다. Biome은 쓰지 않습니다. 마크다운은 손으로 맞춘 표를 지키려고 Prettier에서 뺐습니다.
- 디자인 토큰과 글꼴 변수는 `src/app/styles/tokens.css`에 있습니다(영문 Syne, 한글 LuminousSans).
- 자동 저장 형식(localStorage `luminous-kr:project:v1`, 프로젝트 형식 2판)을 바꿀 때는 옛 저장을 읽을 수 있게 하고, 읽지 못하는 저장은 덮어쓰지 않습니다.
- 접근성은 **WCAG 2.2와 KWCAG 2.2**를 따르고(개발 가이드의 '접근성 점검'), 자동 검사는 eslint-plugin-jsx-a11y와 axe(Storybook·Playwright)로 합니다:
  - 네이티브 요소를 먼저 씁니다(`<button type="button">`, `<a href>`, 메뉴는 `<dialog>`).
  - 텍스트 대비 4.5:1 이상, 모든 기능은 키보드로 됩니다(키보드만으로 그리기 포함). 초점 표시를 지우지 않습니다.
  - 조작 크기 24×24px 이상, 끌기는 버튼으로도 할 수 있게 합니다. 대화상자는 초점을 가두고 닫으면 돌려줍니다.
  - 입력칸마다 레이블, 오류는 `aria-invalid`·`aria-describedby`로 연결합니다. 자동 저장·진행 안내처럼 화면 전환 없이 바뀌는 안내는 `role="status"`입니다.
  - 표는 `caption`·`scope`, 움직이는 배경은 멈춤 버튼과 `prefers-reduced-motion`을 지킵니다.

## 6. Git·PR

- 흐름은 **GitHub Flow**입니다. `main`에 직접 커밋·푸시하지 않고, 최신 `main`에서 브랜치를 만들어 PR로만 병합합니다.
- 브랜치 이름: `feat/…`, `fix/…`, `refactor/…`, `docs/…`, `test/…`, `chore/…`, `release/…`. 기능 브랜치는 `feat/2.0.0-latin`처럼 버전을 넣어 왔습니다.
- 커밋·PR 제목은 **Conventional Commits**(`<타입>: <한국어 요약>`)입니다. 타입은 `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `style`, `chore`, `ci`, `build`입니다. 버전을 올렸으면 끝에 `(x.y.z)`를 붙입니다. 예: `feat: 영문·숫자·문장부호 94자와 좁은 틈 메움 수정 (2.0.0)`, `docs: README 작업실 화면 사진을 2.0.0 화면으로 (2.0.1)`.
- **기여자는 ryushin01만 남깁니다.** 커밋 작성자는 항상 ryushin01(`ryushin0 <141554987+ryushin01@users.noreply.github.com>`)입니다. 이 저장소는 백엔드 코드가 없어 `Co-Authored-By` 줄을 넣지 않습니다(예전 커밋에 있던 표기는 따르지 않음).
- GitHub Actions가 커밋하는 워크플로는 작성자를 ryushin01로 설정합니다(`github-actions[bot]` 금지). Dependabot PR은 그대로 병합하지 말고 같은 변경을 ryushin01 커밋으로 다시 만들어 병합합니다.
- **Semantic Versioning**(주.부.수): 버전은 `package.json`의 `version`, README 버전 배지, README의 '프로젝트 상태' 줄에서 함께 맞추고 `CHANGELOG.md`에 `## x.y.z - YYYY-MM-DD` 절을 더합니다. 내용은 소제목 없이 `-` 목록입니다(표준의 추가·변경·수정·제거 소제목과 다른 점). 이 저장소는 README 화면 같은 문서 변경에도 수 버전을 올려 왔습니다(2.0.1).
- **Keep a Changelog**를 따르되, 이 저장소는 `[Unreleased]` 절을 쓰지 않고 PR마다 바로 버전 절을 더합니다(표준과 다른 점).
- 병합은 squash(`… (#번호)`)로 합니다. 원격 브랜치 삭제는 저장소 설정에 맡깁니다.
- CI가 통과하면 CodeRabbit 리뷰를 기다리지 않고 병합합니다. 이미 달린 지적 중 맞는 것은 반영합니다. Actions가 돌지 않으면 4절의 검사를 로컬에서 통과한 뒤 병합합니다.

## 7. 배포·릴리스

- GitHub Pages(`.github/workflows/pages.yml`): `main`에 푸시하면 `BASE_PATH=/LuminousKR/`로 `pnpm build:all`을 돌려 배포합니다. Vercel은 쓰지 않습니다. 사용자가 일괄 배포일을 정하면 그때까지 병합하지 않고 PR만 올려 둡니다.
- 정적 호스팅이라 `scripts/postbuild.mjs`가 화면마다 `index.html` 사본과 `404.html`, 서비스 워커(`sw.js`), `licenses/`를 만듭니다. 화면을 더하면 이 스크립트도 확인합니다.
- 서버가 없어 데모 모드가 따로 없습니다. 공개 사이트가 그대로 데모입니다.
- 릴리스: 병합 뒤 `vX.Y.Z` 태그와 `vX.Y.Z — 한 줄 요약` 제목의 GitHub 릴리스(대상은 병합 커밋 전체 SHA, 본문은 `CHANGELOG.md`의 해당 절)를 만듭니다.
- 배포 뒤 운영 주소와 Storybook 주소가 200인지 확인합니다.
- 릴리스 뒤 `bash ~/Documents/Archive/Backup/backup.sh`를 돌려 DONE을 확인합니다.
- 보관함 계획 문서 `~/Documents/Obsidian Vault/LuminousKR v1.0.0 고도화 계획.md`, `LuminousKR v1.x 잔여 작업 계획.md`에 날짜와 진행 기록을 남깁니다.
- 소개가 크게 바뀌면 프로필 저장소 `ryushin01/ryushin01` README의 프로젝트 표를 고칩니다(버전 숫자는 자동 갱신).

## 8. 보안·주의사항

- **상태는 명령 결과로만 말합니다.** CI·배포·릴리스가 "통과했다", "끝났다"는 실제 명령 결과(`gh pr checks`, 주소 응답 코드 등)로 확인한 뒤에 말합니다.
- **먼저 묻기:** 새 런타임 의존성 추가, 빌드 설정(`vite.config.ts`, `scripts/postbuild.mjs`, Pages 워크플로) 변경, `allowBuilds` 추가.
- **절대 금지:** 비밀값을 `VITE_*`에 넣기, `.env` 커밋, `eslint-disable`·`--no-verify`로 검사 우회, `main`에 직접 푸시.
- 비밀값과 `.env` 파일을 커밋하지 않습니다. 사용자가 그린 획·사진·글꼴을 외부로 보내는 코드를 넣지 않습니다.
- CSP는 `vite.config.ts`의 플러그인이 프로덕션 HTML에 `<meta>`로 넣습니다(eval 금지, 스크립트·워커 같은 출처). GitHub Pages는 응답 헤더를 바꿀 수 없어 `frame-ancestors`는 넣지 못합니다.
- 웹 폰트(OFL)와 brotli-wasm·rust-brotli의 사용 허락 전문을 배포본 `licenses/`에 유지합니다. IBM Plex Sans KR은 OFL 예약 이름 때문에 줄인 파일 이름을 `LuminousSans`로 둡니다.
- 화면의 손글씨 양식 사진은 테스트용 가상 그림만 씁니다.

## 9. 공통 규칙

공통 규칙은 `~/Documents/GitHub/CLAUDE.md`에 있습니다(충돌하면 이 파일이 우선). 핵심:

- 답변·커밋·PR·문서·주석은 한국어로 씁니다.
- 허락을 묻지 않고 끝까지 진행한 뒤 결과를 한 번에 보고합니다. 비용·비밀값 생성·디자인 변경·되돌릴 수 없는 공개 행동은 진행하지 않고 보고합니다.
- 사용자의 진행 중인 작업을 보호합니다. 로컬 작업 트리에 변경이 있으면 `git worktree add /tmp/<이름> -b <브랜치> origin/main`에서 작업하고 끝나면 지웁니다.
- 다른 세션에 공지할 때는 Paseo의 ryushin01 그룹 세션에만 보냅니다.
