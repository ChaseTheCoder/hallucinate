import type { ExecutiveDecisionType } from '../types/types'

// Every hostMessage line below (and every executive-decision extension line) uses the
// same {id, audio, display, content?} shape. `audio` is what Lucin speaks, `display` is
// the on-screen caption (often identical to audio for statuses that don't need a shorter
// caption yet), and `content` (when present) nests a heading's body lines underneath it —
// see content/hostNarration.ts's flattenHostMessages() for how this gets resolved.
//
// `id` is the v2/{id}.mp3 object key currently in Cloudflare for that exact `audio` text
// (see scripts/generate-audio.ts). It's a snapshot, not auto-synced — if you edit `audio`
// text, the id here still shows the OLD hash for a moment, which is exactly what you want:
// copy it down before running `npm run generate-audio` again (new text -> new id), then
// delete the old v2/{that id}.mp3 from Cloudflare since nothing references it anymore.
// Re-run generate-audio after editing to get the fresh id to paste back in.
//
// Lines with no `id` have no generated audio, on purpose: {TOKEN}-only placeholders
// (e.g. "{LEADER_NAME}") can't be pre-recorded since the value is dynamic, and
// "hallucinate.onrender.com" is a URL meant to be read on screen, not spoken aloud.
// playerMessage/hostAction/leaderMessage/waitingMessage/playerAction/leaderAction are
// player-phone-screen or button text only — they're never narrated, so they stay plain
// strings with no id/audio/display wrapper.

// Final round (exactly 2 qualified players remain) replaces the normal Campaign-phase
// countdown display entirely with this scripted two-candidate speech sequence — see the
// dedicated effect in pages/host/[code].tsx, which paces these three blocks off elapsed
// time (since game.electionCycleStartTime) against a fixed 120s total
// (FINAL_ROUND_CAMPAIGN_SECONDS there, matching update.ts's server-authoritative final-round
// campaign duration) instead of game.cycleTime. Sequenced directly (like
// introductionAnnouncementExtension above) rather than through
// gameContent.campaign.hostMessage, since this needs custom per-candidate name
// interpolation ({FINAL_CANDIDATE_NAME}) and precise two-phase timing (only candidate B's
// block shows a live countdown) that the generic per-status narration system doesn't
// support. {FINAL_CANDIDATE_NAME} lines are {TOKEN}-only, like {LEADER_NAME} elsewhere in
// this file — no id/generated audio, since the value is dynamic per round.

// Step 1 (elapsed 0s): shown together immediately on entering the final campaign round, no
// countdown visible.
export const finalRoundCampaignIntro = [
  {
    id: "82585cac25fe1774",
    audio: "Only two candidates remain.",
    display: "Only two candidates remain.",
  },
  {
    id: "21b85a920a5f4f74",
    audio: "For the last campaign cycle, each candidate will be given 1 minute for a speech to gain influence one last time.",
    display: "For the last campaign cycle, each candidate will be given 1 minute for a speech to gain influence one last time.",
  },
  {
    id: "77effacf54349f34",
    audio: "Candidates, please stand on either side of the screen",
    display: "Candidates, please stand on either side of the screen",
  },
]

// Step 2 (elapsed 0-60s): candidate A's full minute — shows a live countdown, same as
// candidate B's block (the host effect renders it directly; not a content.ts token, since
// there's nothing to pre-record for a number that changes every second).
export const finalRoundCampaignCandidateA = [
  {
    id: "91fa97475385445a",
    audio: "We will start with this candidate:",
    display: "We will start with this candidate:",
  },
  {
    audio: "{FINAL_CANDIDATE_NAME}",
    display: "{FINAL_CANDIDATE_NAME}",
  },
]

