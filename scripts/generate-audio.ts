// Generates Lucin narration audio via OpenAI TTS and uploads it to Cloudflare R2 under
// v2/{hash}.mp3 — content-addressed by a hash of the spoken text, not by status/position.
// That means editing, reordering, or removing lines elsewhere in content.ts never
// invalidates existing audio, and identical lines reused across statuses are only
// generated/stored once. Safe to re-run: existing objects are skipped (HeadObject check),
// so this only ever generates what's new or changed.
//
// Because the key is a hash of TEXT ONLY, changing voice/speed/model for existing text
// produces the same key — a normal run will just skip it as "already exists". Pass
// --force to bypass the exists-check and regenerate+overwrite every line under the
// current voice/speed/model settings (e.g. after changing OPENAI_TTS_VOICE).
//
// Usage:
//   npm run generate-audio                    # every status, skip what already exists
//   npm run generate-audio -- join             # just gameContent.join, for testing
//   npm run generate-audio -- --force          # regenerate + overwrite everything
//   npm run generate-audio -- join --force     # regenerate + overwrite just join
//
// Reuses flattenHostMessages()/getHostMessageAudioText() from content/hostNarration.ts —
// the same functions the app itself uses to resolve narration text — so this script can
// never drift out of sync with what the app actually needs audio for.

import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })

import { createHash } from 'node:crypto'
import { writeFile, readFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import {
  gameContent,
  immunityCodeAnnouncementExtension,
  requalifyCodeAnnouncementExtension,
  barredSwapAnnouncementExtension,
  introductionAnnouncementExtension,
} from '../content/content'
import { flattenHostMessages, getHostMessageAudioText, isDynamicTokenLine } from '../content/hostNarration'
import type { StatusTypes } from '../types/types'

// Appended to announcement.hostMessage at runtime based on the leader's executive
// decision (see getEffectiveHostMessages/getExtendedAnnouncementHostMessages) — not part
// of gameContent[status].hostMessage, so they need to be scanned separately here.
const EXECUTIVE_DECISION_EXTENSIONS: unknown[] = [
  ...immunityCodeAnnouncementExtension,
  ...requalifyCodeAnnouncementExtension,
  ...barredSwapAnnouncementExtension,
]

const ALL_STATUSES: StatusTypes[] = ['join', 'rules', 'campaign', 'vote', 'results', 'decision', 'announcement', 'final']

const V2_PREFIX = 'v2'
const HASH_LENGTH = 16
// Lives in content/, not scripts/ — the app imports this JSON directly at build time to
// resolve text -> audio object key (see buildAudioObjectKey in content/hostNarration.ts).
const MANIFEST_PATH = path.join(__dirname, '..', 'content', 'audioManifest.json')

const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts'
const OPENAI_TTS_VOICE = process.env.OPENAI_TTS_VOICE || 'nova'
// 0.25-4.0, default 1.0. Slower reads as more deliberate/dramatic for a game host.
const OPENAI_TTS_SPEED = Number(process.env.OPENAI_TTS_SPEED) || 1
// Only used by gpt-4o-mini-tts (ignored by other models) — steers delivery/tone.
const OPENAI_TTS_INSTRUCTIONS = process.env.OPENAI_TTS_INSTRUCTIONS
  || 'Speak as Lucin, a dramatic, theatrical game show host narrating a high-stakes election. Confident, warm, with real gravity on pauses. American English accent.'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}. Check .env.local.`)
  return value
}

function hashText(text: string): string {
  return createHash('sha256').update(text.trim()).digest('hex').slice(0, HASH_LENGTH)
}

function objectKeyForText(text: string): string {
  return `${V2_PREFIX}/${hashText(text)}.mp3`
}

// Bare domain/URL text (e.g. "hallucinate.onrender.com") — no spaces, dot-separated
// segments, no sentence punctuation. Meant to be read on screen, not spoken aloud; TTS
// reading a URL literally ("hallucinate dot onrender dot com") sounds wrong.
const URL_LINE_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i

function addLine(lines: Map<string, string>, rawText: string): void {
  const text = rawText.trim()
  // Pure {TOKEN} lines (e.g. "{LEADER_NAME}", "{SWAP_CANDIDATE_NAME}") are never spoken by
  // the app — see hasDynamicTokens handling in pages/host/[code].tsx — so skip generating
  // audio for them.
  if (!text || isDynamicTokenLine(text) || URL_LINE_PATTERN.test(text)) return
  lines.set(objectKeyForText(text), text)
}

function collectAudioLines(statuses: StatusTypes[]): Map<string, string> {
  const lines = new Map<string, string>() // objectKey -> text, Map dedups identical text automatically
  for (const status of statuses) {
    const hostMessage = gameContent[status as keyof typeof gameContent]?.hostMessage
    if (!hostMessage) continue
    for (const entry of flattenHostMessages(hostMessage)) {
      addLine(lines, getHostMessageAudioText(entry))
    }
  }

  // Executive-decision announcement extensions aren't scoped to any single status filter
  // above (they're always appended to 'announcement' at runtime) — always scan them.
  for (const entry of flattenHostMessages(EXECUTIVE_DECISION_EXTENSIONS)) {
    addLine(lines, getHostMessageAudioText(entry))
  }

  // 'intro' has no gameContent.intro entry (its narration is sequenced directly by the
  // host page's intro-sequence effect, not the generic per-status system) — scan its
  // {audio, display} entries directly, same shape as rules' content, no nesting.
  for (const entry of flattenHostMessages(introductionAnnouncementExtension)) {
    addLine(lines, getHostMessageAudioText(entry))
  }

  return lines
}

function makeS3Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: requireEnv('R2_ENDPOINT'),
    credentials: {
      accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
    },
  })
}

async function objectExists(client: S3Client, key: string): Promise<boolean> {
  try {
    await client.send(new HeadObjectCommand({ Bucket: requireEnv('R2_BUCKET_NAME'), Key: key }))
    return true
  } catch (err) {
    const statusCode = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode
    if (statusCode === 404 || (err as { name?: string })?.name === 'NotFound') return false
    throw err
  }
}

async function synthesizeSpeech(text: string): Promise<Buffer> {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requireEnv('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_TTS_MODEL,
      voice: OPENAI_TTS_VOICE,
      input: text,
      response_format: 'mp3',
      speed: OPENAI_TTS_SPEED,
      ...(OPENAI_TTS_MODEL === 'gpt-4o-mini-tts' ? { instructions: OPENAI_TTS_INSTRUCTIONS } : {}),
    }),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`OpenAI TTS request failed (${res.status}): ${errText}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

