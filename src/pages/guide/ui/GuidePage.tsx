import { For, createMemo } from 'solid-js'
import {
  GlyphView,
  LAYOUT_IDS,
  LAYOUT_INFO,
  type RenderItem,
  createRenderedGlyphs,
} from '@/entities/font'
import { usePageTitle } from '@/shared/lib/page'
import { ButtonLink } from '@/shared/ui/button'
import { PageHeader } from '@/shared/ui/page-header'
import { Panel } from '@/shared/ui/panel'
import styles from './GuidePage.module.css'

const DERIVATIONS = [
  { group: '쌍자음', members: 'ㄲ ㄸ ㅃ ㅆ ㅉ', rule: '같은 자음 둘을 나란히 (ㄲ = ㄱ + ㄱ)' },
  { group: 'ㅐ 계열', members: 'ㅐ ㅒ ㅔ ㅖ', rule: '세로 모음 + ㅣ (ㅐ = ㅏ + ㅣ)' },
  {
    group: '섞임 모음',
    members: 'ㅘ ㅙ ㅚ ㅝ ㅞ ㅟ ㅢ',
    rule: '가로 모음 + 세로 모음 (ㅘ = ㅗ + ㅏ)',
  },
  {
    group: '홑받침',
    members: 'ㄱ ㄴ ㄷ ㄹ ㅁ ㅂ ㅅ ㅇ ㅈ ㅊ ㅋ ㅌ ㅍ ㅎ',
    rule: '같은 초성을 받침 틀에 맞춤',
  },
  {
    group: '쌍받침·겹받침',
    members: 'ㄲ ㄳ ㄵ ㄶ ㄺ ㄻ ㄼ ㄽ ㄾ ㄿ ㅀ ㅄ ㅆ',
    rule: '받침 둘을 나란히 (ㄺ = ㄹ + ㄱ)',
  },
]

const KEYS = [
  { keys: '화살표', action: '점 놓을 위치를 격자 한 칸씩 옮김 (Shift와 함께 네 칸)' },
  { keys: '스페이스', action: '직선·곡선: 점 찍기 / 원: 모서리 정하기 / 고르기: 가까운 획 고르기' },
  { keys: 'Enter', action: '그리던 획 마치기' },
  { keys: 'Esc', action: '그리던 획 취소, 또는 고른 획 풀기' },
  { keys: 'Delete, Backspace', action: '고른 획 지우기' },
  { keys: 'Ctrl(⌘) + Z', action: '되돌리기 (작업실 어디서나, 글 입력 중 제외)' },
  { keys: 'Ctrl(⌘) + Shift + Z, Ctrl + Y', action: '다시하기' },
]

const CREDITS = [
  { name: 'opentype.js', use: 'OTF 파일 쓰기와 읽기', license: 'MIT' },
  { name: 'Clipper2 (clipper2-ts)', use: '뼈대에 두께 입히기, 겹친 획 합치기', license: 'BSL-1.0' },
  { name: 'SolidJS', use: '화면 구성', license: 'MIT' },
  { name: 'Outfit', use: '영문 제목 글꼴', license: 'SIL OFL 1.1' },
]

