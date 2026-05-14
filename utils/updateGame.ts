const updateGame = async (gameCode: string, body?: { cycleTime?: number }): Promise<void> => {
    const bodyStr = body && Object.keys(body).length > 0 ? JSON.stringify(body) : undefined

    const res = await fetch(`/api/game/${gameCode}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: bodyStr,
    })

    if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to update game')
    }
}

export default updateGame