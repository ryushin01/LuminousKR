import { MemoryRouter, Route } from '@solidjs/router'
import { render, screen } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { createPresetProject, replaceProject } from '@/entities/font'
import { type Importer, createImporter } from '../model/importer.ts'
import type { RecognizedCell } from '../worker/recognize-protocol.ts'
import { CandidateList } from './CandidateList.tsx'

const preview = new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], { type: 'image/svg+xml' })

const cell = (key: string): RecognizedCell => ({
  key,
  strokes: [
    {
      kind: 'path',
      points: [
        { x: 0.1, y: 0.2 },
        { x: 0.42, y: 0.2 },
        { x: 0.42, y: 0.86 },
      ],
      closed: false,
      smooth: false,
    },
  ],
  ink: 0.05,
  penWidth: 0.05,
  preview,
})

/** 파일마다 ㄱ·ㄴ 두 칸을 인식한 것으로 보고 목록을 그립니다. */
async function renderList(fileNames: string[]) {
  let importer!: Importer
  render(() => {
    importer = createImporter({
      readPageSources: async (file) => ({
        pages: [{ label: file.name, bitmap: { close() {} } as ImageBitmap }],
        skippedPages: 0,
      }),
      recognizeTemplatePage: async () => ({
        ok: true,
        setId: 1,
        empty: [],
        cells: [cell('L0'), cell('L2')],
      }),
      recognizeSingleImage: async () => ({ ok: false, message: '' }),
    })
    return (
      <MemoryRouter root={() => <CandidateList importer={importer} />}>
        <Route path="*" component={() => null} />
      </MemoryRouter>
    )
  })
  await importer.addTemplateFiles(fileNames.map((name) => new File(['x'], name)))
  return importer
}

const giyeok = (source: string) =>
  screen.getByRole('checkbox', { name: new RegExp(`ㄱ 초성 적용.*${source}`) })

describe('CandidateList', () => {
  beforeEach(() => replaceProject(createPresetProject()))

  it('같은 자모가 없으면 하나만 적용된다는 안내를 보이지 않습니다', async () => {
    await renderList(['양식.jpg'])
    expect(giyeok('양식.jpg')).toBeChecked()
    expect(screen.queryByText(/자모마다 하나만 적용하므로/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '고른 자모 2자 적용' })).toBeEnabled()
  })

  it('같은 자모의 다른 칸을 고르면 앞의 것이 풀리고, 적용할 수도 그만큼만 셉니다', async () => {
    const user = userEvent.setup()
    await renderList(['첫 사진.jpg', '다시 찍은 사진.jpg'])
    expect(screen.getByText(/자모마다 하나만 적용하므로/)).toBeInTheDocument()
    expect(giyeok('첫 사진.jpg')).not.toBeChecked()
    expect(giyeok('다시 찍은 사진.jpg')).toBeChecked()

    await user.click(giyeok('첫 사진.jpg'))
    expect(giyeok('첫 사진.jpg')).toBeChecked()
    expect(giyeok('다시 찍은 사진.jpg')).not.toBeChecked()
    expect(screen.getByRole('button', { name: '고른 자모 2자 적용' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: '모두 고르기' }))
    expect(giyeok('다시 찍은 사진.jpg')).toBeChecked()
    expect(giyeok('첫 사진.jpg')).not.toBeChecked()

    await user.click(screen.getByRole('button', { name: '모두 풀기' }))
    expect(screen.getByRole('button', { name: '고른 자모 0자 적용' })).toBeDisabled()
  })
})
