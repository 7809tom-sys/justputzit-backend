import { describe, expect, it } from "vitest";
import { mergeProfileTraits } from "../shared/profileTraitMerge";

describe("Sally profile trait merge", () => {
  it("accumulates array traits without duplicate values across interviews", () => {
    expect(mergeProfileTraits(
      { hobbies: ["Songwriting", "Cabinetry"] },
      { hobbies: ["songwriting", "Hiking", "  "] },
    )).toMatchObject({ hobbies: ["Songwriting", "Cabinetry", "Hiking"] });
  });

  it("does not replace established values with empty extraction output", () => {
    expect(mergeProfileTraits(
      { favoriteFood: "Italian", humorStyle: "dry" },
      { favoriteFood: "  ", humorStyle: null },
    )).toMatchObject({ favoriteFood: "Italian", humorStyle: "dry" });
  });
});