async function uploadToR2(client: S3Client, key: string, body: Buffer): Promise<void> {
  await client.send(new PutObjectCommand({
    Bucket: requireEnv('R2_BUCKET_NAME'),
    Key: key,
    Body: body,
    ContentType: 'audio/mpeg',
  }))
}

async function updateManifest(entries: Map<string, string>): Promise<void> {
  let existing: Record<string, string> = {}
  try {
    existing = JSON.parse(await readFile(MANIFEST_PATH, 'utf-8'))
  } catch {
    // no manifest yet, start fresh
  }
  const merged = { ...existing, ...Object.fromEntries(entries) }
  await mkdir(path.dirname(MANIFEST_PATH), { recursive: true })
  await writeFile(MANIFEST_PATH, JSON.stringify(merged, null, 2) + '\n', 'utf-8')
}

async function main() {
  const rawArgs = process.argv.slice(2)
  const force = rawArgs.includes('--force')
  const statusArg = rawArgs.find(a => !a.startsWith('--')) as StatusTypes | undefined
  if (statusArg && !ALL_STATUSES.includes(statusArg)) {
    throw new Error(`Unknown status "${statusArg}". Expected one of: ${ALL_STATUSES.join(', ')}`)
  }
  const statuses = statusArg ? [statusArg] : ALL_STATUSES

  console.log(`Scanning status(es): ${statuses.join(', ')}${force ? ' (--force: overwriting existing)' : ''}`)
  console.log(`Voice: ${OPENAI_TTS_VOICE}  Speed: ${OPENAI_TTS_SPEED}  Model: ${OPENAI_TTS_MODEL}`)
  const lines = collectAudioLines(statuses)
  console.log(`Found ${lines.size} unique line(s) (deduped by text).`)

  const client = makeS3Client()
  let generated = 0
  let skipped = 0

  for (const [key, text] of lines) {
    const preview = text.length > 60 ? `${text.slice(0, 60)}...` : text
    if (!force && await objectExists(client, key)) {
      console.log(`SKIP  ${key}  "${preview}"`)
      skipped++
      continue
    }

    console.log(`GEN   ${key}  "${preview}"`)
    const audio = await synthesizeSpeech(text)
    await uploadToR2(client, key, audio)
    console.log(`OK    ${key}  (${audio.length} bytes)`)
    generated++
  }

  await updateManifest(lines)

  console.log(`\nDone. ${generated} generated, ${skipped} already existed. Manifest: ${MANIFEST_PATH}`)
}

main().catch(err => {
  console.error('\nFAILED:', err instanceof Error ? err.message : err)
  process.exit(1)
})
