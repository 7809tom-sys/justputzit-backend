import { describe, expect, it } from "vitest";
import { formatCompetitiveGameContext } from "../shared/competitiveGameContext";

describe("competitive game context for Sally", () => {
  it("uses factual completed-game counts without exposing answers or attributing personality", () => {
    const context = formatCompetitiveGameContext({ gamesCompleted: 3, wins: 1, totalScore: 2400, jeopardyCompleted: 2, triviaCompleted: 1 });
    expect(context).toContain("3 completed competitive games");
    expect(context).toContain("2 Jeopardy");
    expect(context).not.toContain("answer");
    expect(context).not.toContain("personality");
  });
});
