import { A } from '@solidjs/router'
import { For, Index, Show, createSignal } from 'solid-js'
import { bodyFrame, fontProject, frameBox, homeLayout, jamoLabel } from '@/entities/font'
import { Button } from '@/shared/ui/button'
import { Icon } from '@/shared/ui/icon'
import type { RecognizedStroke } from '../lib/recognize.ts'
import type { Candidate, Importer } from '../model/importer.ts'
import styles from './ImportPage.module.css'

function strokePath(stroke: RecognizedStroke): string {
  if (stroke.kind === 'ellipse') {
    const { cx, cy, rx, ry } = stroke
    return `M${(cx - rx) * 100} ${cy * 100}a${rx * 100} ${ry * 100} 0 1 0 ${rx * 200} 0a${rx * 100} ${ry * 100} 0 1 0 ${-rx * 200} 0`
  }
  const d = stroke.points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(p.x * 100).toFixed(1)} ${(p.y * 100).toFixed(1)}`)
    .join('')
  return stroke.closed ? `${d}Z` : d
}

function describe(candidate: Candidate): string {
  const width = bodyFrame(fontProject.metrics, fontProject.style)
  const pen = Math.round(candidate.penWidth * (width.x1 - width.x0))
  return `획 ${candidate.strokes.length}개 · 펜 굵기 약 ${pen}단위`
}

/** 3단계: 인식 결과를 칸 그림과 나란히 보고 적용할 자모를 고릅니다. */
export function CandidateList(props: { importer: Importer }) {
  const [usePen, setUsePen] = createSignal(false)
  const [applied, setApplied] = createSignal(0)

  return (
    <Show
      when={props.importer.candidates.length > 0}
      fallback={
        <p class={styles.note}>
          아직 인식한 자모가 없습니다. 위에서 양식 사진이나 PDF를 올려 주세요.
        </p>
      }
    >
      <div class={styles.stack}>
        <div class={styles.bulk}>
          <Button size="small" variant="ghost" onClick={() => props.importer.selectAll(true)}>
            모두 고르기
          </Button>
          <Button size="small" variant="ghost" onClick={() => props.importer.selectAll(false)}>
            모두 풀기
          </Button>
        </div>
        <ul class={styles.candidates}>
          <For each={props.importer.candidates}>
            {(candidate) => {
              const frame = () =>
                frameBox(fontProject.layouts, candidate.key, homeLayout(candidate.key))
              return (
                <li
                  class={styles.candidate}
                  classList={{ [styles.candidateOn!]: candidate.selected }}
                >
                  <div class={styles.candidateImages}>
                    <img
                      class={styles.scan}
                      src={candidate.preview}
                      alt={`${jamoLabel(candidate.key)} 칸을 바로잡은 그림`}
                      width="160"
                      height="160"
                    />
                    <svg class={styles.skeleton} viewBox="0 0 100 100" aria-hidden="true">
                      <rect
                        class={styles.skeletonFrame}
                        x={frame().x0 * 100}
                        y={frame().y0 * 100}
                        width={(frame().x1 - frame().x0) * 100}
                        height={(frame().y1 - frame().y0) * 100}
                      />
                      <Index each={candidate.strokes}>
                        {(stroke) => <path d={strokePath(stroke())} />}
                      </Index>
                    </svg>
                  </div>
                  <label class={styles.check}>
                    <input
                      type="checkbox"
                      checked={candidate.selected}
                      onChange={(event) =>
                        props.importer.toggle(candidate.id, event.currentTarget.checked)
                      }
                    />
                    <span>
                      <strong>{jamoLabel(candidate.key)} 적용</strong>
                      <span class={styles.checkHint}>
                        {describe(candidate)} · {candidate.source}
                      </span>
                    </span>
                  </label>
                </li>
              )
            }}
          </For>
        </ul>
        <label class={styles.check}>
          <input
            type="checkbox"
            checked={usePen()}
            onChange={(event) => setUsePen(event.currentTarget.checked)}
          />
          <span>
            <strong>펜 굵기를 글꼴 굵기로</strong>
            <span class={styles.checkHint}>고른 칸의 평균 펜 굵기로 획 굵기를 바꿉니다</span>
          </span>
        </label>
        <div class={styles.applyRow}>
          <Button
            variant="primary"
            disabled={props.importer.selectedCount() === 0}
            onClick={() => setApplied(props.importer.apply(usePen()))}
          >
            <Icon name="check" size={18} />
            고른 자모 {props.importer.selectedCount()}자 적용
          </Button>
          <Show when={applied() > 0}>
            <A href="/studio" class={styles.studioLink}>
              작업실에서 다듬기
              <Icon name="arrowRight" size={16} />
            </A>
          </Show>
        </div>
      </div>
    </Show>
  )
}
