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
      "Welcome, my name is Lucin and thank you for joining Hallucinate. Election cycles will be held until only two candidates are still qualified for election. Each cycle consists of three phases where you will elect a leader who shall make executive decisions on your behalf.",
      "Phase 1: Campaign",
      "You are given a preset amount of time to gain support, build alliances, and strategize for the upcoming election. As with any election, be careful who you trust.",
      "Phase 2: Election",
      "When I announce the start of the election, gather in a circle around me so others cannot see your screen. You must vote for up to three different candidates.",
      "The points are distributed as follows:",
      "- First vote gets 5 points",
      "- Second vote gets 3 points",
      "- Third vote gets 1 point",
      "The candidate with the most points wins the election and becomes the leader. If a tie occurs...",
      "then I will select a winner.",
      "Phase 3: Executive",
      "The newly elected leader will step away from the group, with the option to bring one candidate of their choice, to make executive decisions.",
      "The leader must bar one candidate from running in all future election cycles.",
      "I may also offer the leader additional executive decisions that may positively...",
      "or negatively impact their fellow candidates.",
      "Upon submission, I will announce the leader's decisions to the group.",
      "If you are barred, you still get to vote, but will no longer be on the ballot.",
      "However, that may not be the end of your political career.",
      "Phase Final: Elect Your Winner",
      "Election cycles will be repeated until only two candidates remain eligible for election.",
      "The candidate receiving the most points in that final election will become the winner.",
      "Best of luck to all candidates. Let the election cycle begin."
    ],
    hostAction: "Start Game"
  },
  campaign: {
    playerMessage: "Campaign and strategize.",
    hostMessage: [
      "{TIME}",
      "until next election."
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