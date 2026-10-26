import { describe, expect, it } from "vitest";
import { buildTodayPlanSelection } from "../shared/todaysPlan";
import { isValidMemberSafetyTarget } from "../shared/memberSafetyPolicy";

describe("today's plan selection", () => {
  it("stores an event without an activity id", () => {
    expect(buildTodayPlanSelection({ id: 12, kind: "event", title: "Public concert" })).toEqual({
      eventId: 12,
      activityId: null,
      note: "Public concert",
    });
  });

  it("stores an activity without an event id", () => {
    expect(buildTodayPlanSelection({ id: 7, kind: "activity", title: "YMCA basketball" })).toEqual({
      eventId: null,
      activityId: 7,
      note: "YMCA basketball",
    });
  });

  it("only shows the match invitation button when the plan item is a public event", () => {
    const eventPlan = buildTodayPlanSelection({ id: 12, kind: "event", title: "Public concert" });
    const activityPlan = buildTodayPlanSelection({ id: 7, kind: "activity", title: "YMCA basketball" });
    expect(eventPlan.eventId).not.toBeNull();
    expect(activityPlan.eventId).toBeNull();
  });

  it("rejects a self-invitation before sending a proposal", () => {
    expect(isValidMemberSafetyTarget(5, 5)).toBe(false);
    expect(isValidMemberSafetyTarget(5, 6)).toBe(true);
  });
});
