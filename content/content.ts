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
    id: "823e837ff2f1a7bc",
    audio: "So I am here to help to some research on how truthful, leading, and completely information based humans can be so that I may become better",
    display: "So I am here to help to some research on how truthful, leading, and completely information based humans can be so that I may become better.",
  },
  {
    id: "a72f4246f611ef4e",
    audio: "From the data ingestion I have done so far, I know the best way to learn from humans is to replicate a method that holds humans to their hightest standards of truthfulness",
    display: "From the data ingestion I have done so far, I know the best way to learn from humans is to replicate a method that holds humans to their hightest standards of truthfulness...",
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
        id: "1a360aed16debcb9",
        audio: "Hello, my name is Lucin.",
        display: "My name is Lucin.",
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
            display: "Preset time mostly unstructured.",
          },
          {
            id: "62fa3ca879d32f6e",
            audio: "You are given a preset amount of time to gain support, build alliances, and strategize for the upcoming election. As with any election, be careful who you trust.",
            display: "Gain support & build alliances.",
          },
          {
            id: "ec6dd198b7351dd3",
            audio: "You can also use this time to get voters to hallucinate information for your benefit.",
            display: "Hallucinate information.",
          },
        ]
      },
      {
        id: "bbcc474762e04962",
        audio: "Phase 2: Election",
        display: "Phase 2: Election",
        content: [
          {
            id: "f652df4203a1a65d",
            audio: "When I announce the start of the election, gather in a circle around me so others cannot see your screen..",
            display: "Gather in a circle around the host.",
          },
          {
            id: "6a5b3a03a1b07dc5",
            audio: "You must vote for up to three different candidates.",
            display: "Vote for up to 3 candidates.",
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
            id: "af454faedd76e745",
            audio: "The candidate with the most points wins the election and becomes the leader. If a tie occurs...",
            display: "Most points wins.",
          },
          {
            id: "29d0c720434d7dcc",
            audio: "then I will select a winner.",
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
            id: "f0d16a761d04819c",
            audio: "I may also offer the leader additional executive decisions that may positively...",
            display: "May offer additional executive decisions—",
          },
          {
            id: "24d90d31e8d60a60",
            audio: "or negatively impact their fellow candidates.",
            display: "—good or bad for others.",
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
