export const gameContent = {
  join: {
    playerMessage: "Waiting for fellow candidates to join...",
    hostMessage: ["Welcome to Hallucinate. Enter the game code and your real name on your device to join."],
    hostAction: "If you see all intended representatives on the host screen then..."
  },
  rules: {
    playerMessage: "Please watch the host screen for a reading of the rules.",
    hostMessage: [
      "Welcome, my name is Lucin and thank you for joining Hallucinate. Election cycles will be held until only two candidates are still qualified for election. Each cycle consists of a few phases where you will elect a leader who shall make executive decisions on your behalf.",
      "Phase 1: Campaign",
      'You are given an preset amount of time to gain support for your fellow candidates to elect you, gain allies, or strategize for upcoming elections. As with any election, be careful who you trust. There will be a lot of executive decisions made by your elected leader that will impact your chances of winning future elections.',
      "Phase 2: Vote",
      "When I announce the start of the voting phase, gather in a circle around me as you should be now. You must vote for up to three different candidates.",
      "The points are distributed as follows:",
      "- First vote gets 5 points",
      "- Second vote gets 3 points",
      "- Third vote gets 1 point",
      "Phase 3: Results",
      "The candidate with the most points at the end of the vote wins the election and becomes the leader. If a tie occurs...",
      "then I will select a winner.",
      "Phase 4: Decision",
      "The newly elected leader will be asked to step away from the group with the option to bring one other candidate of their choice to make executive decisions.",
      "The elected leader must make the executive decision to bar one of the candidates from running in all future election cycles.",
      "I may also provide the leader with additional executive decisions to choose from that may positively...",
      "or negatively impact their fellow candidates.",
      "Phase 5: Announcement",
      "Upon the leader's submission of their executive decisions, I will announce the leader's decision to the group.",
      "If you are barred, you still get to vote, but will no longer be on the ballot.",
      "However, that may not be the end of your political career.",
      "I may provide a future leader with an executive decision that may change that.",
      "Phase Final: Elect Your Winner",
      "Election cycles will be repeated until only two candidates remain eligible for election.",
      "The candidate receiving the most points in that final election will become the winner.",
      "Best of luck to all candidates. Let the election cycle begin."
    ],
    hostAction: "Start Game"
  },
  campaign: {
    playerMessage: "Campaign and strategize.",
    hostMessage: ["{TIME} minutes until next election."],
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
      "Everyone else may wait pateintly as your leader makes their executive decisions.",
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
      "With a total of {WINNER_POINTS} points to the {LOSER_POINTS} points",
      "the winner of Hallucinate is...",
      "{WINNER_NAME}"
    ],
    hostAction: "Officially End Game"
  }
}