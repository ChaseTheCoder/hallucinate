import { useState, useMemo } from 'react'
import ButtonLiquid from '../ButtonLiquid'
import VoteButton from '../VoteButton'
import { Player } from '../../types/types'

interface VotePanelProps {
  currentPlayer: Player
  qualifiedPlayers: Player[]
  onVoteSubmit: (votes: string[]) => Promise<void>
  isSubmitting: boolean
  code: string
}

type VoteSelection = {
  first?: string // 5 points
  second?: string // 3 points
  third?: string // 1 point
}

const VOTE_VALUES = { first: 5, second: 3, third: 1 }

export default function VotePanel({
  currentPlayer,
  qualifiedPlayers,
  onVoteSubmit,
  isSubmitting,
  code
}: VotePanelProps) {
  const [votes, setVotes] = useState<VoteSelection>({})
  const [error, setError] = useState<string | null>(null)

  if (!currentPlayer || !qualifiedPlayers) {
    return <div>Loading...</div>
  }

  // Filter out current player from voting options
  const availablePlayers = useMemo(
    () => qualifiedPlayers.filter(p => p.id !== currentPlayer.id),
    [qualifiedPlayers, currentPlayer.id]
  )

  const requiredVotes = Math.min(3, availablePlayers.length)

  // Determine which position a player occupies in votes
  const getVotePosition = (playerId: string): keyof VoteSelection | null => {
    if (votes.first === playerId) return 'first'
    if (votes.second === playerId) return 'second'
    if (votes.third === playerId) return 'third'
    return null
  }

  // Get vote value for display
  const getVoteValue = (position: keyof VoteSelection | null): number | null => {
    if (!position) return null
    return VOTE_VALUES[position]
  }

  // Handle player selection
  const handlePlayerSelect = (playerId: string) => {
    const currentPosition = getVotePosition(playerId)

    // If already selected, unselect it
    if (currentPosition) {
      setVotes(prev => {
        const newVotes = { ...prev }
        delete newVotes[currentPosition]
        return newVotes
      })
      return
    }

    // If all positions filled, replace the lowest value (third) if requiredVotes === 3, else don't allow
    if (Object.keys(votes).length === requiredVotes) {
      if (requiredVotes === 3) {
        setVotes(prev => ({
          ...prev,
          third: playerId
        }))
      }
      return
    }

    // Fill in order: first, second, third
    if (!votes.first) {
      setVotes(prev => ({ ...prev, first: playerId }))
    } else if (!votes.second) {
      setVotes(prev => ({ ...prev, second: playerId }))
    } else if (!votes.third) {
      setVotes(prev => ({ ...prev, third: playerId }))
    }
  }

  const handleSubmitVote = async () => {
    const votesArray = [votes.first, votes.second, votes.third].filter(Boolean) as string[]

    try {
      setError(null)
      await onVoteSubmit(votesArray)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit vote'
      setError(message)
    }
  }

  const isVoteComplete = Object.keys(votes).length === requiredVotes
  const selectedCount = Object.keys(votes).length

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        width: '100%',
        height: '100%'
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ color: '#5A5A5A', margin: '0 0 8px 0' }}>Cast Your Votes</h2>
        <p style={{ color: '#999', margin: 0, fontSize: '0.9em' }}>
          Select your top {requiredVotes} candidate{requiredVotes > 1 ? 's' : ''} ({requiredVotes === 3 ? '5, 3, 1' : requiredVotes === 2 ? '5, 3' : '5'} points)
        </p>
        <p style={{ color: '#5A5A5A', margin: '8px 0 0 0', fontWeight: 'bold' }}>
          {selectedCount}/{requiredVotes} Selected
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div
          style={{
            padding: 12,
            backgroundColor: '#ffebee',
            color: '#c62828',
            borderRadius: 4,
            fontSize: '0.9em',
            textAlign: 'center'
          }}
        >
          {error}
        </div>
      )}

      {/* Player buttons */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          flex: 1,
          overflowY: 'auto'
        }}
      >
        {availablePlayers.map(player => {
          const votePosition = getVotePosition(player.id)
          const voteValue = getVoteValue(votePosition)

          return (
            <VoteButton
              key={player.id}
              label={player.name}
              selected={!!votePosition}
              onClick={() => handlePlayerSelect(player.id)}
              rightContent={voteValue ? (
                <span
                  style={{
                    color: 'var(--color-text-primary)',
                    fontSize: '0.95em',
                    fontWeight: 700,
                    minWidth: '32px',
                    textAlign: 'right'
                  }}
                >
                  {voteValue}
                </span>
              ) : null}
            />
          )
        })}
      </div>

      {/* Submit button - fixed at bottom */}
      <div
        style={{
          width: '100vw',
          marginLeft: 'calc(-50vw + 50%)',
          marginRight: 'calc(-50vw + 50%)',
          marginBottom: -24,
          padding: '16px 24px',
          borderTop: '1px solid #E0E0E0',
          backgroundColor: '#FFFFFF'
        }}
      >
        <ButtonLiquid
          onClick={handleSubmitVote}
          disabled={!isVoteComplete || isSubmitting}
          style={{
            width: '100%',
            opacity: isVoteComplete ? 1 : 0.5,
            cursor: isVoteComplete ? 'pointer' : 'not-allowed'
          }}
        >
          {isSubmitting ? 'Submitting Votes...' : `Submit Votes (${selectedCount}/${requiredVotes})`}
        </ButtonLiquid>
      </div>
    </div>
  )
}