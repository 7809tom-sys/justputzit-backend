import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import {
  bullgerdashGroupGames,
  bullgerdashGroupRounds,
  bullgerdashGroupVotes,
  bullgerdashPhotos,
  gameRoomPlayers,
  gameRooms,
  users,
} from "../drizzle/schema";

const PLAYER_IDS = [990071, 990072, 990073] as const;
let roomId = 0;
let photoId = 0;

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function contextFor(userId: number): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `bullgerdash-group-test-${userId}`,
    email: `bullgerdash-group-test-${userId}@example.com`,
    name: "Bulger Dash Group Test Member",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return { user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => {} } as unknown as TrpcContext["res"] };
}

describe("Bulger Dash group room flow", () => {
  beforeAll(async () => {
    const db = await getDb();
    if (!db) return;
    for (const userId of PLAYER_IDS) {
      await db.insert(users).values({
        id: userId,
        openId: `bullgerdash-group-test-${userId}`,
        email: `bullgerdash-group-test-${userId}@example.com`,
        name: "Bulger Dash Group Test Member",
        loginMethod: "manus",
        role: "user",
      }).onDuplicateKeyUpdate({ set: { name: "Bulger Dash Group Test Member" } });
    }
    const [photo] = await db.insert(bullgerdashPhotos).values({
      imageUrl: "https://example.com/bullgerdash-group-test.jpg",
      truthCaption: "A verified group-test photo caption.",
      category: "group-test",
    }).$returningId();
    photoId = (photo as { id: number }).id;
    const [room] = await db.insert(gameRooms).values({
      hostUserId: PLAYER_IDS[0],
      name: "Bulger Dash group test room",
      gameType: "bullgerdash",
      maxPlayers: 4,
      questions: [],
    }).$returningId();
    roomId = (room as { id: number }).id;
    await db.insert(gameRoomPlayers).values(PLAYER_IDS.map((userId) => ({ roomId, userId })));
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    const games = await db.select({ id: bullgerdashGroupGames.id }).from(bullgerdashGroupGames).where(eq(bullgerdashGroupGames.roomId, roomId));
    const gameIds = games.map((game) => game.id);
    if (gameIds.length) {
      const rounds = await db.select({ id: bullgerdashGroupRounds.id }).from(bullgerdashGroupRounds).where(inArray(bullgerdashGroupRounds.groupGameId, gameIds));
      const roundIds = rounds.map((round) => round.id);
      if (roundIds.length) await db.delete(bullgerdashGroupVotes).where(inArray(bullgerdashGroupVotes.roundId, roundIds));
      await db.delete(bullgerdashGroupRounds).where(inArray(bullgerdashGroupRounds.groupGameId, gameIds));
      await db.delete(bullgerdashGroupGames).where(inArray(bullgerdashGroupGames.id, gameIds));
    }
    await db.delete(gameRoomPlayers).where(eq(gameRoomPlayers.roomId, roomId));
    await db.delete(gameRooms).where(eq(gameRooms.id, roomId));
    await db.delete(bullgerdashPhotos).where(eq(bullgerdashPhotos.id, photoId));
    await db.delete(users).where(inArray(users.id, [...PLAYER_IDS]));
  });

  it("keeps group votes private until the full snapshot votes, then reveals and rotates storyteller", async () => {
    const host = appRouter.createCaller(contextFor(PLAYER_IDS[0]));
    const playerTwo = appRouter.createCaller(contextFor(PLAYER_IDS[1]));
    const playerThree = appRouter.createCaller(contextFor(PLAYER_IDS[2]));
    const started = await host.bullgerdash.groupStart({ roomId });

    expect(started.game.playerIds).toEqual([...PLAYER_IDS]);
    expect(started.round.storytellerId).toBe(PLAYER_IDS[0]);
    await host.bullgerdash.groupSubmitCaption({ roomId, caption: "This is the true story.", isLie: false });

    const waiting = await playerTwo.bullgerdash.groupGet({ roomId });
    expect(waiting?.round.isLie).toBeNull();
    expect(waiting?.photo?.truthCaption).toBeNull();
    expect(waiting).not.toHaveProperty("votes");

    const firstVote = await playerTwo.bullgerdash.groupSubmitVote({ roomId, guess: "truth" });
    expect(firstVote.revealed).toBe(false);
    const reveal = await playerThree.bullgerdash.groupSubmitVote({ roomId, guess: "truth" });
    expect(reveal.revealed).toBe(true);

    const revealed = await playerTwo.bullgerdash.groupGet({ roomId });
    expect(revealed?.round.isLie).toBe(false);
    expect(revealed?.photo?.truthCaption).toEqual(expect.any(String));
    expect(revealed?.photo?.truthCaption?.length).toBeGreaterThan(0);
    expect(revealed?.game.scores[String(PLAYER_IDS[1])]).toBe(2);
    expect(revealed?.game.scores[String(PLAYER_IDS[2])]).toBe(2);

    await host.bullgerdash.groupNextRound({ roomId });
    const roundTwo = await playerTwo.bullgerdash.groupGet({ roomId });
    expect(roundTwo?.round.roundNumber).toBe(2);
    expect(roundTwo?.round.storytellerId).toBe(PLAYER_IDS[1]);
  });
});
