import { describe, expect, it } from "vitest";
import { normalizeSavedLocationDraft, sortSavedLocationLabels } from "./savedLocationPolicy";

describe("saved location policy", () => {
  it("makes the first saved location home and uses the city when the label is blank", () => {
    expect(normalizeSavedLocationDraft({
      label: "  ",
      city: " Madison ",
      state: " WI ",
      postalCode: " 53703 ",
      latitude: "43.0389",
      longitude: "-87.9065",
    }, true)).toEqual({
      label: "Madison",
      city: "Madison",
      state: "WI",
      postalCode: "53703",
      latitude: "43.0389",
      longitude: "-87.9065",
      isHome: true,
    });
  });

  it("keeps an explicitly selected home location home even when other locations exist", () => {
    expect(normalizeSavedLocationDraft({
      label: "Work",
      city: "Oklahoma City",
      state: "OK",
      latitude: "35.4676",
      longitude: "-97.5164",
      isHome: true,
    }, false).isHome).toBe(true);
  });

  it("orders home first and then labels alphabetically", () => {
    expect(sortSavedLocationLabels([
      { label: "Chicago", isHome: false },
      { label: "Home", isHome: true },
      { label: "Madison", isHome: false },
    ])).toEqual([
      { label: "Home", isHome: true },
      { label: "Chicago", isHome: false },
      { label: "Madison", isHome: false },
    ]);
  });
});
