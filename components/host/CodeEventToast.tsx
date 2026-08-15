import Text from '../Text'
import GlassBubble from '../GlassBubble'

export type CodeEventToastData = {
  id: number
  lines: [string, string, string]
}

type CodeEventToastProps = {
  toasts: CodeEventToastData[]
}

// Non-blocking banner for the code effects that reveal live during Campaign (bar_leader /
// grant_immunity / immunity — see pages/api/game/[code]/redeem-code.ts's 'campaign-code-event'
// socket emit). Deliberately never pauses the campaign timer or narration. Renders inline in
// the host's Left column, stacked top-to-bottom in arrival order directly beneath the
// countdown content (see pages/host/[code].tsx) — not a floating/fixed overlay. Each toast
// stays up for the rest of the current campaign cycle rather than auto-dismissing on a timer;
// the whole list is cleared by the host page the moment the game leaves/re-enters 'campaign'.
export default function CodeEventToast({ toasts }: CodeEventToastProps) {
  if (toasts.length === 0) return null

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        width: '100%',
      }}
    >
      {toasts.map(toast => (
        <GlassBubble key={toast.id} style={{ padding: '16px 24px', width: '100%' }} contentStyle={{ width: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {toast.lines.map((line, i) => (
              <Text key={i} color="text-primary" size={1.1} bold={i === toast.lines.length - 1}>
                {line}
              </Text>
            ))}
          </div>
        </GlassBubble>
      ))}
    </div>
  )
}