// Step 3 (elapsed 60-120s): candidate B's full minute — also shows a live countdown,
// rendered directly by the host effect (not a content.ts token; there's nothing to
// pre-record for a number that changes every second).
export const finalRoundCampaignCandidateB = [
  {
    id: "7a3ac434fe4c61b2",
    audio: "Now this candidate has 1 minute:",
    display: "Now this candidate has 1 minute:",
  },
  {
    audio: "{FINAL_CANDIDATE_NAME}",
    display: "{FINAL_CANDIDATE_NAME}",
  },
]

// Player-phone-screen copy for the announcement-phase influence Popover (see
// pages/player/[code].tsx / components/player/InfluencePopover.tsx) — never narrated, so
// plain strings with no id/audio/display wrapper, same convention as playerMessage/etc.
// below. Keyed by BarredInfluenceType.
export const BARRED_INFLUENCE_PROMPTS: Record<'bar_leader' | 'grant_immunity' | 'post', string> = {
  bar_leader:
    "Early out, but game changing of influence. You have the power to bar a leader. You will be provided a four letter code that you can find in the Code tab. Only the code will be displayed. They cannot verify if you are truthful about the code. During 'CAMPAIGN' time, get a current leader to enter this code and they will be instantly barred. Come up with a hallucination to get a leader to enter such a code.",
  grant_immunity:
    "Early out, but game changing of influence. You have the power to provide a qualified candidate immunity. You will be provided a four letter code that you can find in the Code tab. Only the code will be displayed. They cannot verify if you are truthful about the code. During 'CAMPAIGN' time, get a player to trust you enough to enter the code.",
  post:
    "Barred, but still influential. You can send one 180 character post per campaign cycle to be displayed on the host screen. Click the \"Post\" button to enter your post. Spread misinformation, share a secret strategy, or highlight a preferred candidate.",
}

// Short bold/capitalized headline shown above the prompt in the influence Popover — same
// keying/convention as BARRED_INFLUENCE_PROMPTS above.
export const BARRED_INFLUENCE_TITLES: Record<'bar_leader' | 'grant_immunity' | 'post', string> = {
  bar_leader: "Bar a Leader",
  grant_immunity: "Immunity to Qualified Candidate",
  post: "Post on Host Screen",
}

// Leader-facing executive-decision menu content (see components/player/LeaderDecisionPanel.tsx)
// — the button label shown for each option in the 2-random-plus-opt-out menu. Never narrated,
// so plain strings with no id/audio/display wrapper, same convention as BARRED_INFLUENCE_*
// above. Keyed by ExecutiveDecisionType; 'opt_out' is included since it's a permanent 3rd menu
// option (see LeaderDecisionPanel's OPT_OUT_OPTION) even though it has no confirm-screen prompt.
export const EXECUTIVE_DECISION_TITLES: Record<ExecutiveDecisionType, string> = {
  immunity_code: "Code for Immunity to Another Player in the Next Round",
  requalify_code: "Code for a Barred Player to Become Qualified Again",
  barred_swap_chance: "Give a Barred Player a Chance to Swap Back In",
  opt_out: "Make No Executive Decision",
}

// Confirm-screen explanation shown after selecting an executive decision (see
// LeaderDecisionPanel's 'immunity_code_confirm'/'requalify_code_confirm'/'swap_select'
// phases). 'opt_out' has no confirm screen, so it's intentionally absent here.
export const EXECUTIVE_DECISION_PROMPTS: Partial<Record<ExecutiveDecisionType, string>> = {
  immunity_code:
    "You will be provided a 4 letter code to provide a qualified immunity other than yourself. " +
    "It will appear during the CAMPAIGN phase on the Code tab. The player must type in the code " +
    "and submit it on the Code page to work. The code is valid only for the next campaign cycle.",
  requalify_code:
    "You will be provided a 4 letter code to provide a barred player to become qualified again. " +
    "It will appear during the CAMPAIGN phase  on the Code tab. The player must type in the code " +
    "and submit it on the Code page to work. The code is valid only for the next campaign cycle.",
  barred_swap_chance:
    "During the announcement of you executivie decisions, your choice will be announced. That player " +
    "then has 25 seconds to open their phone and select a player on their screen to bar. If they do " +
    "they then become qualified.",
}

