import Link from 'next/link'
import type { CSSProperties, FormEvent, ReactNode } from 'react'

type ButtonProps = {
  href?: string
  children: ReactNode
  onClick?: (e: FormEvent) => void
  disabled?: boolean
  style?: CSSProperties
}

export default function Button({ href, children, onClick, disabled, style }: ButtonProps) {
  if (href) {
    return (
      <Link href={href}>
        <button className="button" disabled={disabled} aria-disabled={disabled} style={style}>
          {children}
        </button>
      </Link>
    )
  }

  return (
    <button className="button" onClick={disabled ? undefined : onClick} disabled={disabled} aria-disabled={disabled} style={style}>
      {children}
    </button>
  )
}
