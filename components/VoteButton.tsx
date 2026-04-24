import type { ReactNode } from 'react'
import ButtonLiquid from './ButtonLiquid'

type VoteButtonProps = {
  label: string
  selected?: boolean
  onClick: () => void
  rightContent?: ReactNode
}

export default function VoteButton({ label, selected = false, onClick, rightContent }: VoteButtonProps) {
  return (
    <ButtonLiquid
      onClick={onClick}
      style={{
        width: '100%',
        padding: '16px 20px',
        opacity: selected ? 1 : 0.9,
        transition: 'opacity 0.2s ease'
      }}
    >
      <span style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', fontWeight: selected ? 700 : 500 }}>
        <span style={{ textAlign: 'left' }}>{label}</span>
        {rightContent ?? null}
      </span>
    </ButtonLiquid>
  )
}