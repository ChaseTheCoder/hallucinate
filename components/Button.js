import Link from 'next/link'

export default function Button({ href, children, onClick }) {
  if (href) {
    return (
      <Link href={href}>
        <button className="button">{children}</button>
      </Link>
    )
  }

  return (
    <button className="button" onClick={onClick}>
      {children}
    </button>
  )
}
