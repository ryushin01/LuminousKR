import { StylePanel } from '@/features/adjust-style'
import { usePageTitle } from '@/shared/lib/page'
import { ButtonLink } from '@/shared/ui/button'
import { PageHeader } from '@/shared/ui/page-header'
import { Panel } from '@/shared/ui/panel'
import styles from './PreviewPage.module.css'
import { SyllableTable } from './SyllableTable.tsx'
import { TextSpecimen } from './TextSpecimen.tsx'

export function PreviewPage() {
  usePageTitle('미리보기')
  return (
    <div class={styles.page}>
      <PageHeader
        number="04"
        label="미리보기"
        title="글과 11,172자를 둘러봅니다"
        lead="글을 입력하면 그 글에 쓰인 글자만 담은 진짜 글꼴 파일을 만들어 보여 줍니다. 아래 표에서는 초성별로 모든 음절을 확인할 수 있습니다."
      />
      <div class={styles.grid}>
        <Panel title="글로 보기" class={styles.text}>
          <TextSpecimen />
        </Panel>
        <Panel
          title="획 스타일"
          description="바꾸면 위 글과 아래 표가 함께 바뀝니다."
          class={styles.style}
          actions={
            <ButtonLink href="/studio" size="small" variant="ghost">
              작업실로
            </ButtonLink>
          }
        >
          <StylePanel />
        </Panel>
        <Panel title="11,172자 모두 보기" class={styles.table}>
          <SyllableTable />
        </Panel>
      </div>
    </div>
  )
}
