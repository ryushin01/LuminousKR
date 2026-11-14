import logoUrl from './logo.svg'

/**
 * 로고: 어둠 속에서 고리처럼 새어 나오는 일식의 빛(파비콘과 같은 그림)
 * 꾸밈 그림이므로 이름은 옆의 글자(LuminousKR)로 전합니다.
 */
export function LogoMark(props: { size?: number; class?: string }) {
  return (
    <img
      class={props.class}
      src={logoUrl}
      width={props.size ?? 32}
      height={props.size ?? 32}
      alt=""
      style={{ 'border-radius': '22%' }}
    />
  )
}
