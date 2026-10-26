import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { gameRoomPlayers, gameRooms, users } from "../drizzle/schema";

const PLAYER_IDS = [990081, 990082] as const;
let roomId = 0;

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;
function contextFor(userId: number): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `team-builder-test-${userId}`,
    email: `team-builder-test-${userId}@example.com`,
    name: "Team Builder Test Member",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return { user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => {} } as unknown as TrpcContext["res"] };
}

describe("Team Builder cooperative room flow", () => {
  beforeAll(async () => {
    const db = await getDb();
    if (!db) return;
    for (const userId of PLAYER_IDS) {
      await db.insert(users).values({
        id: userId,
        openId: `team-builder-test-${userId}`,
        email: `team-builder-test-${userId}@example.com`,
        name: "Team Builder Test Member",
        loginMethod: "manus",
        role: "user",
      }).onDuplicateKeyUpdate({ set: { name: "Team Builder Test Member" } });
    }
    const [room] = await db.insert(gameRooms).values({
      hostUserId: PLAYER_IDS[0],
      name: "Team Builder test room",
      gameType: "team_builder",
      maxPlayers: 4,
      status: "in_progress",
      questions: [{ id: 1, text: "How should the group divide a small project?", optionA: "Pair up", optionB: "Split roles", optionC: "Plan together" }],
      answers: [],
    }).$returningId();
    roomId = (room as { id: number }).id;
    await db.insert(gameRoomPlayers).values(PLAYER_IDS.map((userId) => ({ roomId, userId })));
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    await db.delete(gameRoomPlayers).where(eq(gameRoomPlayers.roomId, roomId));
    await db.delete(gameRooms).where(eq(gameRooms.id, roomId));
    await db.delete(users).where(inArray(users.id, [...PLAYER_IDS]));
  });

  it("hides individual choices until everyone submits, awards consensus, and locks each member's choice", async () => {
    const host = appRouter.createCaller(contextFor(PLAYER_IDS[0]));
    const teammate = appRouter.createCaller(contextFor(PLAYER_IDS[1]));
    await host.gameLobby.submitAnswer({ roomId, questionIndex: 0, answer: "Split roles" });

    const waiting = await teammate.gameLobby.getRoom({ roomId });
    expect(waiting?.teamBuilder).toMatchObject({ submittedCount: 1, playerCount: 2, allSubmitted: false, consensusAnswer: null, groupScore: 0 });
    expect((waiting?.answers as Array<{ answer: string }>)[0]?.answer).toBe("");
    await expect(host.gameLobby.submitAnswer({ roomId, questionIndex: 0, answer: "Pair up" })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await teammate.gameLobby.submitAnswer({ roomId, questionIndex: 0, answer: "Split roles" });
    const resolved = await host.gameLobby.getRoom({ roomId });
    expect(resolved?.teamBuilder).toMatchObject({ submittedCount: 2, playerCount: 2, allSubmitted: true, consensusAnswer: "Split roles", groupScore: 10 });
    expect((resolved?.answers as Array<{ answer: string }>).every((answer) => answer.answer === "Split roles")).toBe(true);
  });
});
