import { For, createMemo, createSignal } from 'solid-js'
import {
  GlyphView,
  LAYOUT_IDS,
  LAYOUT_INFO,
  type RenderItem,
  createRenderedGlyphs,
  sourceWithStyle,
} from '@/entities/font'
import { usePageTitle } from '@/shared/lib/page'
import { ButtonLink } from '@/shared/ui/button'
import { Icon } from '@/shared/ui/icon'
import { RangeField } from '@/shared/ui/range-field'
import styles from './HomePage.module.css'

const HERO_TEXT = '빛나는한글'

const STEPS = [
  {
    number: '01',
    title: '뼈대만 그립니다',
    body: '자음 14자와 모음 10자의 가운데 선만 그립니다. 손으로 쓴 양식을 찍어 올려도 됩니다. 겹자음·겹받침·ㅐ·ㅘ 같은 나머지 43자는 규칙에 따라 자동으로 만들어집니다.',
  },
  {
    number: '02',
    title: '여섯 가지 배치로 조합합니다',
    body: '가·고·과·각·곡·곽 여섯 모양의 틀에 자모를 맞춰 넣습니다. 뼈대를 작게 줄여도 굵기는 나중에 입히므로 획 두께가 고르게 유지됩니다.',
  },
  {
    number: '03',
    title: '글꼴 파일로 내보냅니다',
    body: 'Web Worker가 화면을 멈추지 않고 11,172자를 조합하고, opentype.js로 OTF와 WOFF 파일을 만듭니다. 그림은 이 브라우저 밖으로 나가지 않습니다.',
  },
]

export function HomePage() {
  usePageTitle('한글 모듈 글꼴 조합기')
  const [weight, setWeight] = createSignal(76)
  // sourceWithStyle가 돌려준 함수는 createRenderedGlyphs 안의 추적 범위에서 읽힙니다.
  // eslint-disable-next-line solid/reactivity
  const heroSource = sourceWithStyle(() => ({ weight: weight() }))
  const heroItems = createMemo<RenderItem[]>(() =>
    [...HERO_TEXT].map((char) => ({ type: 'char', char })),
  )
  const heroGlyphs = createRenderedGlyphs(heroItems, heroSource)
  const layoutItems = createMemo<RenderItem[]>(() =>
    LAYOUT_IDS.map((id) => ({ type: 'char', char: LAYOUT_INFO[id].sample })),
  )
  const layoutGlyphs = createRenderedGlyphs(layoutItems)

  return (
    <div class={styles.page}>
      <section class={styles.hero} aria-labelledby="home-title">
        <div class={styles.heroText}>
          <p class={styles.eyebrow}>
            <span class={`${styles.number} numeric`}>01</span>
            <span aria-hidden="true">—</span>
            한글 모듈 글꼴 조합기
          </p>
          <h1 id="home-title" class={styles.title}>
            획을 그으면
            <br />
            <span class={styles.titleGlow}>11,172자</span>가 빛납니다
          </h1>
          <p class={styles.lead}>
            초성·중성·종성의 뼈대 획만 그리면 나머지는 조합기가 맞춥니다. 굵기·끝 모양·기울기를
            바꾸면 모든 글자가 한꺼번에 바뀌고, 브라우저 안에서 바로 OTF·WOFF 글꼴 파일로
            내보냅니다.
          </p>
          <div class={styles.actions}>
            <ButtonLink href="/studio" variant="primary">
              작업실 열기
              <Icon name="arrowRight" size={18} />
            </ButtonLink>
            <ButtonLink href="/import" variant="secondary">
              손글씨 양식으로 시작
            </ButtonLink>
          </div>
        </div>

        <figure class={styles.specimen}>
          <div class={styles.specimenGlyphs} role="img" aria-label={`견본 글자: ${HERO_TEXT}`}>
            <For each={[...HERO_TEXT]}>
              {(_, index) => (
                <GlyphView glyph={heroGlyphs()?.[index()]} class={styles.specimenGlyph} />
              )}
            </For>
          </div>
          <figcaption class={styles.specimenCaption}>
            <RangeField
              label="굵기 맛보기"
              value={weight()}
              min={30}
              max={180}
              onInput={setWeight}
              format={(v) => `${v} 단위`}
              hint="모든 글자의 굵기가 한 번에 바뀝니다. 작업 중인 글꼴에는 저장되지 않습니다."
            />
          </figcaption>
        </figure>
      </section>

      <section class={styles.section} aria-labelledby="how-title">
        <h2 id="how-title" class={styles.sectionTitle}>
          조합은 이렇게 됩니다
        </h2>
        <ol class={styles.steps}>
          <For each={STEPS}>
            {(step) => (
              <li class={styles.step}>
                <span class={`${styles.stepNumber} numeric`} aria-hidden="true">
                  {step.number}
                </span>
                <h3 class={styles.stepTitle}>{step.title}</h3>
                <p class={styles.stepBody}>{step.body}</p>
              </li>
            )}
          </For>
        </ol>
        <ul class={styles.layouts} aria-label="여섯 가지 배치">
          <For each={LAYOUT_IDS}>
            {(id, index) => (
              <li class={styles.layout}>
                <GlyphView glyph={layoutGlyphs()?.[index()]} guides class={styles.layoutGlyph} />
                <span class={styles.layoutLabel}>
                  <strong>{LAYOUT_INFO[id].sample}</strong> {LAYOUT_INFO[id].label}
                </span>
              </li>
            )}
          </For>
        </ul>
      </section>

      <section class={styles.count} aria-labelledby="count-title">
        <h2 id="count-title" class={styles.countNumber}>
          <span class="numeric">11,172</span>
          <span class="visually-hidden">자</span>
        </h2>
        <p class={styles.countFormula}>
          <span class="numeric">19 × 21 × 28</span> = 초성 × 중성 × (종성 27 + 받침 없음)
        </p>
        <p class={styles.countBody}>
          현대 한글 음절은 모두 11,172자입니다. 한 자씩 그리면 몇 달이 걸리지만, 조합기는 자모
          24자의 뼈대로 1~2초 만에 만듭니다. 마음에 들지 않는 배치만 따로 그려 다듬을 수 있습니다.
        </p>
        <ButtonLink href="/studio" variant="primary">
          첫 획 긋기
        </ButtonLink>
      </section>
    </div>
  )
}
