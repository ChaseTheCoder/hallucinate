import type { ReactNode } from 'react'

type VoteButtonProps = {
  label: string
  selected?: boolean
  onClick: () => void
  rightContent?: ReactNode
}

export default function VoteButton({ label, selected = false, onClick, rightContent }: VoteButtonProps) {
  return (
    <button
      type="button"
      className="button"
      onClick={onClick}
      style={{
        width: '100%',
        padding: '16px 20px',
        backgroundColor: selected ? 'var(--color-primary)' : 'transparent',
        color: selected ? 'var(--color-white)' : 'var(--color-text-primary)',
        border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--color-border-accent)'}`,
        borderRadius: 40,
        fontSize: '1em',
        fontWeight: selected ? 700 : 500,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        textAlign: 'left'
      }}
    >
      <span>{label}</span>
      {rightContent ?? null}
    </button>
  )
}