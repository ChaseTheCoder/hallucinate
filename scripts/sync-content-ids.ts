// Keeps each content.ts entry's `id` annotation in sync with its `audio` text.
//
// `id` is purely a human-readable snapshot of the content-addressed hash generate-audio.ts
// would compute for that exact text right now (see that script's header comment) — it is
// NOT read by the app at runtime (playback resolves through content/audioManifest.json,
// keyed by text, not by this field). So this script never affects what audio plays; it just
// keeps the annotation honest, which is what tells a human "this text changed since audio
// was last generated for it" or "this text has never had an id at all".
//
// For every `{ id?, audio, display, ... }`-shaped object found in content.ts's exports:
//   - if `audio` is real narrated text (not a pure {TOKEN} line, not a bare URL, not empty)
//     and its `id` is missing/empty/stale, set it to hash(audio).
//   - lines that shouldn't have generated audio at all (tokens/URLs) are left untouched,
//     whether or not they currently have an id.
//
// Usage: npm run sync-content-ids [-- --write]
//   (no flag)  dry run — prints what would change
//   --write    actually rewrites content/content.ts

import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import {
  gameContent,
  introductionAnnouncementExtension,
  immunityCodeAnnouncementExtension,
  requalifyCodeAnnouncementExtension,
  barredSwapAnnouncementExtension,
  finalRoundCampaignIntro,
  finalRoundCampaignCandidateA,
  finalRoundCampaignCandidateB,
  barredCandidateTwistVoteExtension,
} from '../content/content'
import { isDynamicTokenLine } from '../content/hostNarration'

const CONTENT_PATH = path.join(__dirname, '..', 'content', 'content.ts')
const HASH_LENGTH = 16

// Same as generate-audio.ts's URL_LINE_PATTERN — kept identical on purpose so this script's
// notion of "needs an id" never drifts from that script's notion of "needs generated audio".
const URL_LINE_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i

function hashText(text: string): string {
  return createHash('sha256').update(text.trim()).digest('hex').slice(0, HASH_LENGTH)
}

function needsAudio(text: string): boolean {
  const trimmed = text.trim()
  return Boolean(trimmed) && !isDynamicTokenLine(trimmed) && !URL_LINE_PATTERN.test(trimmed)
}

// Collect every unique `audio` text that should have an id, mapped to its correct hash.
function collectExpectedIds(): Map<string, string> {
  const expected = new Map<string, string>()

  function walk(node: unknown): void {
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>
      if (typeof obj.audio === 'string' && needsAudio(obj.audio)) {
        expected.set(obj.audio.trim(), hashText(obj.audio))
      }
      Object.values(obj).forEach(walk)
    }
  }

  walk(gameContent)
  walk(introductionAnnouncementExtension)
  walk(immunityCodeAnnouncementExtension)
  walk(requalifyCodeAnnouncementExtension)
  walk(barredSwapAnnouncementExtension)
  walk(finalRoundCampaignIntro)
  walk(finalRoundCampaignCandidateA)
  walk(finalRoundCampaignCandidateB)
  walk(barredCandidateTwistVoteExtension)

  return expected
}

// Unescape a JS double-quoted string literal body enough to match against the live text
// values pulled from the imported module (only the escapes this file actually uses).
function unescapeLiteral(raw: string): string {
  return raw.replace(/\\(.)/g, (_, ch) => (ch === 'n' ? '\n' : ch))
}

function escapeLiteral(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
}

async function main() {
  const write = process.argv.includes('--write')
  const expected = collectExpectedIds()
  const source = await readFile(CONTENT_PATH, 'utf-8')

  // Matches an optional `id: "...",\n<indent>` immediately followed by `audio: "...",` at
  // the same indentation — i.e. exactly the shape every content.ts entry already uses.
  const pattern = /( *)(id: "([0-9a-f]*)",\n\1)?audio: "((?:\\.|[^"\\])*)",/g

  let changed = 0
  let added = 0
  const seen = new Set<string>()

  const next = source.replace(pattern, (full, indent, idBlock, oldId, rawAudio) => {
    const text = unescapeLiteral(rawAudio)
    const correctId = expected.get(text)
    if (!correctId) return full // token/URL/empty line — leave exactly as-is

    seen.add(text)
    if (oldId === correctId) return full // already correct, nothing to do

    if (idBlock === undefined) added++
    else changed++

    const preview = text.length > 60 ? `${text.slice(0, 60)}...` : text
    console.log(
      idBlock === undefined
        ? `ADD id  ${correctId}  "${preview}"`
        : `SYNC id ${oldId || '(empty)'} -> ${correctId}  "${preview}"`
    )

    return `${indent}id: "${correctId}",\n${indent}audio: "${escapeLiteral(text)}",`
  })

  // Sanity check: every text we expected to find an id for should have actually matched the
  // regex somewhere in the file. If not, the regex/source shape has drifted and silently
  // skipping would be worse than failing loudly.
  const missed = [...expected.keys()].filter(text => !seen.has(text))
  if (missed.length > 0) {
    console.error(`\nFAILED: ${missed.length} expected line(s) never matched the source pattern — check for a shape this script doesn't handle:`)
    missed.forEach(text => console.error(`  - "${text.length > 60 ? text.slice(0, 60) + '...' : text}"`))
    process.exit(1)
  }

  console.log(`\n${added} id(s) added, ${changed} id(s) synced, ${expected.size - added - changed} already correct.`)

  if (!write) {
    console.log(added + changed > 0 ? '\nDry run — re-run with --write to apply.' : '\nNothing to do.')
    return
  }

  if (added + changed === 0) {
    console.log('Nothing to write.')
    return
  }

  await writeFile(CONTENT_PATH, next, 'utf-8')
  console.log(`\nWrote ${CONTENT_PATH}`)
}

main().catch(err => {
  console.error('\nFAILED:', err instanceof Error ? err.message : err)
  process.exit(1)
})
