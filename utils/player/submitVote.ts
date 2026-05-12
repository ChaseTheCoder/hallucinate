export const submitVote = async (gameCode: string, voterId: string, votes: string[]): Promise<void> => {
  const res = await fetch(`/api/game/${gameCode}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voterId, votes })
  })

  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.error || 'Failed to submit vote')
  }
}