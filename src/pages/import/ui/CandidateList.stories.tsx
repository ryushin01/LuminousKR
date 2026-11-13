import { MemoryRouter, Route } from '@solidjs/router'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { createImporter } from '../model/importer.ts'
import type { RecognizedCell } from '../worker/recognize-protocol.ts'
import { CandidateList } from './CandidateList.tsx'

const scan = (body: string) =>
  new Blob(
    [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#fff"/>${body}</svg>`,
    ],
    { type: 'image/svg+xml' },
  )

const GIYEOK: RecognizedCell = {
  key: 'L0',
  ink: 0.05,
  penWidth: 0.03,
  preview: scan('<path d="M10 20H42V86" fill="none" stroke="#111" stroke-width="5"/>'),
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
}

const IEUNG: RecognizedCell = {
  key: 'L11',
  ink: 0.05,
  penWidth: 0.03,
  preview: scan(
    '<ellipse cx="27" cy="50" rx="18" ry="24" fill="none" stroke="#111" stroke-width="5"/>',
  ),
  strokes: [{ kind: 'ellipse', cx: 0.27, cy: 0.5, rx: 0.18, ry: 0.24 }],
}

/** 인식 결과 예시 (워커 대신 정해 둔 결과를 씁니다). 파일 이름마다 한 번씩 올립니다. */
function renderSample(files: string[]) {
  const importer = createImporter({
    readPageSources: async (file) => ({
      pages: [{ label: file.name, bitmap: { close() {} } as ImageBitmap }],
      skippedPages: 0,
    }),
    recognizeTemplatePage: async () => ({ ok: true, setId: 1, empty: [], cells: [GIYEOK, IEUNG] }),
    recognizeSingleImage: async () => ({ ok: false, message: '' }),
  })
  void importer.addTemplateFiles(files.map((name) => new File(['x'], name)))
  return <CandidateList importer={importer} />
}

const meta = {
  title: 'pages/import/CandidateList',
  component: CandidateList,
} satisfies Meta

export default meta
// 스토리 안에서 상태를 만들어 그리므로 속성(args)을 받지 않습니다.
type Story = StoryObj

const inRouter = (files: string[]) => () => (
  <MemoryRouter root={() => renderSample(files)}>
    <Route path="*" component={() => null} />
  </MemoryRouter>
)

export const Recognized: Story = { render: inRouter(['손글씨-양식.jpg']) }

/** 같은 양식을 두 번 올리면 자모마다 나중 것만 고르고, 하나만 적용된다는 안내가 보입니다. */
export const UploadedTwice: Story = { render: inRouter(['첫 사진.jpg', '다시 찍은 사진.jpg']) }
