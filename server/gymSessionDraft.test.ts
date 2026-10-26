import { describe, expect, it } from "vitest";
import { parseGymSessionDraft } from "../shared/gymSessionDraft";

describe("Gym Buddy session creation draft", () => {
  const now = new Date("2026-08-14T12:00:00.000Z").getTime();

  it("returns a millisecond timestamp and the selected participant capacity", () => {
    expect(parseGymSessionDraft({
      title: "Morning lap swim",
      date: "2026-08-15",
      time: "08:30",
      maxParticipants: "12",
    }, now)).toEqual({
      ok: true,
      scheduledAt: new Date("2026-08-15T08:30").getTime(),
      maxParticipants: 12,
    });
  });

  it("rejects invalid capacity and sessions that are not in the future", () => {
    expect(parseGymSessionDraft({ title: "Lift", date: "2026-08-15", time: "08:30", maxParticipants: "1" }, now))
      .toMatchObject({ ok: false, message: "Choose a group size from 2 to 20 people." });
    expect(parseGymSessionDraft({ title: "Lift", date: "2026-08-14", time: "11:30", maxParticipants: "6" }, now))
      .toMatchObject({ ok: false, message: "Choose a future date and time for this workout." });
  });
});
