import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { users, wouldYouRatherAnswers } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// Use a high, unlikely-to-collide test user id and clean up after.
const TEST_USER_ID = 990001;

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function ctxFor(userId: number): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `wyr-test-${userId}`,
    email: `wyr-test-${userId}@example.com`,
    name: "WYR Test User",
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

describe("Would You Rather game", () => {
  beforeAll(async () => {
    const db = await getDb();
    if (!db) return;
    // Ensure a real user row exists so foreign-keyish assumptions hold.
    await db.insert(users).values({
      id: TEST_USER_ID,
      openId: `wyr-test-${TEST_USER_ID}`,
      email: `wyr-test-${TEST_USER_ID}@example.com`,
      name: "WYR Test User",
      loginMethod: "manus",
      role: "user",
    }).onDuplicateKeyUpdate({ set: { name: "WYR Test User" } });
    await db.delete(wouldYouRatherAnswers).where(eq(wouldYouRatherAnswers.userId, TEST_USER_ID));
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    await db.delete(wouldYouRatherAnswers).where(eq(wouldYouRatherAnswers.userId, TEST_USER_ID));
    await db.delete(users).where(eq(users.id, TEST_USER_ID));
  });

  it("returns a batch of seeded questions", async () => {
    const caller = appRouter.createCaller(ctxFor(TEST_USER_ID));
    const batch = await caller.wyr.getBatch({ category: "all", limit: 5 });
    expect(batch.totalAvailable).toBeGreaterThan(0);
    expect(batch.questions.length).toBeGreaterThan(0);
    expect(batch.questions[0]).toHaveProperty("optionA");
    expect(batch.questions[0]).toHaveProperty("optionB");
  });

  it("records an answer and returns an honest crowd split", async () => {
    const caller = appRouter.createCaller(ctxFor(TEST_USER_ID));
    const batch = await caller.wyr.getBatch({ category: "all", limit: 1 });
    const q = batch.questions[0];
    expect(q).toBeTruthy();

    const res = await caller.wyr.answer({ questionId: q!.id, choice: "A" });
    expect(res.yourChoice).toBe("A");
    expect(res.totalVotes).toBeGreaterThanOrEqual(1);
    // percentages must sum to ~100 when there are votes
    expect(res.percentA + res.percentB).toBeGreaterThanOrEqual(99);
  });

  it("does not return an already-answered question in the next batch", async () => {
    const caller = appRouter.createCaller(ctxFor(TEST_USER_ID));
    const first = await caller.wyr.getBatch({ category: "all", limit: 1 });
    const q = first.questions[0];
    await caller.wyr.answer({ questionId: q!.id, choice: "B" });

    const after = await caller.wyr.getBatch({ category: "all", limit: 30 });
    const ids = after.questions.map((x) => x.id);
    expect(ids).not.toContain(q!.id);
  });

  it("overwrites a previous answer instead of duplicating it", async () => {
    const caller = appRouter.createCaller(ctxFor(TEST_USER_ID));
    const batch = await caller.wyr.getBatch({ category: "all", limit: 1 });
    const q = batch.questions[0];

    await caller.wyr.answer({ questionId: q!.id, choice: "A" });
    await caller.wyr.answer({ questionId: q!.id, choice: "B" });

    const db = await getDb();
    if (!db) return;
    const rows = await db
      .select()
      .from(wouldYouRatherAnswers)
      .where(eq(wouldYouRatherAnswers.userId, TEST_USER_ID));
    const forQ = rows.filter((r) => r.questionId === q!.id);
    expect(forQ).toHaveLength(1);
    expect(forQ[0]?.choice).toBe("B");
  });

  it("reports the user's total answered count", async () => {
    const caller = appRouter.createCaller(ctxFor(TEST_USER_ID));
    const stats = await caller.wyr.stats();
    expect(stats.answered).toBeGreaterThan(0);
  });
});
