import { useSearchParams } from '@solidjs/router'
import { Show, createEffect, on } from 'solid-js'
import {
  type JamoKey,
  type LayoutId,
  canRedo,
  canUndo,
  homeLayout,
  isJamoKey,
  isLatinChar,
  isLayoutId,
  layoutsOf,
  redo,
  undo,
} from '@/entities/font'
import { StylePanel } from '@/features/adjust-style'
import { ProjectActions } from '@/features/manage-project'
import { usePageTitle } from '@/shared/lib/page'
import { Button } from '@/shared/ui/button'
import { Icon } from '@/shared/ui/icon'
import { PageHeader } from '@/shared/ui/page-header'
import { Panel } from '@/shared/ui/panel'
import { StatusMessage } from '@/shared/ui/status-message'
import { createEditor } from '../model/editor.ts'
import {
  EditorToolbar,
  LatinWidthField,
  LayoutPicker,
  SourceNotice,
  StrokeList,
} from './EditorControls.tsx'
import { JamoCanvas } from './JamoCanvas.tsx'
import { JamoPalette } from './JamoPalette.tsx'
import { LatinPreview } from './LatinPreview.tsx'
import { LayoutPreview } from './LayoutPreview.tsx'
import styles from './StudioPage.module.css'

type StudioParams = { jamo?: string; layout?: string; char?: string }

/**
 * 주소의 자모·배치 (잘못된 값이면 ㄱ 초성·기본 배치)와 영문 글자(?char=, 있으면 자모 대신 이 글자를 엶)
 */
function targetOf(params: Partial<StudioParams>): {
  key: JamoKey
  layout: LayoutId
  latin: string | null
} {
  const key = params.jamo && isJamoKey(params.jamo) ? params.jamo : 'L0'
  const layout =
    params.layout && isLayoutId(params.layout) && layoutsOf(key).includes(params.layout)
      ? params.layout
      : homeLayout(key)
  const latin = params.char && isLatinChar(params.char) ? params.char : null
  return { key, layout, latin }
}

export function StudioPage() {
  usePageTitle('작업실')
  // 작업실 주소(/studio?jamo=L5&layout=D, 영문은 /studio?char=A)로 특정 자모·배치나 글자를 열고,
  // 고르면 주소도 바꿔 새로 고쳐도 이어지게 합니다.
  const [params, setParams] = useSearchParams<StudioParams>()
  const initial = targetOf(params)
  const editor = createEditor(initial.key, initial.layout, initial.latin ?? undefined)

  // 주소가 바뀌면(다른 화면의 링크, 뒤로 가기) 그 자모·배치나 글자를 엽니다.
  createEffect(
    on(
      () => targetOf(params),
      (target) => {
        if (target.latin !== null) {
          if (target.latin !== editor.latin()) editor.selectLatin(target.latin)
          return
        }
        if (editor.latin() !== null || target.key !== editor.key()) editor.selectJamo(target.key)
        if (target.layout !== editor.layout()) editor.selectLayout(target.layout)
      },
      { defer: true },
    ),
  )
  // 고르면 주소를 바꿉니다(방문 기록은 쌓지 않음). 기본 배치면 layout은 생략합니다.
  createEffect(
    on(
      [editor.key, editor.layout, editor.latin],
      ([key, layout, latin]) => {
        const current = targetOf(params)
        if (latin !== null) {
          if (current.latin !== latin) {
            setParams({ char: latin, jamo: undefined, layout: undefined }, { replace: true })
          }
          return
        }
        if (current.latin === null && current.key === key && current.layout === layout) return
        setParams(
          { char: undefined, jamo: key, layout: layout === homeLayout(key) ? undefined : layout },
          { replace: true },
        )
      },
      { defer: true },
    ),
  )

  // 되돌리기 단축키(Ctrl·⌘ + Z 등)는 앱 공통(app/lib/undoShortcuts)에서 모든 화면에 겁니다.

  return (
    <div class={styles.page}>
      <PageHeader
        number="02"
        label="작업실"
        title="자모의 뼈대를 그립니다"
        lead="획의 가운데 선만 그리면 굵기는 조합기가 입힙니다. 자음 14자와 모음 10자만 그려도 나머지 자모와 11,172자가 모두 만들어지고, 영문·숫자·문장부호 94자는 기본 뼈대로 들어 있어 고쳐 쓸 수 있습니다."
      >
        <div class={styles.bar}>
          <div class={styles.history}>
            <Button size="small" variant="secondary" disabled={!canUndo()} onClick={undo}>
              <Icon name="undo" size={16} />
              되돌리기
            </Button>
            <Button size="small" variant="secondary" disabled={!canRedo()} onClick={redo}>
              <Icon name="redo" size={16} />
              다시하기
            </Button>
          </div>
          <ProjectActions />
        </div>
      </PageHeader>

      <div class={styles.workspace}>
        <Panel title="자모·글자 고르기" class={styles.palette}>
          <JamoPalette editor={editor} />
        </Panel>

        <Panel
          title={`${editor.label()} 그리기`}
          class={styles.editor}
          description={
            editor.isLatin()
              ? '파란 안내선에 맞춰 뼈대를 그리면 굵기를 입힌 모양이 바로 나타납니다. 주황 점선 틀의 오른쪽 끝이 글자 너비입니다.'
              : '주황 점선 틀 안에 뼈대를 그리면, 흐린 글자 안에서 어떻게 보이는지 바로 나타납니다.'
          }
        >
          <Show when={editor.isLatin()} fallback={<LayoutPicker editor={editor} />}>
            <LatinWidthField editor={editor} />
          </Show>
          <SourceNotice editor={editor} />
          <EditorToolbar editor={editor} />
          <JamoCanvas editor={editor} />
          <StatusMessage class={styles.announce} message={editor.announcement()} />
          <section class={styles.strokes} aria-labelledby="stroke-list-title">
            <h3 id="stroke-list-title" class={styles.subTitle}>
              획 목록
            </h3>
            <StrokeList editor={editor} />
          </section>
        </Panel>

        <div class={styles.side}>
          <Panel title={editor.isLatin() ? '앞뒤 글자와 함께 보기' : '배치별 미리보기'}>
            <Show when={editor.isLatin()} fallback={<LayoutPreview editor={editor} />}>
              <LatinPreview editor={editor} />
            </Show>
          </Panel>
          <Panel
            title="획 스타일"
            description="바꾸면 한글 11,172자와 영문·숫자·문장부호에 한꺼번에 적용됩니다."
          >
            <StylePanel showMetrics />
          </Panel>
        </div>
      </div>
    </div>
  )
}
