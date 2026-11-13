import { Show, createEffect, createSignal, onCleanup } from 'solid-js'
import { editProject, fontProject } from '@/entities/font'
import { ProjectActions } from '@/features/manage-project'
import { downloadFile, safeFileName } from '@/shared/lib/download'
import { formatBytes, formatNumber, formatSeconds } from '@/shared/lib/format'
import { usePageTitle } from '@/shared/lib/page'
import { Button } from '@/shared/ui/button'
import { Icon } from '@/shared/ui/icon'
import { PageHeader } from '@/shared/ui/page-header'
import { Panel } from '@/shared/ui/panel'
import { SelectField } from '@/shared/ui/select-field'
import { StatusMessage } from '@/shared/ui/status-message'
import { TextField } from '@/shared/ui/text-field'
import { TOTAL_GLYPHS, createExporter } from '../model/exporter.ts'
import { LICENSE_OPTIONS, validateMeta } from '../model/validation.ts'
import { ConstellationProgress } from './ConstellationProgress.tsx'
import styles from './ExportPage.module.css'

const PHASE_LABEL = {
  compose: '음절 조합',
  encode: 'OTF 파일 쓰기',
  compress: 'WOFF 압축',
} as const

let resultFamilySeq = 0

export function ExportPage() {
  usePageTitle('내보내기')
  const exporter = createExporter()
  const [submitted, setSubmitted] = createSignal(false)
  const [woff, setWoff] = createSignal(true)
  const [resultFamily, setResultFamily] = createSignal<string>()
  let form!: HTMLFormElement
  let resultFace: FontFace | undefined

  const meta = () => fontProject.meta
  const errors = () => validateMeta(meta(), submitted())
  const setMeta = (field: keyof typeof fontProject.meta) => (value: string) =>
    editProject((d) => void (d.meta[field] = value), { coalesce: `meta-${field}` })

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault()
    if (exporter.state() === 'building') return
    setSubmitted(true)
    const found = validateMeta(meta(), true)
    if (Object.keys(found).length > 0) {
      // 첫 오류 칸으로 초점을 옮겨 고치게 합니다.
      queueMicrotask(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    void exporter.start({ woff: woff() })
  }

  // 다 만든 글꼴 파일을 그대로 등록해 이 화면에서 써 봅니다.
  createEffect(() => {
    const result = exporter.result()
    if (!result) return
    resultFamilySeq += 1
    const name = `Luminous Export ${resultFamilySeq}`
    const face = new FontFace(name, result.otf.slice(0))
    face
      .load()
      .then(() => {
        document.fonts.add(face)
        if (resultFace) document.fonts.delete(resultFace)
        resultFace = face
        setResultFamily(name)
      })
      .catch(() => setResultFamily(undefined))
  })
  onCleanup(() => {
    exporter.cancel()
    if (resultFace) document.fonts.delete(resultFace)
  })

  const fileBase = () =>
    safeFileName(
      `${meta().familyName.trim() || 'Luminous'}-${meta().styleName.trim() || 'Regular'}`,
    )
  const progressText = () => {
    const p = exporter.progress()
    if (exporter.state() !== 'building' || !p) return ''
    return `${PHASE_LABEL[p.phase]}: ${formatNumber(Math.min(p.done, TOTAL_GLYPHS))} / ${formatNumber(TOTAL_GLYPHS)}자`
  }
  const doneText = () => {
    const r = exporter.result()
    if (exporter.state() !== 'done' || !r) return ''
    return `글리프 ${formatNumber(r.glyphCount)}개(음절 ${formatNumber(r.syllableCount)}자)를 ${formatSeconds(r.durationMs)} 만에 만들었습니다.`
  }

  return (
    <div class={styles.page}>
      <PageHeader
        number="04"
        label="내보내기"
        title="11,172자를 글꼴 파일로"
        lead="글꼴 이름을 정하고 만들기를 누르면 작업 스레드(Web Worker)가 모든 음절을 조합해 OTF와 WOFF 파일을 만듭니다. 파일은 이 브라우저 안에서만 만들어집니다."
      />
      <div class={styles.grid}>
        <Panel title="글꼴 정보" class={styles.form}>
          <form ref={form} class={styles.fields} onSubmit={onSubmit} noValidate>
            <TextField
              label="글꼴 이름 (영문)"
              required
              value={meta().familyName}
              onInput={setMeta('familyName')}
              error={errors().familyName}
              hint="운영체제 글꼴 목록에 보이는 기본 이름입니다."
              maxLength={48}
              autocomplete="off"
              spellcheck={false}
              lang="en"
            />
            <TextField
              label="글꼴 이름 (한국어)"
              value={meta().familyNameKo}
              onInput={setMeta('familyNameKo')}
              hint="한국어 Windows 등에서 이 이름으로 보입니다."
              maxLength={48}
              autocomplete="off"
            />
            <div class={styles.pair}>
              <TextField
                label="스타일 이름"
                required
                value={meta().styleName}
                onInput={setMeta('styleName')}
                error={errors().styleName}
                maxLength={32}
                autocomplete="off"
                spellcheck={false}
                lang="en"
              />
              <TextField
                label="버전"
                required
                value={meta().version}
                onInput={setMeta('version')}
                error={errors().version}
                inputMode="decimal"
                maxLength={12}
                autocomplete="off"
              />
            </div>
            <TextField
              label="만든 사람"
              value={meta().designer}
              onInput={setMeta('designer')}
              maxLength={80}
              autocomplete="name"
            />
            <SelectField
              label="사용 허락"
              value={meta().license}
              onChange={setMeta('license')}
              options={LICENSE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              hint="글꼴 파일의 이름 정보(name 테이블)에 기록됩니다."
            />
            <TextField
              label="설명"
              multiline
              rows={2}
              value={meta().description}
              onInput={setMeta('description')}
              maxLength={300}
            />

            <fieldset class={styles.formats}>
              <legend>파일 형식</legend>
              <label class={styles.check}>
                <input type="checkbox" checked disabled />
                OTF (설치용, CFF 윤곽)
              </label>
              <label class={styles.check}>
                <input
                  type="checkbox"
                  checked={woff()}
                  onChange={(e) => setWoff(e.currentTarget.checked)}
                />
                WOFF (웹 글꼴, zlib 압축)
              </label>
            </fieldset>

            <div class={styles.submit}>
              {/* 만드는 동안 disabled로 바꾸면 버튼의 키보드 초점이 사라지므로 aria-disabled로 알리고 눌림을 무시합니다. */}
              <Button
                type="submit"
                variant="primary"
                aria-disabled={exporter.state() === 'building' ? 'true' : undefined}
              >
                <Icon name="sparkle" size={18} />
                {exporter.state() === 'building' ? '만드는 중…' : '글꼴 파일 만들기'}
              </Button>
              <Show when={exporter.state() === 'building'}>
                <Button variant="ghost" onClick={() => exporter.cancel()}>
                  취소
                </Button>
              </Show>
            </div>
          </form>
        </Panel>

        <Panel title="만들기" class={styles.build} description="조합된 음절이 하나씩 빛납니다.">
          <ConstellationProgress
            done={exporter.progress()?.done ?? 0}
            complete={exporter.state() === 'done'}
          />
          <div class={styles.progressRow}>
            <label class={styles.progressLabel} for="export-progress">
              진행
            </label>
            <progress
              id="export-progress"
              class={styles.progress}
              max={TOTAL_GLYPHS}
              value={
                exporter.state() === 'done'
                  ? TOTAL_GLYPHS
                  : Math.min(exporter.progress()?.done ?? 0, TOTAL_GLYPHS)
              }
            />
          </div>
          <StatusMessage
            message={progressText() || doneText()}
            tone={exporter.state() === 'done' ? 'success' : 'neutral'}
          />
          <StatusMessage kind="alert" message={exporter.error()} tone="danger" />

          <Show when={exporter.state() === 'done' && exporter.result()}>
            {(result) => (
              <div class={styles.result}>
                <div class={styles.downloads}>
                  <Button
                    variant="primary"
                    onClick={() => downloadFile(result().otf, `${fileBase()}.otf`, 'font/otf')}
                  >
                    <Icon name="download" size={18} />
                    OTF 받기 <span class={styles.size}>{formatBytes(result().otf.byteLength)}</span>
                  </Button>
                  <Show when={result().woff}>
                    {(file) => (
                      <Button
                        variant="secondary"
                        onClick={() => downloadFile(file(), `${fileBase()}.woff`, 'font/woff')}
                      >
                        <Icon name="download" size={18} />
                        WOFF 받기 <span class={styles.size}>{formatBytes(file().byteLength)}</span>
                      </Button>
                    )}
                  </Show>
                </div>
                <Show when={resultFamily()}>
                  <figure class={styles.trial}>
                    <p
                      class={styles.trialText}
                      lang="ko"
                      style={{ 'font-family': `"${resultFamily()}", var(--font-body)` }}
                    >
                      다람쥐 헌 쳇바퀴에 타고파. 빛나는 한글 11,172자가 모두 들어 있습니다.
                    </p>
                    <figcaption class={styles.trialCaption}>
                      방금 만든 글꼴 파일을 이 화면에 등록해 그린 글입니다.
                    </figcaption>
                  </figure>
                </Show>
                <p class={styles.install}>
                  OTF 파일을 두 번 눌러 설치하면 다른 프로그램에서도 쓸 수 있습니다. 웹에서는 WOFF
                  파일을 @font-face로 연결하세요. 영문·숫자·문장부호는 들어 있지 않아 다른 글꼴로
                  보입니다.
                </p>
              </div>
            )}
          </Show>
        </Panel>

        <Panel
          title="프로젝트 파일"
          class={styles.project}
          description="그린 획과 설정을 .json으로 저장해 두면 언제든 이어서 고칠 수 있습니다."
        >
          <ProjectActions compact />
        </Panel>
      </div>
    </div>
  )
}
