import { useState } from 'react'
import ButtonLiquid from '../ButtonLiquid'

const POST_MAX_LENGTH = 180

type PostComposerProps = {
  alias?: string
  hasPostedThisCycle: boolean
  isCampaign: boolean
  onConfirmAlias: (alias: string) => Promise<void>
  onSubmitPost: (text: string) => Promise<void>
  isSubmittingAlias: boolean
  isSubmittingPost: boolean
  error: string | null
}

// Post tab content for the 'post' barred influence — see BARRED_INFLUENCE_PROMPTS.post.
// Alias is a one-time, permanent-while-holding-the-influence choice (never the player's
// real name — that's the entire point, see the host-side post feed). Post text resets each
// campaign cycle (hasPostedThisCycle is server-controlled, see pages/api/game/[code]/post.ts).
export default function PostComposer({
  alias,
  hasPostedThisCycle,
  isCampaign,
  onConfirmAlias,
  onSubmitPost,
  isSubmittingAlias,
  isSubmittingPost,
  error,
}: PostComposerProps) {
  const [aliasInput, setAliasInput] = useState('')
  const [postText, setPostText] = useState('')

  const handleConfirmAlias = async () => {
    if (!aliasInput.trim()) return
    await onConfirmAlias(aliasInput.trim())
  }

  const handleSubmitPost = async () => {
    if (!postText.trim()) return
    await onSubmitPost(postText.trim())
    setPostText('')
  }

  if (!alias) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 360, margin: '0 auto', textAlign: 'center' }}>
        <p style={{ color: '#5A5A5A', margin: 0 }}>
          Provide a fake news organization name or alias name
        </p>
        {error && <div style={{ color: '#c62828', fontSize: '0.85em' }}>{error}</div>}
        <input
          value={aliasInput}
          onChange={e => setAliasInput(e.target.value)}
          placeholder="Alias"
          style={{ padding: '10px 12px', fontSize: 16, border: '1px solid #c7c7c7', borderRadius: 8, textAlign: 'center' }}
        />
        <ButtonLiquid
          onClick={handleConfirmAlias}
          disabled={!aliasInput.trim() || isSubmittingAlias}
          style={{ width: '100%', opacity: aliasInput.trim() ? 1 : 0.5, cursor: aliasInput.trim() ? 'pointer' : 'not-allowed' }}
        >
          {isSubmittingAlias ? 'Confirming...' : 'Confirm Name'}
        </ButtonLiquid>
      </div>
    )
  }

  const remaining = POST_MAX_LENGTH - postText.length
  const atLimit = postText.length >= POST_MAX_LENGTH

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 360, margin: '0 auto', textAlign: 'center' }}>
      <p style={{ color: '#5A5A5A', margin: 0, fontWeight: 700 }}>{alias}</p>

      {error && <div style={{ color: '#c62828', fontSize: '0.85em' }}>{error}</div>}

      {!isCampaign ? (
        <p style={{ color: '#999', fontSize: '0.9em', margin: 0 }}>
          Posting is only available during the Campaign phase.
        </p>
      ) : hasPostedThisCycle ? (
        <p style={{ color: '#999', fontSize: '0.9em', margin: 0 }}>
          You've already posted this campaign cycle. Check back next cycle.
        </p>
      ) : (
        <>
          <div style={{ textAlign: 'right', fontSize: '0.8em', color: atLimit ? '#c62828' : '#999' }}>
            {postText.length}/{POST_MAX_LENGTH}
          </div>
          <textarea
            value={postText}
            onChange={e => setPostText(e.target.value.slice(0, POST_MAX_LENGTH))}
            placeholder="Post text"
            rows={4}
            style={{
              padding: '10px 12px',
              fontSize: 16,
              border: '1px solid #c7c7c7',
              borderRadius: 8,
              resize: 'none',
              color: 'var(--color-text-primary)',
            }}
          />
          <ButtonLiquid
            onClick={handleSubmitPost}
            disabled={!postText.trim() || isSubmittingPost}
            style={{ width: '100%', opacity: postText.trim() ? 1 : 0.5, cursor: postText.trim() ? 'pointer' : 'not-allowed' }}
          >
            {isSubmittingPost ? 'Posting...' : 'Post'}
          </ButtonLiquid>
          {remaining <= 0 && <p style={{ color: '#c62828', fontSize: '0.75em', margin: 0 }}>Character limit reached.</p>}
        </>
      )}
    </div>
  )
}
