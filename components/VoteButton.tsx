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
        padding: '6px 24px',
        display: 'flex',
        justifyContent: 'flex-start'
      }}
    >
      <span style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        width: '100%',
        gap: '8px'
      }}>
        <span style={{ fontWeight: selected ? 700 : 500, flex: '1 1 auto', textAlign: 'left' }}>{label}</span>
        {rightContent && (
          <span style={{ fontWeight: selected ? 700 : 500, flex: '0 0 auto', textAlign: 'right' }}>{rightContent}</span>
        )}
      </span>
    </ButtonLiquid>
  )
}