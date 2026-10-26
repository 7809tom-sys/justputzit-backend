import { describe, expect, it } from "vitest";
import { normalizeWorkoutDay } from "../shared/workoutDay";

describe("custom workout exercise day", () => {
  it("keeps valid weekday assignments", () => {
    expect(normalizeWorkoutDay("Wed")).toBe("Wed");
  });

  it("turns the Any day selection and unexpected values into no assigned day", () => {
    expect(normalizeWorkoutDay("any")).toBeUndefined();
    expect(normalizeWorkoutDay(" ")).toBeUndefined();
    expect(normalizeWorkoutDay(undefined)).toBeUndefined();
  });
});
