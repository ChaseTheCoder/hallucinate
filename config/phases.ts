import type { PhaseTypes, StatusTypes } from '../types/types'

/**
 * Maps each internal game step (StatusTypes) to its player-facing phase (PhaseTypes).
 * null = pre-game, not displayed as a cycle phase.
 *
 * Rule of Three:
 *   Campaign  → campaign
 *   Election  → vote, results
 *   Executive → decision, announcement
 *   Final     → final
 */
export const STEP_TO_PHASE: Record<StatusTypes, PhaseTypes | null> = {
  join: null,
  rules: null,
  campaign: 'campaign',
  vote: 'election',
  results: 'election',
  decision: 'executive',
  announcement: 'executive',
  final: 'final',
}

/** Display labels shown to players and host */
export const PHASE_DISPLAY_NAMES: Record<PhaseTypes, string> = {
  campaign: 'Campaign',
  election: 'Election',
  executive: 'Executive',
  final: 'Final',
}

/** All phases in cycle order (including final) */
export const FINAL_CYCLE_PHASES: PhaseTypes[] = ['campaign', 'election', 'final']

/** The three repeating cycle phases (before the final) */
export const REGULAR_CYCLE_PHASES: PhaseTypes[] = ['campaign', 'election', 'executive']

/**
 * Derive the player-facing phase from an internal game step.
 * Returns null for pre-game statuses (join, rules).
 */
export function getPhaseForStep(step: StatusTypes): PhaseTypes | null {
  return STEP_TO_PHASE[step] ?? null
}

/**
 * Returns the ordered list of phases to display in the nav for a given game state.
 * When only 2 qualified players remain (final cycle), the executive phase is skipped.
 */
export function getNavPhases(qualifiedPlayerCount: number, currentPhase: PhaseTypes | null): PhaseTypes[] {
  if (qualifiedPlayerCount === 2 && currentPhase !== 'executive') {
    return FINAL_CYCLE_PHASES;
  }
  return REGULAR_CYCLE_PHASES;
}
