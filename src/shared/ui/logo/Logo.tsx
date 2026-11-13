/**
 * 로고: 글자 틀(둥근 사각) 위에 그은 획의 뼈대(ㄴ)와, 일식처럼 새어 나오는 빛 한 점
 * 꾸밈 그림이므로 이름은 옆의 글자(LuminousKR)로 전합니다.
 */
export function LogoMark(props: { size?: number; class?: string }) {
  return (
    <svg
      class={props.class}
      width={props.size ?? 32}
      height={props.size ?? 32}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="2.5"
        y="2.5"
        width="27"
        height="27"
        rx="8"
        stroke="currentColor"
        stroke-opacity="0.35"
        stroke-width="1.6"
      />
      <path
        d="M10 9.5V21.5H22.5"
        stroke="currentColor"
        stroke-width="3.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle cx="22.5" cy="9.5" r="3" fill="#ff6a1a" />
      <circle cx="22.5" cy="9.5" r="5.5" fill="#ff6a1a" fill-opacity="0.18" />
    </svg>
  )
}
