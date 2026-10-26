export function canSubmitJeopardyAnswer(answer: string, hasCurrentClue: boolean, isSubmitting: boolean) {
  return hasCurrentClue && answer.trim().length > 0 && !isSubmitting;
}

export function answeredJeopardyClueIds(answers: Array<{ questionId: number }>) {
  return new Set(answers.map((answer) => answer.questionId));
}
