import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb, recordWyrAnswer } from "./db";
import { matches, users, wouldYouRatherAnswers, wyrChallenges } from "../drizzle/schema";
import { and, eq, or } from "drizzle-orm";

const CHALLENGER_ID = 990031;
const CHALLENGED_ID = 990032;
const OUTSIDER_ID = 990033;
let matchId = 0;
let challengeId = 0;

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function contextFor(userId: number): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `wyr-challenge-test-${userId}`,
    email: `wyr-challenge-test-${userId}@example.com`,
    name: "WYR Challenge Test Member",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("Would You Rather private challenge flow", () => {
  beforeAll(async () => {
    const db = await getDb();
    if (!db) return;

    for (const userId of [CHALLENGER_ID, CHALLENGED_ID, OUTSIDER_ID]) {
      await db.insert(users).values({
        id: userId,
        openId: `wyr-challenge-test-${userId}`,
        email: `wyr-challenge-test-${userId}@example.com`,
        name: "WYR Challenge Test Member",
        loginMethod: "manus",
        role: "user",
      }).onDuplicateKeyUpdate({ set: { name: "WYR Challenge Test Member" } });
      await db.delete(wouldYouRatherAnswers).where(eq(wouldYouRatherAnswers.userId, userId));
    }

    await db.delete(wyrChallenges).where(or(
      eq(wyrChallenges.challengerId, CHALLENGER_ID),
      eq(wyrChallenges.challengedId, CHALLENGED_ID),
    ));
    await db.delete(matches).where(or(
      eq(matches.user1Id, CHALLENGER_ID),
      eq(matches.user2Id, CHALLENGED_ID),
    ));
    await db.insert(matches).values({
      user1Id: CHALLENGER_ID,
      user2Id: CHALLENGED_ID,
      compatibilityScore: 75,
      status: "active",
    });
    const [testMatch] = await db
      .select({ id: matches.id })
      .from(matches)
      .where(and(eq(matches.user1Id, CHALLENGER_ID), eq(matches.user2Id, CHALLENGED_ID)))
      .limit(1);
    matchId = testMatch?.id ?? 0;
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    await db.delete(wyrChallenges).where(or(
      eq(wyrChallenges.challengerId, CHALLENGER_ID),
      eq(wyrChallenges.challengedId, CHALLENGED_ID),
    ));
    await db.delete(matches).where(or(
      eq(matches.user1Id, CHALLENGER_ID),
      eq(matches.user2Id, CHALLENGED_ID),
    ));
    for (const userId of [CHALLENGER_ID, CHALLENGED_ID, OUTSIDER_ID]) {
      await db.delete(wouldYouRatherAnswers).where(eq(wouldYouRatherAnswers.userId, userId));
      await db.delete(users).where(eq(users.id, userId));
    }
  });

  it("creates an authorized match challenge and shows only aggregate partner progress", async () => {
    const challenger = appRouter.createCaller(contextFor(CHALLENGER_ID));
    expect(matchId).toBeGreaterThan(0);
    const challenge = await challenger.wyr.sendChallenge({ challengedId: CHALLENGED_ID, matchId });
    challengeId = challenge.challenge?.id ?? 0;

    expect(challengeId).toBeGreaterThan(0);
    expect(challenge.questions).toHaveLength(10);

    const lobby = await challenger.wyr.getChallenge({ challengeId });
    expect(lobby.displayStatus).toBe("pending");
    expect(lobby.myAnsweredCount).toBe(0);
    expect(lobby.partnerAnsweredCount).toBe(0);
    expect(lobby.canReveal).toBe(false);
    expect(lobby).not.toHaveProperty("partnerAnsweredQuestionIds");
  });

  it("rejects a nonparticipant from reading the private questions", async () => {
    const outsider = appRouter.createCaller(contextFor(OUTSIDER_ID));
    await expect(outsider.wyr.getChallenge({ challengeId })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("blocks early reveal, reports both members' completion, and then stores compatibility", async () => {
    const challenger = appRouter.createCaller(contextFor(CHALLENGER_ID));
    const challenged = appRouter.createCaller(contextFor(CHALLENGED_ID));
    const initial = await challenger.wyr.getChallenge({ challengeId });
    const questionIds = initial.questions.map((question) => question.id);

    for (const questionId of questionIds) {
      await recordWyrAnswer(CHALLENGER_ID, questionId, "A");
    }

    const waiting = await challenger.wyr.getChallenge({ challengeId });
    expect(waiting.displayStatus).toBe("active");
    expect(waiting.myAnsweredCount).toBe(questionIds.length);
    expect(waiting.partnerAnsweredCount).toBe(0);
    await expect(challenger.wyr.computeCompatibility({ challengeId })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    for (const [index, questionId] of questionIds.entries()) {
      await recordWyrAnswer(CHALLENGED_ID, questionId, index % 2 === 0 ? "A" : "B");
    }

    const ready = await challenged.wyr.getChallenge({ challengeId });
    expect(ready.myAnsweredCount).toBe(questionIds.length);
    expect(ready.partnerAnsweredCount).toBe(questionIds.length);
    expect(ready.canReveal).toBe(true);

    const result = await challenged.wyr.computeCompatibility({ challengeId });
    expect(result.compatibilityPct).toBeGreaterThanOrEqual(0);
    expect(result.compatibilityPct).toBeLessThanOrEqual(100);

    const completed = await challenger.wyr.getChallenge({ challengeId });
    expect(completed.displayStatus).toBe("completed");
    expect(completed.challenge.compatibilityPct).toBe(result.compatibilityPct);
  });
});
