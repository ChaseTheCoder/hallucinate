import Popover from '../Popover'
import ButtonLiquid from '../ButtonLiquid'
import Text from '../Text'
import { BARRED_INFLUENCE_PROMPTS, BARRED_INFLUENCE_TITLES } from '../../content/content'
import type { BarredInfluenceType } from '../../types/types'

type InfluencePopoverProps = {
  isOpen: boolean
  influenceType: BarredInfluenceType | null
  isSubmitting: boolean
  onAcknowledge: () => void
}

// Shown to a player who holds an unacknowledged barred influence (see
// PlayerProjection.influence in server/gameStore.ts), gated by the caller to start no
// earlier than the Campaign status (so it never shows before the host's announcement
// narration reveals the bar) — once shown it stays open durably, across reconnects, until
// they click "I Understand". Deliberately non-dismissable any other way (no backdrop
// click / Escape close) so it can't be missed.
export default function InfluencePopover({ isOpen, influenceType, isSubmitting, onAcknowledge }: InfluencePopoverProps) {
  if (!influenceType) return null

  return (
    <Popover isOpen={isOpen} onClose={() => {}}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28, alignItems: 'center', textAlign: 'center' }}>
        <Text size={1.2} color="text-primary" bold allCaps style={{ lineHeight: 1.3 }}>
          {BARRED_INFLUENCE_TITLES[influenceType]}
        </Text>
        <Text size={1.1} color="text-primary" style={{ lineHeight: 1.5 }}>
          {BARRED_INFLUENCE_PROMPTS[influenceType]}
        </Text>
        <Text size={1} color="text-secondary" bold style={{ lineHeight: 1.4 }}>
          If you become qualified again you lose this influence.
        </Text>
        <ButtonLiquid onClick={onAcknowledge} disabled={isSubmitting} style={{ width: '100%' }}>
          {isSubmitting ? 'Please wait...' : 'I Understand'}
        </ButtonLiquid>
      </div>
    </Popover>
  )
}
