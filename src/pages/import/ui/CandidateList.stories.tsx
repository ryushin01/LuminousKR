import { MemoryRouter, Route } from '@solidjs/router'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { createImporter } from '../model/importer.ts'
import { CandidateList } from './CandidateList.tsx'

const scan = (body: string) =>
  new Blob(
    [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#fff"/>${body}</svg>`,
    ],
    { type: 'image/svg+xml' },
  )

/** 인식 결과 예시 (워커 대신 정해 둔 결과를 씁니다) */
function SampleList() {
  const importer = createImporter({
    readPageSources: async (file) => [{ label: file.name, bitmap: {} as ImageBitmap }],
    recognizeTemplatePage: async () => ({
      ok: true,
      setId: 1,
      empty: [],
      cells: [
        {
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
        },
        {
          key: 'L11',
          ink: 0.05,
          penWidth: 0.03,
          preview: scan(
            '<ellipse cx="27" cy="50" rx="18" ry="24" fill="none" stroke="#111" stroke-width="5"/>',
          ),
          strokes: [{ kind: 'ellipse', cx: 0.27, cy: 0.5, rx: 0.18, ry: 0.24 }],
        },
      ],
    }),
    recognizeSingleImage: async () => ({ ok: false, message: '' }),
  })
  void importer.addTemplateFiles([new File(['x'], '손글씨-양식.jpg', { type: 'image/jpeg' })])
  return <CandidateList importer={importer} />
}

const meta = {
  title: 'pages/import/CandidateList',
  component: CandidateList,
  render: () => (
    <MemoryRouter root={() => <SampleList />}>
      <Route path="*" component={() => null} />
    </MemoryRouter>
  ),
} satisfies Meta

export default meta
// 스토리 안에서 상태를 만들어 그리므로 속성(args)을 받지 않습니다.
type Story = StoryObj

export const Recognized: Story = {}
