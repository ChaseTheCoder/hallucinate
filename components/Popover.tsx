import { ReactNode, useEffect } from 'react'
import Text from './Text'
import ButtonLiquid from './ButtonLiquid'

type PopoverProps = {
  isOpen: boolean
  onClose: () => void
  children?: ReactNode
  title?: string
  confirmText?: string
  cancelText?: string
  onConfirm?: () => void | Promise<void>
}

export default function Popover({ 
  isOpen, 
  onClose, 
  children,
  title,
  confirmText,
  cancelText = 'Go Back to Game',
  onConfirm
}: PopoverProps) {
  useEffect(() => {
    if (isOpen) {
      // Prevent scrolling when popover is open
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Use built-in confirmation UI if title and confirmText are provided
  const useBuiltInUI = title && confirmText && onConfirm

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '24px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--color-background)',
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {useBuiltInUI ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
            <Text size={1.5} bold color="text-primary" style={{ textAlign: 'center' }}>
              {title}
            </Text>
            <ButtonLiquid onClick={onConfirm}>
              {confirmText}
            </ButtonLiquid>
            <a
              onClick={onClose}
              style={{
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                textDecoration: 'none',
                fontSize: '1rem',
                transition: 'color 200ms ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-text-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
            >
              {cancelText}
            </a>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}
