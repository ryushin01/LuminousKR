import { Show } from 'solid-js'
import type { RenderedGlyph } from '../api/engine-protocol.ts'
import styles from './GlyphView.module.css'

export type GlyphViewProps = {
  glyph: RenderedGlyph | undefined
  /** 접근 이름. 없으면 꾸밈으로 보고 숨깁니다. */
  label?: string
  class?: string
  /** 칸 테두리와 기준선 표시 */
  guides?: boolean
  /** 일부만 크게 볼 때 (기본은 글자 전체 0 0 너비 1000) */
  viewBox?: string
}

/** 조합기가 만든 글리프 하나를 SVG로 그립니다 (1em = 1000 단위 정사각). */
export function GlyphView(props: GlyphViewProps) {
  const advance = () => props.glyph?.advance ?? 1000
  return (
    <svg
      class={`${styles.glyph} ${props.class ?? ''}`}
      viewBox={props.viewBox ?? `0 0 ${advance()} 1000`}
      role={props.label ? 'img' : undefined}
      aria-label={props.label}
      aria-hidden={props.label ? undefined : 'true'}
    >
      <Show when={props.guides}>
        <rect class={styles.guide} x="0" y="0" width={advance()} height="1000" />
        <line class={styles.guide} x1="0" x2={advance()} y1="880" y2="880" />
      </Show>
      <Show
        when={props.glyph}
        fallback={
          <rect class={styles.placeholder} x="380" y="440" width="240" height="120" rx="60" />
        }
      >
        <path class={styles.path} d={props.glyph!.d} />
      </Show>
    </svg>
  )
}
