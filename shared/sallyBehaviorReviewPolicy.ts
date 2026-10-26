export type InterviewTurn = { role: "user" | "assistant"; content: string };

export function getSallyBehaviorReviewCue(messages: InterviewTurn[]) {
  const userMessages = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim().toLowerCase().replace(/\s+/g, " "))
    .filter(Boolean);

  if (userMessages.length < 5) return null;

  const repeatedResponseCount = userMessages.filter(
    (message, index) => userMessages.indexOf(message) !== index,
  ).length;
  if (repeatedResponseCount >= 4) {
    return "Repeated the same interview response across multiple turns";
  }

  const lowSignalCount = userMessages.filter((message) => message.length <= 3).length;
  if (lowSignalCount >= 4) {
    return "Repeatedly provided very short interview responses";
  }

  return null;
}
