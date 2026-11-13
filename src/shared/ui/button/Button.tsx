import { A } from '@solidjs/router'
import { type JSX, splitProps } from 'solid-js'
import styles from './Button.module.css'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'orbit'

type Common = {
  variant?: ButtonVariant
  size?: 'medium' | 'small'
  /** 글자 없이 아이콘만 있는 정사각 버튼 (이름은 aria-label이나 숨긴 글자로 줌) */
  iconOnly?: boolean
}

function classes(props: Common, extra?: string): string {
  return [
    styles.button,
    styles[props.variant ?? 'secondary'],
    props.size === 'small' ? styles.small : '',
    props.iconOnly ? styles.icon : '',
    extra ?? '',
  ]
    .filter(Boolean)
    .join(' ')
}

export type ButtonProps = Common & JSX.ButtonHTMLAttributes<HTMLButtonElement>

export function Button(props: ButtonProps) {
  const [local, rest] = splitProps(props, ['variant', 'size', 'iconOnly', 'class', 'type'])
  return <button type={local.type ?? 'button'} class={classes(local, local.class)} {...rest} />
}

export type ButtonLinkProps = Common &
  JSX.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }

/** 버튼 모양의 앱 안 링크 (이동은 링크, 동작은 버튼으로 구분) */
export function ButtonLink(props: ButtonLinkProps) {
  const [local, rest] = splitProps(props, ['variant', 'size', 'iconOnly', 'class', 'href'])
  return <A href={local.href} class={classes(local, local.class)} {...rest} />
}
