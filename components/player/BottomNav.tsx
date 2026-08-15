import type { ReactElement } from 'react'
import Text from '../Text'

export type PlayerTabId = 'home' | 'post' | 'code' | 'leave'

type BottomNavProps = {
  activeTab: PlayerTabId
  onSelect: (tab: PlayerTabId) => void
  postEnabled: boolean
  codeEnabled: boolean
}

const TABS: Array<{ id: PlayerTabId; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'post', label: 'Post' },
  { id: 'code', label: 'Code' },
  { id: 'leave', label: 'Leave' },
]

type IconProps = { color: string }

function HomeIcon({ color }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9h12v-9" />
    </svg>
  )
}

function PostIcon({ color }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h16v10H9l-5 4V5Z" />
      <path d="M8 9h8M8 12h5" />
    </svg>
  )
}

function CodeIcon({ color }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 6-5 6 5 6M15 6l5 6-5 6" />
    </svg>
  )
}

function LeaveIcon({ color }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 4H5v16h5" />
      <path d="M14 8l4 4-4 4M18 12H9" />
    </svg>
  )
}

const ICONS: Record<PlayerTabId, (props: IconProps) => ReactElement> = {
  home: HomeIcon,
  post: PostIcon,
  code: CodeIcon,
  leave: LeaveIcon,
}

// Bottom mobile-app-style tab bar for the player screen — replaces the old top-right
// "Leave Game" button (see pages/player/[code].tsx). 'post' is disabled/grayed unless the
// player currently holds the 'post' barred influence; 'code' is disabled unless the game
// is currently in the 'campaign' status (the only phase codes are redeemable/displayed).
export default function BottomNav({ activeTab, onSelect, postEnabled, codeEnabled }: BottomNavProps) {
  const isEnabled = (id: PlayerTabId) => {
    if (id === 'post') return postEnabled
    if (id === 'code') return codeEnabled
    return true
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: '10px 8px calc(10px + env(safe-area-inset-bottom, 0px))',
        backgroundColor: 'var(--color-background)',
        borderTop: '1px solid rgba(0,0,0,0.08)',
        zIndex: 900,
      }}
    >
      {TABS.map(tab => {
        const enabled = isEnabled(tab.id)
        const active = activeTab === tab.id
        // Any enabled tab (active or not) reads in primary/black text; the active tab is
        // distinguished by an underline instead of a separate color. Disabled tabs keep the
        // existing dimmed (opacity 0.35) treatment, untouched by this scheme.
        const color = enabled ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'
        const Icon = ICONS[tab.id]
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => enabled && onSelect(tab.id)}
            disabled={!enabled}
            aria-current={active ? 'page' : undefined}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              background: 'none',
              border: 'none',
              padding: '4px 12px',
              cursor: enabled ? 'pointer' : 'not-allowed',
              opacity: enabled ? 1 : 0.35,
            }}
          >
            <Icon color={color} />
            <Text size={0.7} bold={active} color={enabled ? 'text-primary' : 'text-secondary'}>
              {tab.label}
            </Text>
            <span
              aria-hidden="true"
              style={{
                width: 18,
                height: 2,
                marginTop: 2,
                borderRadius: 1,
                backgroundColor: active ? 'var(--color-text-primary)' : 'transparent',
              }}
            />
          </button>
        )
      })}
    </div>
  )
}
