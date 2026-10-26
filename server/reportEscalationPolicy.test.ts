import { describe, expect, it } from "vitest";
import { shouldAutoSuspendForReports } from "../shared/reportEscalationPolicy";

describe("distinct-reporter report escalation", () => {
  it("suspends only after three distinct members submit open reports", () => {
    expect(shouldAutoSuspendForReports("user", [
      { reporterId: 1, status: "pending" },
      { reporterId: 2, status: "reviewed" },
      { reporterId: 3, status: "pending" },
    ])).toBe(true);
  });

  it("does not let duplicate or dismissed reports trigger an automatic suspension", () => {
    expect(shouldAutoSuspendForReports("user", [
      { reporterId: 1, status: "pending" },
      { reporterId: 1, status: "pending" },
      { reporterId: 2, status: "dismissed" },
      { reporterId: 3, status: "pending" },
    ])).toBe(false);
  });

  it("never automatically suspends an administrator", () => {
    expect(shouldAutoSuspendForReports("admin", [
      { reporterId: 1, status: "pending" },
      { reporterId: 2, status: "pending" },
      { reporterId: 3, status: "pending" },
    ])).toBe(false);
  });
});
