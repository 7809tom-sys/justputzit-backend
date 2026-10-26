export function isJeopardyBoardComplete(totalClues: number, answeredClues: number) {
  return totalClues > 0 && answeredClues >= totalClues;
}

export function sortJeopardyPlayers<T extends { score: number }>(players: T[]) {
  return [...players].sort((left, right) => right.score - left.score);
}
