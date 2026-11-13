import { MemoryRouter, Route, createMemoryHistory } from '@solidjs/router'
import { render, screen } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SiteHeader } from './SiteHeader.tsx'

function renderHeader(path = '/studio') {
  const history = createMemoryHistory()
  history.set({ value: path })
  return render(() => (
    <MemoryRouter history={history} root={() => <SiteHeader />}>
      <Route path="*" component={() => null} />
    </MemoryRouter>
  ))
}

describe('SiteHeader', () => {
  it('현재 화면의 단계 링크에 aria-current="page"를 붙입니다', () => {
    renderHeader('/studio')
    const quick = screen.getByRole('navigation', { name: '작업 단계' })
    expect(quick.querySelector('[aria-current="page"]')).toHaveTextContent('작업실')
  })

  it('전체 메뉴는 대화상자로 열리고, 닫으면 여는 버튼으로 초점이 돌아옵니다', async () => {
    const user = userEvent.setup()
    renderHeader('/')
    const toggle = screen.getByRole('button', { name: '전체 메뉴 열기' })
    expect(toggle).toHaveAttribute('aria-haspopup', 'dialog')
    await user.click(toggle)
    const dialog = screen.getByRole('dialog', { name: '전체 메뉴' })
    expect(dialog).toHaveAttribute('open')
    expect(screen.getAllByRole('link', { name: /작업실/ }).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: '전체 메뉴 닫기' }))
    expect(dialog).not.toHaveAttribute('open')
    expect(toggle).toHaveFocus()
  })
})
