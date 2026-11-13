import { For, createSignal } from 'solid-js'
import {
  type JamoKey,
  LAYOUT_INFO,
  ROLE_LABEL,
  createPresetProject,
  fontProject,
  frameBox,
  homeLayout,
  jamoChar,
  parseJamoKey,
  renderGlyphs,
} from '@/entities/font'
import { downloadFile } from '@/shared/lib/download'
import { isCompatJamoCode, isSyllableCode } from '@/shared/lib/hangul'
import { Button } from '@/shared/ui/button'
import { Icon } from '@/shared/ui/icon'
import { StatusMessage } from '@/shared/ui/status-message'
import { type TemplateCellSpec, buildTemplatePdf, templateText } from '../lib/template-pdf.ts'
import { TEMPLATE_SETS } from '../model/template-sets.ts'
import styles from './ImportPage.module.css'

/** 칸에 그릴 자모 틀과, 같은 배치에서 다른 자모가 놓일 자리 */
function cellSpec(key: JamoKey): TemplateCellSpec {
  const layout = homeLayout(key)
  const boxes = fontProject.layouts[layout]
  const role = parseJamoKey(key).role
  const frame = frameBox(fontProject.layouts, key, layout)
  const context = [
    role !== 'L' ? boxes.L : null,
    role !== 'V' && !(boxes.Vh && role === 'T') ? boxes.V : null,
    role === 'T' && boxes.Vh ? boxes.Vh : null,
    role === 'T' && boxes.Vv ? boxes.Vv : null,
    role !== 'T' ? (boxes.T ?? null) : null,
  ].filter((box): box is NonNullable<typeof box> => box !== null)
  return { key, label: `${jamoChar(key)} ${ROLE_LABEL[role]}`, frame, context }
}

/** 1단계: 인쇄용 손글씨 양식 PDF 받기 */
export function TemplatePanel() {
  const [chosen, setChosen] = createSignal(new Set([1]))
  const [message, setMessage] = createSignal('')
  const [error, setError] = createSignal('')
  const [busy, setBusy] = createSignal(false)
  let locked = false

  const toggle = (id: number, on: boolean) => {
    const next = new Set(chosen())
    if (on) next.add(id)
    else next.delete(id)
    setChosen(next)
  }

  const download = async () => {
    if (locked) return
    const sets = TEMPLATE_SETS.filter((set) => chosen().has(set.id))
    if (sets.length === 0) {
      setError('받을 양식을 하나 이상 골라 주세요.')
      return
    }
    locked = true
    setBusy(true)
    setError('')
    setMessage('양식을 만드는 중입니다…')
    try {
      const pages = sets.map((set) => ({
        id: set.id,
        title: set.name,
        cells: set.keys.map(cellSpec),
      }))
      const chars = [
        ...new Set(
          [...templateText(pages)].filter((c) => {
            const code = c.codePointAt(0) ?? 0
            return isSyllableCode(code) || isCompatJamoCode(code)
          }),
        ),
      ]
      // 이름표 글자는 사용자 프로젝트가 아닌 기본 글꼴로 그려 늘 읽기 쉽게 합니다.
      const glyphs = await renderGlyphs(
        createPresetProject(),
        -7_000_001,
        chars.map((char) => ({ type: 'char', char })),
      )
      const map = new Map(chars.map((char, i) => [char, glyphs[i]?.d ?? '']))
      downloadFile(
        buildTemplatePdf(pages, map),
        'luminouskr-handwriting-template.pdf',
        'application/pdf',
      )
      setMessage(`양식 ${pages.length}쪽(PDF)을 내려받았습니다. A4에 실제 크기(100%)로 인쇄하세요.`)
    } catch {
      setMessage('')
      setError('양식을 만들지 못했습니다. 잠시 뒤 다시 눌러 주세요.')
    } finally {
      locked = false
      setBusy(false)
    }
  }

  return (
    <div class={styles.stack}>
      <fieldset class={styles.fieldset}>
        <legend class={styles.legend}>받을 양식</legend>
        <For each={TEMPLATE_SETS}>
          {(set) => (
            <label class={styles.check}>
              <input
                type="checkbox"
                checked={chosen().has(set.id)}
                onChange={(event) => toggle(set.id, event.currentTarget.checked)}
              />
              <span>
                <strong>{set.name}</strong>
                <span class={styles.checkHint}>{set.description}</span>
              </span>
            </label>
          )}
        </For>
      </fieldset>
      <p class={styles.note}>
        칸 하나가 음절 한 자 크기입니다. 진한 점선 틀이 그 자모의 자리이고, 연한 점선은 '
        {LAYOUT_INFO.A.sample}'·'{LAYOUT_INFO.B.sample}'처럼 함께 놓이는 다른 자모의 자리입니다.
      </p>
      <Button
        variant="primary"
        class={styles.start}
        onClick={download}
        aria-disabled={busy() ? 'true' : undefined}
      >
        <Icon name="download" size={18} />
        양식 PDF 받기
      </Button>
      <StatusMessage message={message()} tone="success" />
      <StatusMessage kind="alert" message={error()} tone="danger" />
    </div>
  )
}
