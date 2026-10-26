export function normalizeJeopardyAnswer(answer: string) {
  return answer
    .toLowerCase()
    .trim()
    .replace(/^(what|who|where)\s+(is|are|was|were)\s+/i, "")
    .replace(/^(a|an|the)\s+/i, "")
    .replace(/[?!.,;:]/g, "")
    .replace(/\s+/g, " ");
}

export function isJeopardyAnswerCorrect(answer: string, correctAnswer: string) {
  const normalizedAnswer = normalizeJeopardyAnswer(answer);
  const normalizedCorrect = normalizeJeopardyAnswer(correctAnswer);
  return normalizedAnswer.length > 0 && normalizedAnswer === normalizedCorrect;
}
