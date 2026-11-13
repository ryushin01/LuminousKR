import { onCleanup, onMount } from 'solid-js'
import { canRedo, canUndo, jamoLabel, redo, undo } from '@/entities/font'
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

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

export function StudioPage() {
  usePageTitle('작업실')
  const editor = createEditor()

  // 되돌리기 단축키: Ctrl·⌘ + Z, 다시하기: Ctrl·⌘ + Shift + Z 또는 Ctrl + Y (글자 입력 중에는 입력칸의 기본 동작)
  const onKeyDown = (event: KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey) || isTyping(event.target)) return
    const key = event.key.toLowerCase()
    if (key === 'z') {
      event.preventDefault()
      if (event.shiftKey) redo()
      else undo()
    } else if (key === 'y') {
      event.preventDefault()
      redo()
    }
  }
  onMount(() => document.addEventListener('keydown', onKeyDown))
  onCleanup(() => document.removeEventListener('keydown', onKeyDown))

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
