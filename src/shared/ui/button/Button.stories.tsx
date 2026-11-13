import { MemoryRouter, Route } from '@solidjs/router'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Icon } from '../icon/Icon.tsx'
import { Button, ButtonLink } from './Button.tsx'

const meta = {
  title: 'shared/Button',
  component: Button,
  args: { children: '글꼴 파일 만들기', variant: 'primary' },
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: ['primary', 'secondary', 'ghost', 'danger', 'orbit'],
    },
    size: { control: 'inline-radio', options: ['medium', 'small'] },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = {}
export const Secondary: Story = { args: { variant: 'secondary', children: '프로젝트 저장' } }
export const Ghost: Story = { args: { variant: 'ghost', children: '취소' } }
export const Danger: Story = { args: { variant: 'danger', children: '고른 획 지우기' } }
export const Small: Story = { args: { variant: 'secondary', size: 'small', children: '되돌리기' } }
export const Disabled: Story = { args: { disabled: true, children: '만드는 중…' } }

/** 참고 디자인의 둥근 회보라 버튼 (메뉴 열기) */
export const Orbit: Story = {
  render: () => (
    <Button variant="orbit">
      <Icon name="menu" size={22} />
      <span class="visually-hidden">전체 메뉴 열기</span>
    </Button>
  ),
}

/** 화면 이동은 링크(a)로 */
export const Link: Story = {
  render: () => (
    <MemoryRouter
      root={() => (
        <ButtonLink href="/studio" variant="primary">
          작업실 열기
        </ButtonLink>
      )}
    >
      <Route path="*" component={() => null} />
    </MemoryRouter>
  ),
}
