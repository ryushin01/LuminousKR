import { type JSX, splitProps } from 'solid-js'

/** 24×24 선 아이콘. 꾸밈용이므로 늘 aria-hidden이며, 이름은 감싸는 버튼에 줍니다. */
const PATHS = {
  menu: 'M4 7h16M4 12h16M4 17h10',
  close: 'M6 6l12 12M18 6L6 18',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  line: 'M5 19L19 5M5 19a1.5 1.5 0 1 0 0 .01M19 5a1.5 1.5 0 1 0 0 .01',
  curve: 'M4 18c4-12 12-12 16 0',
  ellipse: 'M12 5c4.4 0 8 3.1 8 7s-3.6 7-8 7-8-3.1-8-7 3.6-7 8-7z',
  pointer: 'M6 3l12 8-5.5 1.5L10 18z',
  grid: 'M4 4h16v16H4zM4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
  play: 'M8 5l11 7-11 7z',
  pause: 'M8 5v14M16 5v14',
  arrowUp: 'M12 19V5M6 11l6-6 6 6',
  arrowDown: 'M12 5v14M6 13l6 6 6-6',
  arrowLeft: 'M19 12H5M11 6l-6 6 6 6',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  check: 'M5 12l5 5 9-10',
  sparkle: 'M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3',
  reset: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5',
  file: 'M7 3h7l5 5v13H7zM14 3v5h5',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  plus: 'M12 5v14M5 12h14',
} as const

export type IconName = keyof typeof PATHS

type IconProps = Omit<JSX.SvgSVGAttributes<SVGSVGElement>, 'children'> & {
  name: IconName
  size?: number
}

export function Icon(props: IconProps) {
  const [local, rest] = splitProps(props, ['name', 'size'])
  return (
    <svg
      width={local.size ?? 20}
      height={local.size ?? 20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d={PATHS[local.name]} />
    </svg>
  )
}
