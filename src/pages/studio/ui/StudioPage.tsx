import { useSearchParams } from '@solidjs/router'
import { createEffect, on } from 'solid-js'
import {
  type JamoKey,
  type LayoutId,
  canRedo,
  canUndo,
  homeLayout,
  isJamoKey,
  isLayoutId,
  jamoLabel,
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
import { EditorToolbar, LayoutPicker, SourceNotice, StrokeList } from './EditorControls.tsx'
import { JamoCanvas } from './JamoCanvas.tsx'
import { JamoPalette } from './JamoPalette.tsx'
import { LayoutPreview } from './LayoutPreview.tsx'
import styles from './StudioPage.module.css'

type StudioParams = { jamo?: string; layout?: string }

/** 주소의 자모·배치 (잘못된 값이면 ㄱ 초성·기본 배치) */
function targetOf(params: Partial<StudioParams>): { key: JamoKey; layout: LayoutId } {
  const key = params.jamo && isJamoKey(params.jamo) ? params.jamo : 'L0'
  const layout =
    params.layout && isLayoutId(params.layout) && layoutsOf(key).includes(params.layout)
      ? params.layout
      : homeLayout(key)
  return { key, layout }
}

export function StudioPage() {
  usePageTitle('작업실')
  // 작업실 주소(/studio?jamo=L5&layout=D)로 특정 자모·배치를 열고, 고르면 주소도 바꿔 새로 고쳐도 이어지게 합니다.
  const [params, setParams] = useSearchParams<StudioParams>()
  const initial = targetOf(params)
  const editor = createEditor(initial.key, initial.layout)

  // 주소가 바뀌면(다른 화면의 링크, 뒤로 가기) 그 자모·배치를 엽니다.
  createEffect(
    on(
      () => targetOf(params),
      (target) => {
        if (target.key !== editor.key()) editor.selectJamo(target.key)
        if (target.layout !== editor.layout()) editor.selectLayout(target.layout)
      },
      { defer: true },
    ),
  )
  // 고르면 주소를 바꿉니다(방문 기록은 쌓지 않음). 기본 배치면 layout은 생략합니다.
  createEffect(
    on(
      [editor.key, editor.layout],
      ([key, layout]) => {
        const current = targetOf(params)
        if (current.key === key && current.layout === layout) return
        setParams(
          { jamo: key, layout: layout === homeLayout(key) ? undefined : layout },
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
        lead="획의 가운데 선만 그리면 굵기는 조합기가 입힙니다. 자음 14자와 모음 10자만 그려도 나머지 자모와 11,172자가 모두 만들어집니다."
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
        <Panel title="자모 고르기" class={styles.palette}>
          <JamoPalette editor={editor} />
        </Panel>

        <Panel
          title={`${jamoLabel(editor.key())} 그리기`}
          class={styles.editor}
          description="주황 점선 틀 안에 뼈대를 그리면, 흐린 글자 안에서 어떻게 보이는지 바로 나타납니다."
        >
          <LayoutPicker editor={editor} />
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
          <Panel title="배치별 미리보기">
            <LayoutPreview editor={editor} />
          </Panel>
          <Panel title="획 스타일" description="바꾸면 11,172자 전체에 한꺼번에 적용됩니다.">
            <StylePanel showMetrics />
          </Panel>
        </div>
      </div>
    </div>
  )
}
