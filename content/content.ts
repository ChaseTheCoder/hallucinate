export const gameContent = {
  join: {
    title: "Join Game",
    playerMessage: "Welcome to Hallucinate. Please watch the host screen for updates while your fellow comrades join.",
    hostMessage: "Waiting for players to join...",
    hostAction: "If you see all intended representatives on the host screen then..."
  },
  rules: {
    title: "Game Rules",
    playerMessage: "Please watch the host screen for a reading of the rules.",
    hostMessage: `You are given ${10} minutes to gain support for your fellow representatives to elect you.
    At the end of the time, everyone will vote on their phone for their top three candidates.
    - First vote gets 5 points
    - Second vote gets 3 points
    - Third vote gets 1 point

    The representative with the most votes is elected leader until the next election.
    The elected leader will choose at least one person to bar from being elected and possible another policy decison provided to them.
    Then I will anounce the executive order from your elected leader.
    Finally, campaining will resume for the next election cycle.`,
    hostAction: "Start Game"
  },
  campaign: {
    title: "Campaign Time",
    playerMessage: "Please campaign and strategize.",
    hostMessage: "{TIME} until next election. Use this time to campaign and strategize.",
    hostAction: null
  },
  vote: {
    title: "Voting Time",
    playerMessage: "Cast your votes (5, 3, 1 points). Select your top three candidates.",
    waitingMessage: "Waiting for other players to vote...",
    hostMessage: "Waiting for all votes to be submitted.",
    playerAction: "Vote"
  },
  results: {
    title: "Election Results",
    playerMessage: "The votes are in! See the results on the host screen.",
    hostMessage: "Election Results: {LEADER_NAME} is your elected leader!",
    hostAction: "Continue"
  },
  decision: {
    title: "Leader's Decision",
    leaderMessage: "Choose a player to bar from election.",
    playerMessage: "Waiting for a decision from your leader",
    hostMessage: "Waiting for a decision from your leader",
    leaderAction: "Submit Decision"
  },
  announcement: {
    title: "Executive Order",
    playerMessage: "...",
    hostMessage: "Your elected leader has made the executive order to... bar from election... {PLAYER_NAME}",
    hostAction: null
  },
  final: {
    title: "Final Election",
    playerMessage: "There are only two people left eligible for election. This will be the final vote to determine your final elected leader and winner.",
    hostMessage: "There are only two people left eligible for election. This will be the final vote to determine your final elected leader and winner.",
    hostAction: "Start Final Address"
  },
  complete: {
    title: "Game Over",
    playerMessage: "Redirecting to join screen...",
    hostMessage: "With a vote of {WINNER_POINTS} to {LOSER_POINTS} the winner is... {WINNER_NAME}",
    hostAction: "Start new game?"
  }
}