import { useState, useMemo } from 'react'
import Button from '../../../components/Button';
import { Player } from '../../../types/types';

interface VotePanelProps {
  currentPlayer: Player
  qualifiedPlayers: Player[]
  onVoteSubmit: (votes: string[]) => Promise<void>
  isSubmitting: boolean
  code: string
}

type VoteSelection = {
  first?: string  // 5 points
  second?: string // 3 points
  third?: string  // 1 point
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

  // Filter out current player from voting options
  const availablePlayers = useMemo(
    () => qualifiedPlayers.filter(p => p.id !== currentPlayer.id),
    [qualifiedPlayers, currentPlayer.id]
  )

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

    // If all positions filled, replace the lowest value (third)
    if (Object.keys(votes).length === 3) {
      setVotes(prev => ({
        ...prev,
        third: playerId
      }))
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
    if (Object.keys(votes).length !== 3) {
      setError('Must select three players')
      return
    }

    const votesArray = [votes.first!, votes.second!, votes.third!]

    try {
      setError(null)
      await onVoteSubmit(votesArray)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit vote'
      setError(message)
    }
  }

  const isVoteComplete = Object.keys(votes).length === 3
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
          Select your top 3 candidates (5, 3, 1 points)
        </p>
        <p style={{ color: '#5A5A5A', margin: '8px 0 0 0', fontWeight: 'bold' }}>
          {selectedCount}/3 Selected
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
            <button
              key={player.id}
              onClick={() => handlePlayerSelect(player.id)}
              style={{
                padding: '16px 20px',
                backgroundColor: votePosition ? '#2E7D32' : '#E0E0E0',
                color: votePosition ? '#FFFFFF' : '#5A5A5A',
                border: 'none',
                borderRadius: 4,
                fontSize: '1em',
                fontWeight: votePosition ? 'bold' : '500',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'all 0.2s ease',
                textAlign: 'left'
              }}
            >
              <span>{player.name}</span>
              {voteValue && (
                <span
                  style={{
                    backgroundColor: votePosition === 'first' ? '#1B5E20' : votePosition === 'second' ? '#2E7D32' : '#388E3C',
                    padding: '4px 12px',
                    borderRadius: 12,
                    fontSize: '0.9em',
                    fontWeight: 'bold',
                    minWidth: '40px',
                    textAlign: 'center'
                  }}
                >
                  {voteValue}
                </span>
              )}
            </button>
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
        <Button
          onClick={handleSubmitVote}
          disabled={!isVoteComplete || isSubmitting}
          style={{
            width: '100%',
            opacity: isVoteComplete ? 1 : 0.5,
            cursor: isVoteComplete ? 'pointer' : 'not-allowed'
          }}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Vote'}
        </Button>
      </div>
    </div>
  )
}