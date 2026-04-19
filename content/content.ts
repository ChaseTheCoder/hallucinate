export const gameContent = {
  join: {
    playerMessage: "Waiting for fellow candidates to join...",
    hostMessage: ["Welcome to Hallucinate. Please get in a circle around me so that your fellow candidates can see you, but not your phone screen as you sign up for the election."],
    hostAction: "If you see all intended representatives on the host screen then..."
  },
  rules: {
    playerMessage: "Please watch the host screen for a reading of the rules.",
    hostMessage: [
      "Welcome, my name is Lucin and thank you for joining the election cycle. Election cycles will be held until only two candidates are still qualified for election. Each cycle consists of a campaign phase, a voting phase, and a decision phase... and then the cycle repeats until the final election.",
      "Step 1: Campaign",
      'You are given an preset amount of time to gain support for your fellow candidates to elect you, gain allies, or strategize for upcoming elections. As with any election, be carful who you trust. There will be a lot of executive decisions made by your elected leader that will impact your chances of winning future elections.',
      "Step 2: Vote",
      "When I announce the start of the voting phase, gather in a circle around me as you should be now. You must vote for up to three different candidates. The points are distributed as follows:",
      "- First vote gets 5 points",
      "- Second vote gets 3 points",
      "- Third vote gets 1 point",
      "The candidate with the most points at the end of the vote wins the election and becomes the leader. If a tie occurs, I will select a winner.",
      "Step 3: Decision",
      "The newly elected leader will be asked to step away from the group with the option to bring one other candidate of their choice to make executive decisions.",
      "The elected leader must make the executive decision to bar one of the candidates from running in all future election cycles.",
      "I may also provide the leader with additional executive decisions to choose from that may positively or negatively impact their fellow candidates.",
      "Step 4: Announcement",
      "Upon the leader's submission of their executive decision, I will announce the leader's decision to the group.",
      "If you are barred, you still get to vote, but will no longer be on the ballot.",
      "Hope is not all lost. I may provide a future leader with an executive decision to change your fate.",
      "Step 5: Final",
      "Election cycles will be repeated until only two candidates remain eligible for election.",
      "The final election of the two remaining candidates will determine the winner, with the candidate receiving the most points in that final election winning the game.",
      "Best of luck to all candidates. Let the election cycle begin."
    ],
    hostAction: "Start Game"
  },
  campaign: {
    playerMessage: "Campaign and strategize.",
    hostMessage: ["{TIME} until next election. Use this time to campaign and strategize."],
    hostAction: null
  },
  vote: {
    playerMessage: "Cast your votes (5, 3, 1 points). Select your top candidates.",
    waitingMessage: "Waiting for other players to vote...",
    hostMessage: ["It is now time to vote. Please circle around me so other players cannot see your selections. Then wait for all votes to be submitted."],
    playerAction: "Submit Vote"
  },
  results: {
    playerMessage: "Results on Host Screen.",
    hostMessage: [
      "The votes are in.",
      "Your elected leader is.",
      "{LEADER_NAME}"
    ],
    hostAction: "Continue"
  },
  decision: {
    leaderMessage: "Choose a player to bar from election.",
    playerMessage: "Waiting for a decision from your leader",
    hostMessage: [
      "Newly elected leader, please choose one fellow candidate to join you in the decision room. Or choose to go alone.",
      "Waiting for a decision from your leader"
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
      "The final votes been submitted and I have tallied the results.",
      "With a total of {WINNER_POINTS} points to the {LOSER_POINTS} points",
      "the winner of Hallucinate is...",
      "{WINNER_NAME}"],
    hostAction: "Officially End Game"
  }
}