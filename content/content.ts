// Extra announcement messages appended when the leader chose bar another.
// These are appended to the standard announcement.hostMessage array on the host page.
export const barAnotherAnnouncementExtension: string[] = [
  "Your leader also made an executive decision to...",
  "bar another candidate...",
  "and that candidate is....",
  "{ED1_PLAYER_NAME}"
]

export const selfImmunityAnnouncementExtension: string[] = [
  "Your leader also made an executive decision to...",
  "grant themselves immunity in the next cycle."
]

export const grantImmunityAnnouncementExtension: string[] = [
  "Your leader also made an executive decision to...",
  "grant immunity to a fellow candidate in the next cycle.",
  "and that candidate is....",
  "{PLAYER_GRANTED_IMMUNITY}"
]

export const gameContent = {
  join: {
    playerMessage: "Waiting for fellow candidates to join...",
    hostMessage: [
      "Welcome to Hallucinate.",
      "Please circle around me so others cannot see your screen.",
      "Enter the game code and your full name on your device to join."
    ],
    hostAction: "If you see all intended representatives on the host screen then..."
  },
  rules: {
    playerMessage: "Please watch the host screen for a reading of the rules.",
    hostMessage: [
      {
        audio: "Hello, my name is Lucin.",
        display: "My name is Lucin.",
        content: [
          {
            audio: "Thank you for joining.",
            display: "Thank you for joining.",
          },
          {
            audio: "Are you ready to Hallucinate?",
            display: "Are you ready to Hallucinate?",
          }
        ]
      },
      {
        audio: "Election cycles will be held until only two candidates are still qualified for election. Each cycle consists of three phases where you will elect a leader who shall make executive decisions on your behalf.",
        display: "Election cycles will be held until only two candidates are still qualified for election.",
        content: null
      },
      {
        audio: "Phase 1: Campaign",
        display: "Phase 1: Campaign",
        content: [
          {
            audio: "You are given a preset of mostly unstructured time.",
            display: "Preset time mostly unstructured.",
          },
          {
            audio: "You are given a preset amount of time to gain support, build alliances, and strategize for the upcoming election. As with any election, be careful who you trust.",
            display: "Gain support & build alliances.",
          },
          {
            audio: "You can also use this time to get voters to hallucinate information for your benefit.",
            display: "Hallucinate information.",
          },
        ]
      },
      {
        audio: "Phase 2: Election",
        display: "Phase 2: Election",
        content: [
          {
            audio: "When I announce the start of the election, gather in a circle around me so others cannot see your screen..",
            display: "Gather in a circle around the host.",
          },
          {
            audio: "You must vote for up to three different candidates.",
            display: "Vote for up to 3 candidates.",
          },
          {
            audio: "The points are distributed as follows:",
            display: "Points as follows per vote:",
          },
          {
            audio: "- First vote gets 5 points",
            display: "1st = 5 points",
          },
          {
            audio: "- Second vote gets 3 points",
            display: "2nd = 3 points",
          },
          {
            audio: "- Third vote gets 1 point",
            display: "3rd = 1 point",
          },
          {
            audio: "The candidate with the most points wins the election and becomes the leader. If a tie occurs...",
            display: "Most points wins.",
          },
          {
            audio: "then I will select a winner.",
            display: "Ties broken by Lucin.",
          }
        ]
      },
      {
        audio: "Phase 3: Executive",
        display: "Phase 3: Executive",
        content: [
          {
            audio: "The newly elected leader will step away from the group, with the option to bring one candidate of their choice, to make executive decisions.",
            display: "Leader steps away with a fellow voter to decide.",
          },
          {
            audio: "The leader must bar one candidate from running in all future election cycles.",
            display: "Must bar 1 candidate.",
          },
          {
            audio: "I may also offer the leader additional executive decisions that may positively...",
            display: "May offer additional executive decisions—",
          },
          {
            audio: "or negatively impact their fellow candidates.",
            display: "—good or bad for others.",
          },
          {
            audio: "Upon submission, I will announce the leader's decisions to the group.",
            display: "Decisions announced to everyone.",
          },
          {
            audio: "If you are barred from running in future elections, you still get to vote, but will no longer be on the ballot.",
            display: "Barred players still vote, but not on the ballot.",
          },
          {
            audio: "However, that may not be the end of your political career.",
            display: "May not be the end of your political career....",
          }
        ]
      },
      {
        audio: "Election cycles will be repeated until only two candidates remain eligible for election.",
        display: "Election cycles repeat until 2 candidates remain.",
        content: null
      },
      {
        audio: "Phase Final: Elect Your Winner",
        display: "Final Phase: Elect Your Winner",
        content: [
          {
            audio: "When only two candidates remain, one last election cycle will be held.",
            display: "One last election cycle.",
          },
          {
            audio: "The candidate receiving the most points in that final election will become the winner.",
            display: "Most points wins it all.",
          },
          {
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
      "{TIME}",
      "Time until next election."
    ],
    hostAction: null
  },
  vote: {
    playerMessage: "Cast your votes (5, 3, 1 points).",
    waitingMessage: "Waiting for other players to vote...",
    hostMessage: ["It is now time to vote. Please circle around me so other players cannot see you cast your votes."],
    playerAction: "Submit Vote"
  },
  results: {
    playerMessage: "Results on Host Screen.",
    hostMessage: [
      "All players have cast their votes.",
      "Your elected leader is...",
      "{LEADER_NAME}"
    ],
    hostAction: "Continue"
  },
  decision: {
    leaderMessage: "Choose a player to bar from election.",
    playerMessage: "Waiting for a decision from your leader",
    hostMessage: [
      "Newly elected leader, please choose one fellow candidate to join you in the decision room. Or choose to go alone.",
      "Everyone else may wait patiently as your leader makes their executive decisions.",
    ],
    leaderAction: "Submit Decision"
  },
  announcement: {
    playerMessage: "Announcement on Host Screen.",
    hostMessage: [
      "Your leader has convened",
      "and made the executive decision to bar...",
      "{PLAYER_NAME}"
    ],
    hostAction: null
  },
  final: {
    playerMessage: "The final election is complete! See the results on the host screen.",
    hostMessage: [
      "The final votes have been submitted and I have tallied the results.",
      "the winner of Hallucinate is...",
      "{WINNER_NAME}"
    ],
    hostAction: "Officially End Game"
  }
}