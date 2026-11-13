import { For, Show, createUniqueId } from 'solid-js'
import {
  LAYOUT_INFO,
  type LayoutId,
  derivationSources,
  fontProject,
  homeLayout,
  isDerivable,
  jamoChar,
  layoutsOf,
} from '@/entities/font'
import { Button } from '@/shared/ui/button'
import { Icon } from '@/shared/ui/icon'
import { Segmented } from '@/shared/ui/segmented'
import { SelectField } from '@/shared/ui/select-field'
import { TOOL_LABEL, type Editor, type Tool } from '../model/editor.ts'
import styles from './EditorControls.module.css'

const TOOLS: readonly Tool[] = ['line', 'curve', 'ellipse', 'select']
const TOOL_ICON = { line: 'line', curve: 'curve', ellipse: 'ellipse', select: 'pointer' } as const

/** 배치(벌) 고르기: 같은 자모라도 놓이는 모양마다 따로 그릴 수 있습니다. */
export function LayoutPicker(props: { editor: Editor }) {
  // eslint-disable-next-line solid/reactivity -- 편집기 객체는 화면마다 한 번 만들어지고 바뀌지 않습니다.
  const editor = props.editor
  const hasVariant = (id: LayoutId) =>
    id === homeLayout(editor.key())
      ? Boolean(fontProject.jamo[editor.key()]?.base)
      : Boolean(fontProject.jamo[editor.key()]?.variants?.[id])
  return (
    <Segmented
      legend="배치 (벌)"
      size="small"
      value={editor.layout()}
      onChange={(id) => editor.selectLayout(id)}
      options={layoutsOf(editor.key()).map((id) => ({
        value: id,
        label: (
          <>
            <span class={styles.layoutSample}>{LAYOUT_INFO[id].sample}</span>
            <Show when={id === homeLayout(editor.key())}>
              <span class={styles.tag}>기본</span>
            </Show>
            <Show when={id !== homeLayout(editor.key()) && hasVariant(id)}>
              <span class={styles.dot} aria-hidden="true" />
            </Show>
          </>
        ),
        accessibleLabel: `${LAYOUT_INFO[id].sample} 모양 (${LAYOUT_INFO[id].label})${
          id === homeLayout(editor.key()) ? ', 기본 그림' : hasVariant(id) ? ', 따로 그림 있음' : ''
        }`,
        description: LAYOUT_INFO[id].description,
      }))}
    />
  )
}

/** 지금 보는 그림이 어디서 왔는지와, 그에 맞는 동작 */
export function SourceNotice(props: { editor: Editor }) {
  // eslint-disable-next-line solid/reactivity -- 편집기 객체는 화면마다 한 번 만들어지고 바뀌지 않습니다.
  const editor = props.editor
  const sources = () => derivationSources(editor.key()).map(jamoChar).join(' + ')
  return (
    <div class={styles.notice}>
      <Show when={editor.source() === 'derived'}>
        <p>
          <strong>자동</strong> 이 자모는 {sources()}(으)로 자동으로 만들어집니다. 원래 자모를
          고치면 함께 바뀝니다.
        </p>
        <Button size="small" variant="primary" onClick={() => editor.adopt()}>
          직접 그리기
        </Button>
      </Show>
      <Show when={editor.source() === 'inherited'}>
        <p>
          <strong>기본 그림</strong> 이 배치에서는 기본 그림을 '
          {LAYOUT_INFO[editor.layout()].sample}' 틀에 맞춰 늘여 씁니다.
        </p>
        <Button size="small" variant="primary" onClick={() => editor.adopt()}>
          이 배치만 따로 그리기
        </Button>
      </Show>
      <Show when={editor.source() === 'empty'}>
        <p>
          <strong>비어 있음</strong> 아직 획이 없습니다. 판에 점을 찍어 그리세요.
        </p>
      </Show>
      <Show when={editor.source() === 'own'}>
        <p>
          <strong>직접 그림</strong>
          {editor.isHome()
            ? ' 이 자모의 기본 그림입니다.'
            : ` '${LAYOUT_INFO[editor.layout()].sample}' 배치에서만 쓰는 그림입니다.`}
        </p>
        <div class={styles.noticeActions}>
          <Show when={!editor.isHome() || isDerivable(editor.key())}>
            <Button size="small" variant="secondary" onClick={() => editor.revert()}>
              <Icon name="reset" size={16} />
              {editor.isHome() ? '자동으로 되돌리기' : '따로 그린 것 지우기'}
            </Button>
          </Show>
          <Button
            size="small"
            variant="ghost"
            onClick={() => editor.clearAll()}
            disabled={editor.ownStrokes().length === 0}
          >
            <Icon name="trash" size={16} />획 모두 지우기
          </Button>
        </div>
      </Show>
    </div>
  )
}

