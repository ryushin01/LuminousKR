import { MemoryRouter, Route, createMemoryHistory } from '@solidjs/router'
import { cleanup, render, screen, within } from '@solidjs/testing-library'
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
  it('주 메뉴는 01 홈부터 05 내보내기까지 번호 차례로 보여 줍니다', () => {
    renderHeader('/studio')
    const nav = screen.getByRole('navigation', { name: '주 메뉴' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual([
      '01홈',
      '02작업실',
      '03가져오기',
      '04미리보기',
      '05내보내기',
    ])
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/',
      '/studio',
      '/import',
      '/preview',
      '/export',
    ])
  })

  it('현재 화면의 링크 하나에만 aria-current="page"를 붙입니다(홈은 홈에서만)', () => {
    renderHeader('/studio')
    let current = screen.getByRole('navigation', { name: '주 메뉴' })
    expect(current.querySelectorAll('[aria-current="page"]')).toHaveLength(1)
    expect(current.querySelector('[aria-current="page"]')).toHaveTextContent('작업실')
    cleanup()

    renderHeader('/')
    current = screen.getByRole('navigation', { name: '주 메뉴' })
    expect(current.querySelectorAll('[aria-current="page"]')).toHaveLength(1)
    expect(current.querySelector('[aria-current="page"]')).toHaveTextContent('홈')
  })

  it('메뉴에서 화면을 옮겨 닫힐 때는 여는 버튼으로 초점을 되돌리지 않습니다(새 화면 제목이 받음)', async () => {
    const user = userEvent.setup()
    renderHeader('/')
    const toggle = screen.getByRole('button', { name: '전체 메뉴 열기' })
    await user.click(toggle)
    const dialog = screen.getByRole('dialog', { name: '전체 메뉴' })
    await user.click(within(dialog).getByRole('link', { name: /안내/ }))
    expect(dialog).not.toHaveAttribute('open')
    expect(toggle).not.toHaveFocus()
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
