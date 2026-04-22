import Link from 'next/link'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import styles from './ButtonLiquid.module.css'

type ButtonProps = {
  href?: string
  children: ReactNode
  onClick?: (e: FormEvent) => void
  disabled?: boolean
  style?: CSSProperties
}

export default function ButtonLiquid({ href, children, onClick, disabled, style }: ButtonProps) {
  const content = (
    <>
      <span className={styles.rim} aria-hidden="true" />
      <span className={styles.centerTone} aria-hidden="true" />
      <span className={styles.highlight} aria-hidden="true" />
      <span className={styles.shadow} aria-hidden="true" />
      <span className={styles.label}>{children}</span>
    </>
  )

  if (href) {
    return (
      <Link href={href}>
        <button className={styles.buttonLiquid} disabled={disabled} aria-disabled={disabled} style={style}>
          {content}
        </button>
      </Link>
    )
  }

  return (
    <button className={styles.buttonLiquid} onClick={disabled ? undefined : onClick} disabled={disabled} aria-disabled={disabled} style={style}>
      {content}
    </button>
  )
}
