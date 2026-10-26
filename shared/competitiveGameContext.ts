export type CompetitiveGameContext = {
  gamesCompleted: number;
  wins: number;
  totalScore: number;
  jeopardyCompleted: number;
  triviaCompleted: number;
};

export function formatCompetitiveGameContext(stats: CompetitiveGameContext) {
  if (stats.gamesCompleted === 0) return "No completed Jeopardy or Trivia Pursuit games are recorded yet.";
  return `${stats.gamesCompleted} completed competitive game${stats.gamesCompleted === 1 ? "" : "s"}: ${stats.jeopardyCompleted} Jeopardy, ${stats.triviaCompleted} Trivia Pursuit, ${stats.wins} win${stats.wins === 1 ? "" : "s"}.`;
}
