const updateGame = async (gameCode: string, body?: any) => {
    const res = await fetch(`/api/game/${gameCode}/update`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        body: body
    })

    if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.error || 'Failed to update game')
    }
}


// TEST if all fetches to utils are now working
// TEST if all fetches to utils are now working
// TEST if all fetches to utils are now working
// TEST if all fetches to utils are now working
// TEST if all fetches to utils are now working
// TEST if all fetches to utils are now working
// TEST if all fetches to utils are now working
// TEST if all fetches to utils are now working
// TEST if all fetches to utils are now working
// TEST if all fetches to utils are now working