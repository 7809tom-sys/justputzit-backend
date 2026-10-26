export const SHARED_GAME_TYPES = ["would_you_rather", "trivia", "jeopardy", "trivia_pursuit", "bullgerdash", "pick_a_plan"] as const;
export type SharedGameType = (typeof SHARED_GAME_TYPES)[number];

export type SharedQuestionFormat = "would_you_rather" | "multiple_choice" | "free_response" | "visual";

export type SharedQuestionClientRecord = {
  id: number;
  prompt: string;
  format: SharedQuestionFormat;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  imageUrl: string | null;
  attribution: string | null;
  sourceUrl: string | null;
  gameConfig: Record<string, unknown>;
};

export function isSharedQuestionFormatEligible(format: SharedQuestionFormat, gameType: SharedGameType) {
  if (gameType === "would_you_rather") return format === "would_you_rather";
  if (gameType === "trivia" || gameType === "trivia_pursuit") return format === "multiple_choice" || format === "visual";
  if (gameType === "jeopardy") return format === "free_response" || format === "visual";
  return format === "free_response";
}

export function toSharedQuestionClientRecord(question: Omit<SharedQuestionClientRecord, "gameConfig"> & { gameConfig?: Record<string, unknown> }): SharedQuestionClientRecord {
  return {
    id: question.id,
    prompt: question.prompt,
    format: question.format,
    category: question.category,
    difficulty: question.difficulty,
    optionA: question.optionA,
    optionB: question.optionB,
    optionC: question.optionC,
    optionD: question.optionD,
    imageUrl: question.imageUrl,
    attribution: question.attribution,
    sourceUrl: question.sourceUrl,
    gameConfig: question.gameConfig ?? {},
  };
}
