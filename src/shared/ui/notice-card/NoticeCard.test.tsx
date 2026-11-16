import { render, screen } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { NoticeCard, NoticeMessage } from './NoticeCard.tsx'

describe('NoticeCard', () => {
  it('알림이 없어도 상태·경고 영역을 DOM과 접근성 트리에 남깁니다', () => {
    render(() => (
      <NoticeCard active={false}>
        <NoticeMessage role="status">{''}</NoticeMessage>
        <NoticeMessage role="alert" tone="danger">
          {''}
        </NoticeMessage>
      </NoticeCard>
    ))
    // display: none이 아니라 화면에서만 숨기므로 역할로 찾을 수 있습니다.
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(screen.getByRole('alert')).toBeEmptyDOMElement()
  })
})
