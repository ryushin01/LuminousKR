# LuminousKR - 한글 모듈 글꼴 조합기

[![CI](https://github.com/ryushin01/LuminousKR/actions/workflows/ci.yml/badge.svg)](https://github.com/ryushin01/LuminousKR/actions/workflows/ci.yml)
![version](https://img.shields.io/badge/version-0.2.2-ff6a1a)
![Storybook](https://img.shields.io/badge/Storybook-10-FF4785?logo=storybook&logoColor=white)

초·중·종성 획의 뼈대만 그리면 한글 11,172자를 조합해 OTF·WOFF 글꼴 파일로 내보내는 웹 도구입니다. 자모 24자만 그려도 겹자음·겹받침·섞임 모음과 모든 음절이 만들어지고, 손으로 쓴 양식의 사진·스캔 PDF를 올려 획을 인식해 가져올 수도 있습니다.

**[바로 써 보기](https://ryushin01.github.io/LuminousKR/)** · [Storybook](https://ryushin01.github.io/LuminousKR/storybook/)

> **프로젝트 상태:** 개인 **포트폴리오 프로젝트**입니다. 서버 없이 브라우저 안에서만 동작하며, 그린 획·올린 사진·만든 글꼴 파일은 어디에도 보내지 않습니다. 화면의 한글 제목은 이 조합기가 기본 프리셋으로 만든 글꼴로 그렸습니다.

## 화면

화면의 손글씨 양식 사진은 테스트용으로 그린 가상 그림입니다.

| 홈 | 작업실 |
|---|---|
| ![검은 우주의 일식 배경 위에 '획을 그으면 11,172자가 빛납니다' 제목과 굵기 맛보기 견본 글자](docs/images/home.jpg) | ![자모 고르기, ㄱ 초성의 뼈대와 윤곽을 보여 주는 그리기 판, 배치별 미리보기와 획 스타일](docs/images/studio.jpg) |

| 가져오기 | 미리보기 |
|---|---|
| ![손글씨 양식 사진에서 인식한 자모 칸 그림과 찾은 뼈대, 적용 체크 상자](docs/images/import.jpg) | ![입력한 글을 미리보기 글꼴로 그린 견본과 초성 ㄱ의 588자 표](docs/images/preview.jpg) |

| 내보내기 | 안내 |
|---|---|
| ![11,172칸이 모두 켜진 진행 그림과 OTF·WOFF 받기 단추, 만든 글꼴로 그린 글](docs/images/export.jpg) | ![여섯 가지 배치와 파생 규칙, 키보드 조작 표](docs/images/guide.jpg) |

| 모바일 홈 | 모바일 작업실 |
|---|---|
| <img src="docs/images/mobile-home.jpg" alt="좁은 화면의 홈: 위쪽 일식과 제목" width="240"> | <img src="docs/images/mobile-studio.jpg" alt="좁은 화면의 그리기 판" width="240"> |

## 주요 기능

| 화면 | 내용 |
|---|---|
| 작업실 | 직선·곡선·원 도구, 격자 맞춤(12·24·48칸), 꼭짓점 끌기, 키보드만으로 그리기, 획 목록, 되돌리기·다시하기 |
| 작업실 | 배치(벌)별 따로 그리기, 자동으로 만든 자모(ㄲ·ㅘ·ㄺ 등) 가져와 고치기, 굵기·가로획 대비·끝 모양·꺾임·기울기·글자 틀 |
| 가져오기 | 인쇄용 손글씨 양식 PDF(3종), 사진·스캔·PDF 인식(표식으로 원근 바로잡기, 세선화·뼈대 추적, ㅇ 타원 판정), 펜 굵기 가져오기, 양식 없이 그림 한 장 |
| 미리보기 | 입력한 글자만 담은 실제 글꼴 파일(FontFace)로 글 그리기, 초성별 588자 표로 11,172자 확인 |
| 내보내기 | 영문·한국어 글꼴 이름, 사용 허락, OTF(CFF)·WOFF 만들기, 11,172칸이 빛나는 진행 그림, 만든 글꼴로 써 보기 |
| 공통 | 브라우저 자동 저장, 프로젝트 파일(.json) 저장·열기, WebGL 우주 배경과 움직임 멈춤, 번호 붙은 전체 메뉴 |

조합 엔진은 뼈대에 두께를 입혀(Clipper2) 겹친 획을 합치고, 둥근 부분을 베지어 곡선으로 다시 맞춘 뒤 opentype.js로 파일을 씁니다. 조합·글꼴 만들기와 이미지 인식은 모두 Web Worker에서 돌아 화면이 멈추지 않습니다(11,225글리프 약 1.2초).

## 기술 스택

![SolidJS, TypeScript, Vite, Vitest, pnpm, GitHub Actions, HTML, CSS](https://skillicons.dev/icons?i=solidjs,ts,vite,vitest,pnpm,githubactions,html,css)

| 구분 | 사용 기술 |
|---|---|
| 프레임워크 | SolidJS 1.9, @solidjs/router, TypeScript, Vite 8 |
| 글꼴·그래픽 | opentype.js 2, Clipper2(clipper2-ts), Web Worker, CompressionStream(WOFF), FontFace API, WebGL2(GLSL), SVG |
| 이미지·PDF | pdf.js(읽기), 직접 만든 PDF 쓰기, OffscreenCanvas, 적응형 이진화·호모그래피·Zhang–Suen 세선화 |
| 스타일 | CSS Modules, CSS 변수 토큰, Outfit(영문 제목) |
| 품질 | ESLint(eslint-plugin-solid, jsx-a11y), Prettier, Steiger(FSD), Vitest + Solid Testing Library, Playwright E2E(axe 접근성, 화면 폭별 넘침, 키보드 그리기, 파일·인식 검증, Storybook 스토리 검사) |
| 문서 | Storybook 10 (storybook-solidjs-vite, addon-a11y) |
| 배포 | GitHub Pages, GitHub Actions |

## 시작하기

Node.js 26(`.nvmrc`)과 pnpm 12가 필요합니다.

```bash
nvm use
corepack enable pnpm
pnpm install
pnpm dev    # http://localhost:5173
```

| 명령 | 설명 |
|---|---|
| `pnpm build` / `build:all` | 프로덕션 빌드 / Storybook까지 함께 빌드 |
| `pnpm storybook` | Storybook 개발 서버 (`http://localhost:6006`) |
| `pnpm lint` / `lint:fsd` / `typecheck` | ESLint / FSD 구조 검사 / 타입 검사 |
| `pnpm test` | 엔진·인식·화면 단위 테스트 |
| `pnpm test:e2e` | 프로덕션 빌드의 실제 화면 검사 (먼저 `build:all` 필요) |
| `pnpm fonts:display` | 제목용 글꼴(Luminous Display)을 조합기로 다시 만들기 |

전체 명령과 규칙은 [개발 가이드](docs/development.md)를 참고하세요.

## 프로젝트 구조

[Feature-Sliced Design](https://feature-sliced.design) 계층으로 나눕니다.

```
src/
├─ app/        진입점, 라우터, 공통 레이아웃, 전역 스타일·제목 글꼴
├─ pages/      홈, 작업실(그리기 판), 가져오기(양식·인식 워커), 미리보기, 내보내기, 안내
├─ widgets/    머리글·전체 메뉴, WebGL 우주 배경
├─ features/   획 스타일 조절, 프로젝트 저장·열기
├─ entities/
│  └─ font/    자모 모델·배치·파생 규칙, 조합 엔진, 조합 워커, 글리프 표시
└─ shared/     한글 표, 기하·곡선 맞춤, OTF·WOFF·PDF 쓰기, 이미지 처리, 워커 RPC, 공용 UI
```

## 문서

| 문서 | 내용 |
|---|---|
| [조합 원리](docs/engine.md) | 뼈대 모델, 여섯 배치, 파생 규칙, 굵기 입히기·곡선 맞춤, 글꼴 파일 구성 |
| [손글씨 가져오기](docs/import.md) | 양식 PDF, 표식·원근 바로잡기, 세선화·뼈대 추적, 적용 |
| [개발 가이드](docs/development.md) | 구조, 명령, 테스트, 제목 글꼴, 접근성 점검 |
| [CI · 배포](docs/deployment.md) | GitHub Actions, GitHub Pages, 화면별 HTML |
| [버전 기록](CHANGELOG.md) | 버전별 변경 내용 |

## 출처

| 자료 | 저작자 | 사용 허락 | 원본 |
|---|---|---|---|
| Outfit 글꼴 (영문 제목) | The Outfit Project Authors | SIL OFL 1.1 | [Outfit-Fonts](https://github.com/Outfitio/Outfit-Fonts) · [Fontsource](https://fontsource.org/fonts/outfit) |
| opentype.js (OTF 쓰기) | Frederik De Bleser | MIT | [opentype.js](https://github.com/opentypejs/opentype.js) |
| Clipper2 (두께 입히기·합치기) | Angus Johnson(원작), Jeremy Tribby(TypeScript 이식) | BSL-1.0 | [clipper2-ts](https://github.com/countertype/clipper2-ts) |
| pdf.js (PDF 읽기) | Mozilla | Apache-2.0 | [pdf.js](https://github.com/mozilla/pdf.js) |
| SolidJS (화면) | Ryan Carniato | MIT | [solid](https://github.com/solidjs/solid) |

한글 제목 글꼴 Luminous Display, 아이콘, 우주 배경(WebGL)과 화면 사진은 이 프로젝트에서 직접 만들었습니다.
