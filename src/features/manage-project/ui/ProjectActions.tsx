import { Show, createSignal, createUniqueId } from 'solid-js'
import {
  ProjectFormatError,
  createBlankProject,
  createPresetProject,
  fontProject,
  parseProjectJson,
  projectToJson,
  replaceProject,
} from '@/entities/font'
import { downloadFile, safeFileName } from '@/shared/lib/download'
import { Button } from '@/shared/ui/button'
import { Icon } from '@/shared/ui/icon'
import { StatusMessage } from '@/shared/ui/status-message'
import styles from './ProjectActions.module.css'

const MAX_PROJECT_BYTES = 5 * 1024 * 1024

/**
 * 프로젝트 저장·열기·새로 시작.
 * 작업은 브라우저에 자동 저장되고, 파일로 저장하면 다른 기기에서도 이어 할 수 있습니다.
 * 새로 시작해도 '되돌리기'로 이전 상태로 돌아갈 수 있습니다.
 */
export function ProjectActions(props: { compact?: boolean }) {
  const inputId = createUniqueId()
  const [message, setMessage] = createSignal('')
  const [error, setError] = createSignal('')

  const save = () => {
    downloadFile(
      projectToJson(),
      `${safeFileName(fontProject.name, 'luminous-project')}.luminous.json`,
      'application/json',
    )
    setError('')
    setMessage('프로젝트 파일(.json)을 내려받았습니다.')
  }

  const open = async (file: File | undefined) => {
    if (!file) return
    setMessage('')
    if (file.size > MAX_PROJECT_BYTES) {
      setError('파일이 너무 큽니다(5MB 넘음). LuminousKR에서 저장한 .json 파일을 골라 주세요.')
      return
    }
    try {
      const project = parseProjectJson(await file.text())
      replaceProject(project)
      setError('')
      setMessage(
        `'${project.name}' 프로젝트를 열었습니다. 되돌리기로 이전 작업에 돌아갈 수 있습니다.`,
      )
    } catch (cause) {
      setError(
        cause instanceof ProjectFormatError
          ? cause.message
          : '파일을 읽지 못했습니다. 다른 파일로 다시 시도해 주세요.',
      )
    }
  }

  const reset = (blank: boolean) => {
    replaceProject(blank ? createBlankProject() : createPresetProject())
    setError('')
    setMessage(
      blank
        ? '빈 글꼴로 시작합니다. 기본 자모 24자를 그리면 11,172자가 만들어집니다. 되돌리기로 돌아갈 수 있습니다.'
        : '기본 글꼴로 되돌렸습니다. 되돌리기로 이전 작업에 돌아갈 수 있습니다.',
    )
  }

  return (
    <div class={styles.wrap}>
      <div class={styles.actions}>
        <Button size="small" variant="secondary" onClick={save}>
          <Icon name="download" size={16} />
          프로젝트 저장
        </Button>
        <span class={styles.fileButton}>
          <input
            id={inputId}
            class="visually-hidden"
            type="file"
            accept=".json,application/json"
            onChange={(event) => {
              void open(event.currentTarget.files?.[0])
              event.currentTarget.value = ''
            }}
          />
          <label for={inputId} class={styles.fileLabel}>
            <Icon name="upload" size={16} />
            프로젝트 열기
          </label>
        </span>
        <Show when={!props.compact}>
          <Button size="small" variant="ghost" onClick={() => reset(false)}>
            <Icon name="reset" size={16} />
            기본 글꼴로
          </Button>
          <Button size="small" variant="ghost" onClick={() => reset(true)}>
            <Icon name="plus" size={16} />빈 글꼴로 시작
          </Button>
        </Show>
      </div>
      <StatusMessage message={message()} tone="success" />
      <StatusMessage kind="alert" message={error()} tone="danger" />
    </div>
  )
}
