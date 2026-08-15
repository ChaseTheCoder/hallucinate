const setPostAlias = async (gameCode: string, playerId: string, alias: string) => {
  const res = await fetch(`/api/game/${gameCode}/post`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId, action: 'set-alias', alias })
  })

  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.error || 'Failed to confirm name')
  }

  return res.json()
}

const submitPost = async (gameCode: string, playerId: string, text: string) => {
  const res = await fetch(`/api/game/${gameCode}/post`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId, action: 'submit', text })
  })

  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.error || 'Failed to submit post')
  }

  return res.json()
}

export { setPostAlias, submitPost }
