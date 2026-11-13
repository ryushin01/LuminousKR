import { usePageTitle } from '@/shared/lib/page'
import { PageHeader } from '@/shared/ui/page-header'
import { Panel } from '@/shared/ui/panel'
import { StatusMessage } from '@/shared/ui/status-message'
import { createImporter } from '../model/importer.ts'
import { CandidateList } from './CandidateList.tsx'
import styles from './ImportPage.module.css'
import { SinglePanel } from './SinglePanel.tsx'
import { TemplatePanel } from './TemplatePanel.tsx'
import { UploadPanel } from './UploadPanel.tsx'

export function ImportPage() {
  usePageTitle('가져오기')
  const importer = createImporter()
  return (
    <div class={styles.page}>
      <PageHeader
        number="03"
        label="가져오기"
        title="손글씨로 시작합니다"
        lead="양식을 인쇄해 자모를 그리고 사진이나 스캔 PDF를 올리면, 네 모서리 표식으로 기울기를 바로잡고 칸마다 획의 뼈대를 찾아 가져옵니다. 그림은 이 브라우저의 작업 스레드에서만 처리합니다."
      />
      <div class={styles.grid}>
        <Panel title="양식 받기" number="1">
          <TemplatePanel />
        </Panel>
        <Panel title="사진·스캔 올리기" number="2">
          <UploadPanel importer={importer} />
        </Panel>
        <Panel
          title="인식 결과"
          number="3"
          class={styles.wide}
          description="왼쪽은 바로잡은 칸, 오른쪽은 찾은 뼈대입니다."
        >
          {/* 같은 내용이 '올린 파일' 목록에 보이므로 화면 낭독기에만 알립니다. */}
          <StatusMessage message={importer.announcement()} hidden />
          <CandidateList importer={importer} />
        </Panel>
        <Panel title="양식 없이 그림 한 장" class={styles.wide}>
          <SinglePanel importer={importer} />
        </Panel>
      </div>
    </div>
  )
}