export function GuidePage() {
  usePageTitle('안내')
  const items = createMemo<RenderItem[]>(() =>
    LAYOUT_IDS.map((id) => ({ type: 'char', char: LAYOUT_INFO[id].sample })),
  )
  const glyphs = createRenderedGlyphs(items)

  return (
    <div class={styles.page}>
      <PageHeader
        number="05"
        label="안내"
        title="조합의 원리"
        lead="LuminousKR이 어떻게 자모 24자의 뼈대로 11,172자를 만드는지, 그리고 키보드로 그리는 방법을 정리했습니다."
      />
      <div class={styles.stack}>
        <Panel title="뼈대에 굵기를 입힙니다" number="1">
          <div class={styles.prose}>
            <p>
              LuminousKR은 획의 <strong>가운데 선(뼈대)</strong>만 저장합니다. 글자를 만들 때
              굵기·끝 모양·꺾임 모양에 맞춰 두께를 입히고, 겹친 획을 하나로 합친 뒤 둥근 부분을
              베지어 곡선으로 다시 맞춥니다.
            </p>
            <p>
              윤곽을 그려 저장하는 방식은 자모를 작은 칸에 줄여 넣으면 획도 함께 가늘어집니다. 뼈대
              방식은 위치만 줄이고 두께는 나중에 같은 값으로 입히므로, ㄲ의 반쪽 ㄱ이나 받침 ㄹ도
              다른 획과 굵기가 같습니다. 굵기 값을 바꾸면 11,172자가 한꺼번에 다시 만들어집니다.
            </p>
          </div>
        </Panel>

        <Panel title="여섯 가지 배치(벌)" number="2">
          <div class={styles.prose}>
            <p>
              음절은 중성 모양(세로·가로·섞임)과 받침 유무에 따라 여섯 가지 틀 가운데 하나로
              짜입니다. 자모는 기본 틀에서 그린 뼈대를 각 틀의 크기에 맞춰 늘이거나 줄여 놓습니다.
              ㅇ·ㅎ의 원은 너무 납작해지지 않게 비율을 지킵니다.
            </p>
            <p>
              특정 배치에서 모양이 마음에 들지 않으면 작업실의 <strong>배치(벌)</strong>에서 그
              배치만 따로 그릴 수 있습니다. 옛 조합형 글꼴의 &lsquo;벌&rsquo;과 같은 생각입니다.
            </p>
          </div>
          <ul class={styles.layouts}>
            <For each={LAYOUT_IDS}>
              {(id, index) => (
                <li class={styles.layout}>
                  <GlyphView glyph={glyphs()?.[index()]} guides class={styles.layoutGlyph} />
                  <span class={styles.layoutText}>
                    <strong>{LAYOUT_INFO[id].sample}</strong>
                    <span>{LAYOUT_INFO[id].description}</span>
                  </span>
                </li>
              )}
            </For>
          </ul>
        </Panel>

        <Panel title="자동으로 만들어지는 자모" number="3">
          <p class={styles.prose}>
            자음 14자(ㄱ ㄴ ㄷ ㄹ ㅁ ㅂ ㅅ ㅇ ㅈ ㅊ ㅋ ㅌ ㅍ ㅎ)와 모음 10자(ㅏ ㅑ ㅓ ㅕ ㅗ ㅛ ㅜ ㅠ
            ㅡ ㅣ)를 그리면 나머지 43자는 아래 규칙으로 만들어집니다. 자동으로 만든 자모도
            &lsquo;직접 그리기&rsquo;로 가져와 고칠 수 있습니다.
          </p>
          <div
            class={styles.tableWrap}
            role="region"
            aria-labelledby="derivation-caption"
            tabindex="0"
          >
            <table class={styles.table}>
              <caption id="derivation-caption" class="visually-hidden">
                자동으로 만들어지는 자모와 규칙
              </caption>
              <thead>
                <tr>
                  <th scope="col">갈래</th>
                  <th scope="col">자모</th>
                  <th scope="col">만드는 방법</th>
                </tr>
              </thead>
              <tbody>
                <For each={DERIVATIONS}>
                  {(row) => (
                    <tr>
                      <th scope="row">{row.group}</th>
                      <td class={styles.members}>{row.members}</td>
                      <td>{row.rule}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="키보드로 그리기" number="4">
          <p class={styles.prose}>
            작업실의 그리기 판에 Tab으로 들어가면 아래 키를 쓸 수 있습니다. 판 아래 상태 문구가 점의
            위치와 동작을 알려 주고, 획 목록에서 획을 고르거나 지우고, 고른 획을 버튼으로 옮길 수
            있습니다.
          </p>
          <div class={styles.tableWrap} role="region" aria-labelledby="keys-caption" tabindex="0">
            <table class={styles.table}>
              <caption id="keys-caption" class="visually-hidden">
                그리기 판 키보드 조작
              </caption>
              <thead>
                <tr>
                  <th scope="col">키</th>
                  <th scope="col">동작</th>
                </tr>
              </thead>
              <tbody>
                <For each={KEYS}>
                  {(row) => (
                    <tr>
                      <th scope="row">
                        <kbd class={styles.kbd}>{row.keys}</kbd>
                      </th>
                      <td>{row.action}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="만들어지는 글꼴 파일" number="5">
          <ul class={styles.list}>
            <li>
              현대 한글 음절 11,172자(U+AC00–D7A3)와 낱자 51자(U+3131–3163), 빈칸이 들어갑니다.
            </li>
            <li>
              OTF는 CFF(PostScript) 윤곽으로, 1em = 1000 단위이고 위 880·아래 −120을 기준으로
              합니다.
            </li>
            <li>
              WOFF는 같은 파일을 표마다 zlib으로 압축한 웹 글꼴입니다. 웹 표준 CompressionStream으로
              만듭니다.
            </li>
            <li>
              영문 이름과 한국어 이름을 함께 기록합니다(한국어 이름은 Windows 이름 레코드, 언어
              0x0412).
            </li>
            <li>
              영문·숫자·문장부호는 들어 있지 않으므로, 쓰는 곳에서 다른 글꼴과 함께 지정하세요.
            </li>
          </ul>
        </Panel>

        <Panel title="그림은 이 브라우저에만 있습니다" number="6">
          <p class={styles.prose}>
            그린 획과 설정은 이 브라우저의 저장 공간(localStorage)에 자동으로 저장되고 어떤 서버로도
            보내지 않습니다. 브라우저 데이터를 지우면 함께 사라지므로, 작업실이나 내보내기에서
            프로젝트 파일(.json)로 저장해 두세요.
          </p>
        </Panel>

        <Panel title="쓰인 기술" number="7">
          <div
            class={styles.tableWrap}
            role="region"
            aria-labelledby="credits-caption"
            tabindex="0"
          >
            <table class={styles.table}>
              <caption id="credits-caption" class="visually-hidden">
                쓰인 기술과 사용 허락
              </caption>
              <thead>
                <tr>
                  <th scope="col">이름</th>
                  <th scope="col">쓰는 곳</th>
                  <th scope="col">사용 허락</th>
                </tr>
              </thead>
              <tbody>
                <For each={CREDITS}>
                  {(row) => (
                    <tr>
                      <th scope="row">{row.name}</th>
                      <td>{row.use}</td>
                      <td>{row.license}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
          <ButtonLink href="/studio" variant="primary" class={styles.cta}>
            작업실에서 그려 보기
          </ButtonLink>
        </Panel>
      </div>
    </div>
  )
}
