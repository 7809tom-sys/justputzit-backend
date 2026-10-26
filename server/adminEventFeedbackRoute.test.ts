import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Sally event feedback administration report", () => {
  it("exposes an admin-only endpoint with member and event context", () => {
    const root = resolve(__dirname, "..");
    const routerSource = readFileSync(resolve(root, "server/routers.ts"), "utf8");
    const dbSource = readFileSync(resolve(root, "server/db.ts"), "utf8");

    expect(routerSource).toContain("getSallyEventFeedback: adminProcedure");
    expect(dbSource).toContain("export async function getAdminSallyEventFeedback");
    expect(dbSource).toContain("innerJoin(users, eq(eventRecommendationFeedback.userId, users.id))");
    expect(dbSource).toContain("innerJoin(communityEvents, eq(eventRecommendationFeedback.eventId, communityEvents.id))");
  });
});
