export const gameContent = {
  join: {
    title: "Join Game",
    playerMessage: "Waiting for fellow players to join...",
    hostMessage: ["Welcome to Hallucinate. Please get in a circle around me so that your fellow players can see you, but not your phone screen as you sign up for the election."],
    hostAction: "If you see all intended representatives on the host screen then..."
  },
  rules: {
    title: "Game Rules",
    playerMessage: "Please watch the host screen for a reading of the rules.",
    hostMessage: [
      "Thank you for joining the election cycle. Election cycles will be held until only two players are still qualified for election. Each cycle consists of a campaign phase, a voting phase, and a decision phase... and then the cycle repeats until the final election.",
      "Step 1: Campaign",
      'You are given an preset amount of minutes to gain support for your fellow representatives to elect you, gain allies, or strategize for the upcoming election. As with any election, be carful who you trust. There will be a lot of executive decisions made by your elected leader that will impact your chances of winning future elections.',
      "Step 2: Vote",
      "When I announce the start of the voting phase, gather in a circle around me as you should be now. You must vote for up to three different representatives. The points are distributed as follows:",
      "- First vote gets 5 points",
      "- Second vote gets 3 points",
      "- Third vote gets 1 point",
      "The representative with the most points at the end of the vote wins the election and becomes the leader.",
      "Step 3: Decision",
      "The newly elected leader will be aske to step away from the group with one other representative of their choice to make executive decisions.",
      "The elected leader must make the executive decision to bar one of the representatives from running in all future election cycles.",
      "An elected leader may also be given executive decisions to choose from that may positively impact their fellow candidates... or negatively.",
      "Step 4: Announcement",
      "Upon the leader's submission of their executive decision, I will announce the leader's decision to the group.",
      "If you are barred, you still get to participate in the campaign and voting phases, but will no longer be on the ballot.",
      "Hope is not all lost. A future leader may be given a chance to change your fate.",
      "Step 5: Final Election",
      "Election cycles will be repeated until only two representatives remain eligible for election. The final election will be between those two representatives and the representative with the most points in that final election wins the game.",
      "Best of luck to all candidates. Let the election cycle begin."
    ],
    hostAction: "Start Game"
  },
  campaign: {
    title: "Campaign Time",
    playerMessage: "Please campaign and strategize.",
    hostMessage: ["{TIME} until next election. Use this time to campaign and strategize."],
    hostAction: null
  },
  vote: {
    title: "Voting Time",
    playerMessage: "Cast your votes (5, 3, 1 points). Select your top candidates.",
    waitingMessage: "Waiting for other players to vote...",
    hostMessage: ["It is now time to vote. Please circle around me so other players cannot see your selections. Then wait for all votes to be submitted."],
    playerAction: "Vote"
  },
  results: {
    title: "Election Results",
    playerMessage: "The votes are in. See the results on the host screen.",
    hostMessage: [
      "The votes are in.",
      "Your elected leader is.",
      "{LEADER_NAME}"
    ],
    hostAction: "Continue"
  },
  decision: {
    title: "Leader's Decision",
    leaderMessage: "Choose a player to bar from election.",
    playerMessage: "Waiting for a decision from your leader",
    hostMessage: [
      "Newly elected leader, please choose one fellow representative to join you in the decision room. Or choose to go alone.",
      "Waiting for a decision from your leader"
    ],
    leaderAction: "Submit Decision"
  },
  announcement: {
    title: "Executive Order",
    playerMessage: "Check the host screen for the announcement.",
    hostMessage: [
      "Your leader has convened and I am ready to announce their decision.",
      "Your elected leader has made the executive order to bar from all future elections...",
      "{PLAYER_NAME}"
    ],
    hostAction: null
  },
  final: {
    title: "Final Results",
    playerMessage: "The final election is complete! See the results on the host screen.",
    hostMessage: [
      "The final votes been submitted and I have tallied the results.",
      "With a total of {WINNER_POINTS} points to the {LOSER_POINTS} points",
      "and is the winner of Hallucinate is...",
      "{WINNER_NAME}"],
    hostAction: "Start new game?"
  }
}