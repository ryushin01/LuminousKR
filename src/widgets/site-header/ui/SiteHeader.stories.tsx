import { MemoryRouter, Route, createMemoryHistory } from '@solidjs/router'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { SiteHeader } from './SiteHeader.tsx'

const meta = {
  title: 'widgets/SiteHeader',
  component: SiteHeader,
  parameters: { layout: 'fullscreen' },
  render: () => {
    const history = createMemoryHistory()
    history.set({ value: '/studio' })
    return (
      <MemoryRouter history={history} root={() => <SiteHeader />}>
        <Route path="*" component={() => null} />
      </MemoryRouter>
    )
  },
} satisfies Meta

export default meta
// 스토리 안에서 상태를 만들어 그리므로 속성(args)을 받지 않습니다.
type Story = StoryObj

/** 작업실에 있을 때: 단계 링크의 현재 위치, 오른쪽의 전체 메뉴 버튼 */
export const InStudio: Story = {}