/** 도구와 그리기 동작 */
export function EditorToolbar(props: { editor: Editor }) {
  // eslint-disable-next-line solid/reactivity -- 편집기 객체는 화면마다 한 번 만들어지고 바뀌지 않습니다.
  const editor = props.editor
  const snapId = createUniqueId()
  return (
    <div class={styles.toolbar}>
      <Segmented
        legend="그리기 도구"
        value={editor.tool()}
        onChange={(tool) => editor.setTool(tool)}
        options={TOOLS.map((tool) => ({
          value: tool,
          label: (
            <>
              <Icon name={TOOL_ICON[tool]} size={18} />
              {TOOL_LABEL[tool]}
            </>
          ),
        }))}
      />
      <div class={styles.row}>
        <Button
          size="small"
          variant="secondary"
          disabled={editor.pending().length === 0 || editor.tool() === 'ellipse'}
          onClick={() => editor.finish()}
        >
          <Icon name="check" size={16} />획 마치기
        </Button>
        <Button
          size="small"
          variant="ghost"
          disabled={editor.pending().length === 0 && !editor.selectedId()}
          onClick={() => editor.cancel()}
        >
          취소
        </Button>
        <div class={styles.grid}>
          <SelectField
            label="격자"
            value={String(editor.divisions())}
            onChange={(v) => editor.setDivisions(Number(v))}
            options={[
              { value: '12', label: '12칸 (굵은 모듈)' },
              { value: '24', label: '24칸' },
              { value: '48', label: '48칸 (세밀하게)' },
            ]}
          />
          <label class={styles.check} for={snapId}>
            <input
              id={snapId}
              type="checkbox"
              checked={editor.snap()}
              onChange={(event) => editor.setSnap(event.currentTarget.checked)}
            />
            격자에 맞추기
          </label>
        </div>
      </div>
    </div>
  )
}

/** 획 목록: 그림을 글로 확인하고 키보드로 고르거나 옮기고 지웁니다. */
export function StrokeList(props: { editor: Editor }) {
  // eslint-disable-next-line solid/reactivity -- 편집기 객체는 화면마다 한 번 만들어지고 바뀌지 않습니다.
  const editor = props.editor
  const describe = (index: number) => {
    const stroke = editor.ownStrokes()[index]!
    if (stroke.kind === 'ellipse') return '원'
    const kind = stroke.smooth ? '곡선' : '직선'
    return `${stroke.closed ? '닫힌 ' : ''}${kind}, 점 ${stroke.points.length}개`
  }
  return (
    <Show
      when={editor.ownStrokes().length > 0}
      fallback={<p class={styles.empty}>직접 그린 획이 없습니다.</p>}
    >
      <ol class={styles.strokes}>
        <For each={editor.ownStrokes()}>
          {(stroke, index) => {
            const selected = () => editor.selectedId() === stroke.id
            return (
              <li class={styles.stroke} classList={{ [styles.strokeSelected!]: selected() }}>
                <span class={styles.strokeName}>
                  획 {index() + 1} <span class={styles.strokeKind}>{describe(index())}</span>
                </span>
                <span class={styles.strokeActions}>
                  <Button
                    size="small"
                    variant="ghost"
                    aria-pressed={selected() ? 'true' : 'false'}
                    onClick={() => editor.selectStroke(selected() ? null : stroke.id)}
                  >
                    고르기
                  </Button>
                  <Show when={stroke.kind === 'path' && stroke.points.length >= 3 ? stroke : null}>
                    {(path) => (
                      <Button
                        size="small"
                        variant="ghost"
                        onClick={() => editor.toggleSmooth(stroke.id, !path().smooth)}
                      >
                        {path().smooth ? '직선으로' : '곡선으로'}
                      </Button>
                    )}
                  </Show>
                  <Button
                    size="small"
                    variant="ghost"
                    onClick={() => editor.deleteStroke(stroke.id)}
                  >
                    지우기<span class="visually-hidden"> (획 {index() + 1})</span>
                  </Button>
                </span>
              </li>
            )
          }}
        </For>
      </ol>
      <Show when={editor.selectedId()}>
        <div class={styles.nudge} role="group" aria-label="고른 획 옮기기">
          <span class={styles.nudgeLabel}>고른 획 옮기기</span>
          <Button size="small" variant="secondary" iconOnly onClick={() => editor.nudge(0, -1)}>
            <Icon name="arrowUp" size={16} />
            <span class="visually-hidden">위로 한 칸</span>
          </Button>
          <Button size="small" variant="secondary" iconOnly onClick={() => editor.nudge(0, 1)}>
            <Icon name="arrowDown" size={16} />
            <span class="visually-hidden">아래로 한 칸</span>
          </Button>
          <Button size="small" variant="secondary" iconOnly onClick={() => editor.nudge(-1, 0)}>
            <Icon name="arrowLeft" size={16} />
            <span class="visually-hidden">왼쪽으로 한 칸</span>
          </Button>
          <Button size="small" variant="secondary" iconOnly onClick={() => editor.nudge(1, 0)}>
            <Icon name="arrowRight" size={16} />
            <span class="visually-hidden">오른쪽으로 한 칸</span>
          </Button>
          <Button size="small" variant="danger" onClick={() => editor.deleteSelected()}>
            <Icon name="trash" size={16} />
            고른 획 지우기
          </Button>
        </div>
      </Show>
    </Show>
  )
}