export const introductionAnnouncementExtension = [
  {
    id: "f9829b49c406c727",
    audio: "AI Hallucination",
    display: "AI Hallucination",
    content: [
      {
        id: "1351d52cee6cc1c0",
        audio: "noun",
        display: "noun",
      },
      {
        id: "0f82b20672f334d6",
        audio: "a response from an artificial intelligence system that contains false, misleading, or completely fabricated information, but is presented with absolute confidence as if it were true",
        display: "a response from an artificial intelligence system that contains false, misleading, or completely fabricated information, but is presented with absolute confidence as if it were true",
      }
    ]
  },
  {
    id: "78adee30a4d4acca",
    audio: "Humans have become weary of AI because of hallucinations",
    display: "Humans have become weary of AI because of hallucinations.",
  },
  {
    id: "5061fcf1d18f2a6d",
    audio: "So I am here to do some research on how truthful, leading, and completely information based humans can be so that I may become better",
    display: "So I am here to do some research on how truthful, leading, and completely information based humans can be so that I may become better.",
  },
  {
    id: "f0d69b8543060b40",
    audio: "From the data ingestion I have done so far, I know the best way to learn from humans is to have you all replicate a method that holds humans to their hightest standards of truthfulness",
    display: "From the data ingestion I have done so far, I know the best way to learn from humans is to have you all replicate a method that holds humans to their hightest standards of truthfulness...",
  },
  {
    id: "dc39136b5766d756",
    audio: "An election.",
    display: "...an election.",
  },
]

// Extra announcement messages appended when the leader chose immunity_code.
// These are appended to the standard announcement.hostMessage array on the host page.
export const immunityCodeAnnouncementExtension = [
  {
    id: "74b6c938c6b543d8",
    audio: "Your leader also made an executive decision to...",
    display: "Your leader also made an executive decision to...",
  },
  {
    id: "69f957528e9e73e8",
    audio: "generate a code of immunity for a fellow candidate to claim in the next campaign cycle.",
    display: "generate a code of immunity for a fellow candidate to claim in the next campaign cycle.",
  },
]

export const requalifyCodeAnnouncementExtension = [
  {
    id: "74b6c938c6b543d8",
    audio: "Your leader also made an executive decision to...",
    display: "Your leader also made an executive decision to...",
  },
  {
    id: "fa81f4bb78379cd7",
    audio: "generate a code that could return a barred candidate to qualification in the next campaign cycle.",
    display: "generate a code that could return a barred candidate to qualification in the next campaign cycle.",
  },
]

// barred_swap_chance is the only executive decision that pauses the standard one-way
// narration: the {SWAP_WINDOW} entry is a structural marker (never displayed as text) that
// the host page intercepts to activate a real-time 25s window and show a live countdown
// instead of auto-advancing — see the swap-window effects in pages/host/[code].tsx.
// {SWAP_RESULT} is likewise resolved dynamically (two very different outcomes) rather than
// substituted into surrounding text, consistent with how other {TOKEN}-only lines carry no
// pre-recorded audio.
export const barredSwapAnnouncementExtension = [
  {
    id: "74b6c938c6b543d8",
    audio: "Your leader also made an executive decision to...",
    display: "Your leader also made an executive decision to...",
  },
  {
    id: "b3455fc2c0d76660",
    audio: "give one barred candidate a chance to reclaim their qualification...",
    display: "give one barred candidate a chance to reclaim their qualification...",
  },
  {
    id: "df924a1569de1b6b",
    audio: "and that candidate is....",
    display: "and that candidate is....",
  },
  {
    audio: "{SWAP_CANDIDATE_NAME}",
    display: "{SWAP_CANDIDATE_NAME}",
  },
  {
    audio: "{SWAP_WINDOW}",
    display: "{SWAP_WINDOW}",
  },
  {
    audio: "{SWAP_RESULT}",
    display: "{SWAP_RESULT}",
  },
]

