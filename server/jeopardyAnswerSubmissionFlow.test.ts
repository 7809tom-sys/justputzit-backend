import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import {
  jeopardyAnswers,
  jeopardyQuestions,
  jeopardyRoomPlayers,
  jeopardyRooms,
  users,
} from "../drizzle/schema";

const USER_ID = 990071;
let roomId = 0;
let clueId = 0;

function contextFor(userId: number): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `jeopardy-answer-flow-${userId}`,
      email: `jeopardy-answer-flow-${userId}@example.com`,
      name: "Jeopardy Answer Test Member",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("Jeopardy answer submission flow", () => {
  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable for Jeopardy answer flow test");

    const [clue] = await db.select().from(jeopardyQuestions).limit(1);
    if (!clue) throw new Error("Jeopardy question seed is unavailable");
    clueId = clue.id;

    await db.insert(users).values({
      id: USER_ID,
      openId: `jeopardy-answer-flow-${USER_ID}`,
      email: `jeopardy-answer-flow-${USER_ID}@example.com`,
      name: "Jeopardy Answer Test Member",
      loginMethod: "manus",
      role: "user",
    }).onDuplicateKeyUpdate({ set: { name: "Jeopardy Answer Test Member" } });

    await db.delete(jeopardyAnswers).where(eq(jeopardyAnswers.userId, USER_ID));
    await db.delete(jeopardyRoomPlayers).where(eq(jeopardyRoomPlayers.userId, USER_ID));
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    await db.delete(jeopardyAnswers).where(eq(jeopardyAnswers.userId, USER_ID));
    await db.delete(jeopardyRoomPlayers).where(eq(jeopardyRoomPlayers.userId, USER_ID));
    if (roomId) await db.delete(jeopardyRooms).where(eq(jeopardyRooms.id, roomId));
    await db.delete(users).where(eq(users.id, USER_ID));
  });

  it("completes create, start, select, submit, result, and end-game transitions with a current timestamp", async () => {
    const caller = appRouter.createCaller(contextFor(USER_ID));
    const created = await caller.jeopardy.createRoom({ categoryIds: [1], maxPlayers: 1 });
    roomId = created.roomId;
    await caller.jeopardy.startGame({ roomId });
    const selected = await caller.jeopardy.selectClue({ roomId, clueId });
    expect(selected.clueId).toBe(clueId);
    const result = await caller.jeopardy.submitAnswer({
      roomId,
      clueId,
      answer: "A practice response",
    });

    expect(result).toHaveProperty("isCorrect");
    const db = await getDb();
    if (!db) throw new Error("Database unavailable for verification");
    const [saved] = await db.select().from(jeopardyAnswers)
      .where(eq(jeopardyAnswers.userId, USER_ID)).limit(1);

    expect(saved?.roomId).toBe(roomId);
    expect(saved?.questionId).toBe(clueId);
    expect(saved?.answeredAtMs).toBeGreaterThan(2_147_483_647);

    const room = await caller.jeopardy.getRoom({ roomId });
    expect(room.clues.find((clue) => clue.id === clueId)?.answered).toBe(true);
    await caller.jeopardy.endGame({ roomId });
    const players = await caller.jeopardy.getPlayers({ roomId });
    expect(players.roomStatus).toBe("completed");
  });
});
