import { For, Show, createSignal, createUniqueId } from 'solid-js'
import { Icon } from '@/shared/ui/icon'
import type { Importer } from '../model/importer.ts'
import styles from './ImportPage.module.css'

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,application/pdf,.pdf'

const STATE_LABEL = { working: '처리 중', done: '완료', error: '확인 필요' } as const

/** 2단계: 사진·스캔·PDF 올리기 (파일 고르기 버튼과 끌어다 놓기) */
export function UploadPanel(props: { importer: Importer }) {
  const inputId = createUniqueId()
  const [dragging, setDragging] = createSignal(false)

  const take = (list: FileList | null | undefined) => {
    if (!list || list.length === 0) return
    void props.importer.addTemplateFiles([...list])
  }

  return (
    <div class={styles.stack}>
      {/* 끌어다 놓기는 보조 수단이고, 키보드로는 안의 파일 고르기 버튼을 씁니다. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        class={styles.drop}
        classList={{ [styles.dropActive!]: dragging() }}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          take(event.dataTransfer?.files)
        }}
      >
        <span class={styles.fileButton}>
          <input
            id={inputId}
            class="visually-hidden"
            type="file"
            accept={ACCEPT}
            multiple
            onChange={(event) => {
              take(event.currentTarget.files)
              event.currentTarget.value = ''
            }}
          />
          <label for={inputId} class={styles.fileLabel}>
            <Icon name="upload" size={18} />
            사진·스캔·PDF 고르기
          </label>
        </span>
        <p class={styles.dropHint}>
          또는 여기에 파일을 끌어다 놓으세요. PNG·JPEG·WebP·PDF, 여러 장 가능
        </p>
      </div>

      <fieldset class={styles.fieldset}>
        <legend class={styles.legend}>인식 방식</legend>
        <label class={styles.check}>
          <input
            type="checkbox"
            checked={props.importer.divisions() !== null}
            onChange={(event) =>
              props.importer.setDivisions(event.currentTarget.checked ? 24 : null)
            }
          />
          <span>
            <strong>격자(24칸)에 맞추기</strong>
            <span class={styles.checkHint}>손떨림을 지우고 반듯한 모듈 글꼴로</span>
          </span>
        </label>
        <label class={styles.check}>
          <input
            type="checkbox"
            checked={props.importer.smooth()}
            onChange={(event) => props.importer.setSmooth(event.currentTarget.checked)}
          />
          <span>
            <strong>곡선으로 매끄럽게</strong>
            <span class={styles.checkHint}>꺾은선 대신 점을 지나는 곡선으로 잇기</span>
          </span>
        </label>
      </fieldset>

      <Show when={props.importer.sources.length > 0}>
        <ul class={styles.sources} aria-label="올린 파일">
          <For each={props.importer.sources}>
            {(source) => (
              <li class={styles.source} data-state={source.state}>
                <span class={styles.sourceState}>{STATE_LABEL[source.state]}</span>
                <span class={styles.sourceText}>{source.message || source.label}</span>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  )
}
