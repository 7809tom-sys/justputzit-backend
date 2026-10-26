export const FINISH_SENTENCE_PROMPTS = [
  { id: 1, prompt: "A perfect local Saturday starts with…", traitKey: "idealWeekend" },
  { id: 2, prompt: "The quickest way to make me laugh is…", traitKey: "humorStyle" },
  { id: 3, prompt: "I lose track of time when I’m…", traitKey: "favoriteActivities" },
  { id: 4, prompt: "One small thing I’m looking forward to is…", traitKey: "lookingForwardTo" },
  { id: 5, prompt: "A public plan I would happily say yes to is…", traitKey: "publicPlanInterest" },
] as const;

export function normalizeFinishSentenceAnswer(answer: string) {
  return answer.replace(/\s+/g, " ").trim().slice(0, 240);
}