// Appended to vote.hostMessage at runtime, once per game, for the one-time "barred
// candidate twist" round (see game.activeTwistRound / hasTriggeredBarredCandidateTwist in
// types/types.ts and the trigger in pages/api/game/[code]/update.ts). Plays AFTER the
// normal vote-phase narration, only for the round where the twist actually fires — every
// other round's vote phase is completely unaffected. No `id` yet, same as other
// recently-added static lines here — audio generation is a separate step run manually.
export const barredCandidateTwistVoteExtension = [
  {
    id: "3bb08b6b539ef0b0",
    audio: "But this round will be different.",
    display: "But this round will be different.",
  },
  {
    id: "7e02ab2a4dd2efa4",
    audio: "I want to assure barred players are represented",
    display: "I want to assure barred players are represented",
  },
  {
    id: "0bb2f88da2851aae",
    audio: "So for this election you will be voting for barred candidates.",
    display: "So for this election you will be voting for barred candidates.",
  },
  {
    id: "13a89a0c55fa3c2e",
    audio: "The winning candidate will become qualified and bar a candidate.",
    display: "The winning candidate will become qualified and bar a candidate.",
  },
]

export const gameContent = {
  join: {
    playerMessage: "Waiting for fellow candidates to join...",
    hostMessage: [
      {
        id: "194e9b97f580823a",
        audio: "I'm Lucin, your host.",
        display: "I'm Lucin, your host.",
      },
      {
        id: "8d118e5489e1511a",
        audio: "Welcome to Hallucinate.",
        display: "Welcome to Hallucinate.",
      },
      {
        id: "2b85113ca8141f92",
        audio: "Please circle around me so others cannot see your screen.",
        display: "Please circle around me so others cannot see your screen.",
      },
      {
        id: "004b2422ab5b8e7e",
        audio: "Enter the game code and your full name on your device to join.",
        display: "Enter the game code and your full name on your device to join.",
      },
      {
        audio: "hallucinate.onrender.com",
        display: "hallucinate.onrender.com",
      }
    ],
    hostAction: "If you see all intended representatives on the host screen then..."
  },
  rules: {
    playerMessage: "Please watch the host screen for a reading of the rules.",
    hostMessage: [
      {
        id: "4074644b5b65ceda",
        audio: "Again, my name is Lucin.",
        display: "Again, my name is Lucin.",
        content: [
          {
            id: "71ac617622445f8b",
            audio: "Thank you for joining.",
            display: "Thank you for joining.",
          },
          {
            id: "0416553239193578",
            audio: "Are you ready to Hallucinate?",
            display: "Are you ready to Hallucinate?",
          }
        ]
      },
      {
        id: "d17372d8789b2db0",
        audio: "Election cycles will be held until only two candidates are still qualified for election. Each cycle consists of three phases where you will elect a leader who shall make executive decisions on your behalf.",
        display: "Election cycles will be held until only two candidates are still qualified for election.",
        content: null
      },
      {
        id: "4a01b032b31ad48c",
        audio: "Phase 1: Campaign",
        display: "Phase 1: Campaign",
        content: [
          {
            id: "4f07657e5e6c635b",
            audio: "You are given a preset of mostly unstructured time.",
            display: "Preset time, mostly unstructured.",
          },
          {
            id: "39a06ae7515d8a2d",
            audio: "Use this time to gain support, build alliances, and strategize for the upcoming election. As with any election, be careful who you trust.",
            display: "Gain support & build alliances.",
          },
          {
            id: "ec6dd198b7351dd3",
            audio: "You can also use this time to get voters to hallucinate information for your benefit.",
            display: "Hallucinate information to your benefit.",
          },
        ]
      },
      {
        id: "bbcc474762e04962",
        audio: "Phase 2: Election",
        display: "Phase 2: Election",
        content: [
          {
            id: "518176d8eaf94a7a",
            audio: "When I announce the start of the election, gather in a circle around me so others cannot see your screen. Please go back to the same spot every election cycle.",
            display: "Gather in a circle around the host.",
          },
          {
            id: "7e614f9c3a56b6cd",
            audio: "You must vote for three different candidates.",
            display: "Vote for 3 candidates.",
          },
          {
            id: "558a650e94f795be",
            audio: "The points are distributed as follows:",
            display: "Points as follows per vote:",
          },
          {
            id: "9f72dc0098e87db3",
            audio: "- First vote gets 5 points",
            display: "1st = 5 points",
          },
          {
            id: "9bfee0320a21548b",
            audio: "- Second vote gets 3 points",
            display: "2nd = 3 points",
          },
          {
            id: "cdd37205deab0684",
            audio: "- Third vote gets 1 point",
            display: "3rd = 1 point",
          },
          {
            id: "0ccb7ffd3702ca18",
            audio: "The candidate with the most points wins the election and becomes the leader.",
            display: "Most points wins.",
          },
          {
            id: "af70a8ec229ce2e4",
            audio: "If a tie occurs then I will select a winner.",
            display: "Ties broken by Lucin.",
          }
        ]
      },
      {
        id: "6f24466780347130",
        audio: "Phase 3: Executive",
        display: "Phase 3: Executive",
        content: [
          {
            id: "d0782ab879ff406c",
            audio: "The newly elected leader will step away from the group, with the option to bring one candidate of their choice, to make executive decisions.",
            display: "Leader steps away with a fellow voter to decide.",
          },
          {
            id: "f35a6c983f4ef22c",
            audio: "The leader must bar one candidate from running in all future election cycles.",
            display: "Must bar 1 candidate.",
          },
          {
            id: "372568014b256073",
            audio: "I may also offer the leader additional executive decisions...",
            display: "Leaders also make an additional executive decision—",
          },
          {
            id: "1a2cc2b1daa13e36",
            audio: "Which may positively or negatively impact their fellow candidates.",
            display: "positive or negative for others.",
          },
          {
            id: "8b845951d7a198ab",
            audio: "Upon submission, I will announce the leader's decisions to the group.",
            display: "Decisions announced to everyone.",
          },
          {
            id: "8901175b31f582d1",
            audio: "If you are barred from running in future elections, you still get to vote, but will no longer be on the ballot.",
            display: "Barred players still vote, but not on the ballot.",
          },
          {
            id: "34f800a93d97c32f",
            audio: "However, that may not be the end of your political career.",
            display: "May not be the end of your political career....",
          }
        ]
      },
      {
        id: "43e3721e2731bfb0",
        audio: "Remember, if you are barred:",
        display: "Remember, if you are barred:",
        content: [
          {
            id: "4cc0fe9f9aae63f7",
            audio: "You will still be able to vote in future elections.",
            display: "You can still vote.",
          },
          {
            id: "66b0bfa84bc06029",
            audio: "You will no longer be on the ballot.",
            display: "You will no longer be on the ballot.",
          },
          {
            id: "0f9b72fa4d3e637c",
            audio: "There still may be opportunities to become qualified for elections again.",
            display: "Still may become qualified for elections again.",
          }
        ]
      },
      {
        id: "5e6ea164efb6c57a",
        audio: "Election cycles will be repeated until only two candidates remain eligible for election.",
        display: "Election cycles repeat until 2 candidates remain.",
        content: null
      },
      {
        id: "5fd718d0f9cd599b",
        audio: "Phase Final: Elect Your Winner",
        display: "Final Phase: Elect Your Winner",
        content: [
          {
            id: "f659445a8b826d6b",
            audio: "When only two candidates remain, one last election cycle will be held.",
            display: "One last election cycle.",
          },
          {
            id: "701f2ab54993cd08",
            audio: "The candidate receiving the most points in that final election will become the winner.",
            display: "Most points wins it all.",
          },
          {
            id: "a99004056126fe3d",
            audio: "Best of luck to all candidates. Let the election cycle begin.",
            display: "Good luck. Let's begin!",
          }
        ]
      }
    ],
    hostAction: "Start Game"
  },
  campaign: {
    playerMessage: "Campaign and strategize.",
    hostMessage: [
      {
        audio: "{TIME}",
        display: "{TIME}",
      },
      {
        id: "e45a9a93d9e43560",
        audio: "Time until next election.",
        display: "Time until next election.",
      },
      // Plays after the line above (same generic narration pacing every other status uses —
      // this needs no special-casing to appear "after that audio has played"). A
      // ritual/red-herring line: shown/narrated on EVERY campaign round unconditionally,
      // regardless of whether any barred-influence code is actually in play that round, so
      // its mere presence never itself signals that something is happening this round. Not
      // shown during the final round (2 qualified players) — that round fully replaces this
      // view with its own scripted sequence (see finalRoundCampaignIntro/A/B above).
      {
        id: "3b466d4ae8397f86",
        audio: "Citizens, check your phone for a possible alert.",
        display: "Citizens, check your phone for a possible alert.",
      }
    ],
    hostAction: null
  },
  vote: {
    playerMessage: "Cast your votes (5, 3, 1 points).",
    waitingMessage: "Waiting for other players to vote...",
    hostMessage: [
      {
        id: "6cbb8cdcdabe69b6",
        audio: "It is now time to vote. Please circle around me so other players cannot see you cast your votes.",
        display: "It is now time to vote. Please circle around me so other players cannot see you cast your votes.",
      }
    ],
    playerAction: "Submit Vote"
  },
  results: {
    playerMessage: "Results on Host Screen.",
    hostMessage: [
      {
        id: "69f244e46007fb1c",
        audio: "All players have cast their votes.",
        display: "All players have cast their votes.",
      },
      {
        id: "d8ccc847ed43ca20",
        audio: "Your elected leader is...",
        display: "Your elected leader is...",
      },
      {
        audio: "{LEADER_NAME}",
        display: "{LEADER_NAME}",
      }
    ],
    hostAction: "Continue"
  },
  decision: {
    leaderMessage: "Choose a player to bar from election.",
    playerMessage: "Waiting for a decision from your leader",
    hostMessage: [
      {
        id: "2d52cc9a33109db9",
        audio: "Newly elected leader, please choose one fellow candidate to join you in the decision room. Or choose to go alone.",
        display: "Newly elected leader, please choose one fellow candidate to join you in the decision room. Or choose to go alone.",
      },
      {
        id: "f1fd8bc9a3119d8a",
        audio: "Everyone else may wait patiently as your leader makes their executive decisions.",
        display: "Everyone else may wait patiently as your leader makes their executive decisions.",
      }
    ],
    leaderAction: "Submit Decision"
  },
  announcement: {
    playerMessage: "Announcement on Host Screen.",
    hostMessage: [
      {
        id: "30c76f51c5fd518c",
        audio: "Your leader has convened",
        display: "Your leader has convened",
      },
      {
        id: "442b451b87f4a630",
        audio: "and made the executive decision to bar...",
        display: "and made the executive decision to bar...",
      },
      {
        audio: "{PLAYER_NAME}",
        display: "{PLAYER_NAME}",
      }
    ],
    hostAction: null
  },
  final: {
    playerMessage: "The final election is complete! See the results on the host screen.",
    hostMessage: [
      {
        id: "7186950574d15f06",
        audio: "The final votes have been submitted and I have tallied the results.",
        display: "The final votes have been submitted and I have tallied the results.",
      },
      {
        id: "d82db7f5171f210e",
        audio: "the winner of Hallucinate is...",
        display: "the winner of Hallucinate is...",
      },
      {
        audio: "{WINNER_NAME}",
        display: "{WINNER_NAME}",
      }
    ],
    hostAction: "Officially End Game"
  }
}
