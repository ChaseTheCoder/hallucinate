import Text from '../Text'
import GlassBubble from '../GlassBubble'

export type PostFeedEntry = {
  alias: string
  text: string
}

type PostFeedProps = {
  posts: PostFeedEntry[]
}

// Running feed of this cycle's 'post' barred-influence submissions, shown on the host
// screen during 'campaign' only (see the gating in pages/host/[code].tsx). Attributed by
// each player's chosen alias only — never their real name, that's the entire point of the
// mechanic (see BARRED_INFLUENCE_PROMPTS.post). Clears automatically each new campaign
// cycle since currentPost is reset server-side at announcement -> campaign (update.ts).
export default function PostFeed({ posts }: PostFeedProps) {
  if (posts.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', marginTop: 16 }}>
      <Text color="text-secondary" size={1} allCaps bold>
        Wire Reports
      </Text>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
        {posts.map((post, i) => (
          <GlassBubble key={i} style={{ width: '100%', padding: '10px 20px' }} contentStyle={{ width: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Text color="accent-line" size={0.8} bold allCaps>{post.alias}</Text>
              <Text color="text-primary" size={1}>{post.text}</Text>
            </div>
          </GlassBubble>
        ))}
      </div>
    </div>
  )
}
