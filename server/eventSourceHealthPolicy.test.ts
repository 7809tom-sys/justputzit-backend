import { describe, expect, it } from "vitest";
import { getEventSourceHealthSummary } from "../shared/eventSourceHealthPolicy";

describe("event source health summaries", () => {
  it("describes healthy, empty, and failed source outcomes without masking failures", () => {
    expect(getEventSourceHealthSummary("healthy", 2)).toBe("2 upcoming events found");
    expect(getEventSourceHealthSummary("empty", 0)).toContain("No upcoming events");
    expect(getEventSourceHealthSummary("failed", 0)).toContain("failed");
  });
});
