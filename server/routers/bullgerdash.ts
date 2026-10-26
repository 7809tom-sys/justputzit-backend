import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb, getGameRoom, getGameRoomPlayers, startGameRoom } from "../db";
import {
  bullgerdashPhotos,
  bullgerdashGames,
  bullgerdashRounds,
  bullgerdashGroupGames,
  bullgerdashGroupRounds,
  bullgerdashGroupVotes,
} from "../../drizzle/schema";
import { eq, and, sql, notInArray, inArray } from "drizzle-orm";

type BullPhoto = typeof bullgerdashPhotos.$inferSelect;
type BullGame  = typeof bullgerdashGames.$inferSelect;
type BullRound = typeof bullgerdashRounds.$inferSelect;
type GroupGame = typeof bullgerdashGroupGames.$inferSelect;
type GroupRound = typeof bullgerdashGroupRounds.$inferSelect;

// ─── Points config ────────────────────────────────────────────────────────────
const POINTS_STORYTELLER_FOOLED = 3;
const POINTS_VOTER_CORRECT = 2;

export const bullgerdashRouter = router({
  // ── Start or resume a game ──────────────────────────────────────────────────
  startGame: protectedProcedure
    .input(z.object({ matchId: z.number(), opponentId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Get or create active game
      let game: BullGame | undefined;
      const existing = await db
        .select().from(bullgerdashGames)
        .where(and(eq(bullgerdashGames.matchId, input.matchId), eq(bullgerdashGames.status, "active")))
        .limit(1);
      game = existing[0];

      if (!game) {
        const [ins] = await db
          .insert(bullgerdashGames)
          .values({ matchId: input.matchId, player1Id: ctx.user.id, player2Id: input.opponentId })
          .$returningId();
        const rows = await db.select().from(bullgerdashGames).where(eq(bullgerdashGames.id, (ins as { id: number }).id)).limit(1);
        game = rows[0]!;
      }

      // Check for existing round
      const activeRound = await db
        .select().from(bullgerdashRounds)
        .where(and(eq(bullgerdashRounds.gameId, game.id), eq(bullgerdashRounds.roundNumber, game.currentRound)))
        .limit(1);
      if (activeRound[0]) return { game, round: activeRound[0] };

      // Pick photo not yet used
      const usedRows = await db.select({ photoId: bullgerdashRounds.photoId }).from(bullgerdashRounds).where(eq(bullgerdashRounds.gameId, game.id));
      const usedIds = usedRows.map((r: { photoId: number }) => r.photoId);
      const available = usedIds.length > 0
        ? await db.select().from(bullgerdashPhotos).where(notInArray(bullgerdashPhotos.id, usedIds))
        : await db.select().from(bullgerdashPhotos);
      const pool = available.length > 0 ? available : await db.select().from(bullgerdashPhotos);
      if (pool.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "No photos in pool" });
      const photo = pool[Math.floor(Math.random() * pool.length)]!;

      // Alternate storyteller each round
      const isOddRound = game.currentRound % 2 === 1;
      const storytellerId = isOddRound ? game.player1Id : game.player2Id;

      const [newRound] = await db
        .insert(bullgerdashRounds)
        .values({ gameId: game.id, roundNumber: game.currentRound, storytellerId, photoId: photo.id, phase: "storyteller_writing" })
        .$returningId();
      const round = await db.select().from(bullgerdashRounds).where(eq(bullgerdashRounds.id, (newRound as { id: number }).id)).limit(1);
      return { game, round: round[0]! };
    }),

  // ── Get current game state ──────────────────────────────────────────────────
  getGame: protectedProcedure
    .input(z.object({ matchId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const games = await db.select().from(bullgerdashGames)
        .where(eq(bullgerdashGames.matchId, input.matchId))
        .orderBy(sql`created_at DESC`).limit(1);
      if (!games[0]) return null;
      const game = games[0];

      const rounds = await db.select().from(bullgerdashRounds)
        .where(and(eq(bullgerdashRounds.gameId, game.id), eq(bullgerdashRounds.roundNumber, game.currentRound)))
        .limit(1);
      if (!rounds[0]) return { game, round: null, photo: null };
      const round = rounds[0];

      const photos = await db.select().from(bullgerdashPhotos).where(eq(bullgerdashPhotos.id, round.photoId)).limit(1);
      const isStoryteller = round.storytellerId === ctx.user.id;
      const safePhoto = photos[0]
        ? { ...photos[0], truthCaption: isStoryteller || round.phase === "reveal" ? photos[0].truthCaption : null }
        : null;

      return { game, round, photo: safePhoto };
    }),

  // ── Storyteller submits caption ─────────────────────────────────────────────
  submitCaption: protectedProcedure
    .input(z.object({ gameId: z.number(), roundId: z.number(), caption: z.string().min(5).max(500), isLie: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const rows = await db.select().from(bullgerdashRounds).where(eq(bullgerdashRounds.id, input.roundId)).limit(1);
      if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND" });
      const round = rows[0];
      if (round.storytellerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only the storyteller can submit a caption" });
      if (round.phase !== "storyteller_writing") throw new TRPCError({ code: "BAD_REQUEST", message: "Caption already submitted" });

      await db.update(bullgerdashRounds)
        .set({ caption: input.caption, isLie: input.isLie, phase: "voter_guessing" })
        .where(eq(bullgerdashRounds.id, input.roundId));
      return { success: true };
    }),

  // ── Voter submits guess ─────────────────────────────────────────────────────
  submitVote: protectedProcedure
    .input(z.object({ gameId: z.number(), roundId: z.number(), guess: z.enum(["truth", "lie"]) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const roundRows = await db.select().from(bullgerdashRounds).where(eq(bullgerdashRounds.id, input.roundId)).limit(1);
      if (!roundRows[0]) throw new TRPCError({ code: "NOT_FOUND" });
      const round = roundRows[0];
      if (round.storytellerId === ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Storyteller cannot vote" });
      if (round.phase !== "voter_guessing") throw new TRPCError({ code: "BAD_REQUEST", message: "Not in voting phase" });

      const gameRows = await db.select().from(bullgerdashGames).where(eq(bullgerdashGames.id, input.gameId)).limit(1);
      if (!gameRows[0]) throw new TRPCError({ code: "NOT_FOUND" });
      const game = gameRows[0];

      // storyteller wins if voter guessed wrong
      const storytellerWon = round.isLie ? input.guess === "truth" : input.guess === "lie";
      const storytellerPoints = storytellerWon ? POINTS_STORYTELLER_FOOLED : 0;
      const voterPoints = storytellerWon ? 0 : POINTS_VOTER_CORRECT;

      await db.update(bullgerdashRounds)
        .set({ voterId: ctx.user.id, voterGuess: input.guess, storytellerPoints, voterPoints, phase: "reveal" })
        .where(eq(bullgerdashRounds.id, input.roundId));

      const isPlayer1Storyteller = round.storytellerId === game.player1Id;
      if (isPlayer1Storyteller) {
        await db.update(bullgerdashGames).set({
          player1Score: sql`player1_score + ${storytellerPoints}`,
          player2Score: sql`player2_score + ${voterPoints}`,
        }).where(eq(bullgerdashGames.id, input.gameId));
      } else {
        await db.update(bullgerdashGames).set({
          player1Score: sql`player1_score + ${voterPoints}`,
          player2Score: sql`player2_score + ${storytellerPoints}`,
        }).where(eq(bullgerdashGames.id, input.gameId));
      }

      return { storytellerWon, storytellerPoints, voterPoints };
    }),

  // ── Advance to next round ───────────────────────────────────────────────────
  nextRound: protectedProcedure
    .input(z.object({ gameId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const gameRows = await db.select().from(bullgerdashGames).where(eq(bullgerdashGames.id, input.gameId)).limit(1);
      if (!gameRows[0]) throw new TRPCError({ code: "NOT_FOUND" });
      const game = gameRows[0];

      const nextRoundNum = game.currentRound + 1;
      await db.update(bullgerdashGames).set({ currentRound: nextRoundNum }).where(eq(bullgerdashGames.id, input.gameId));

      // Pick unused photo
      const usedRows = await db.select({ photoId: bullgerdashRounds.photoId }).from(bullgerdashRounds).where(eq(bullgerdashRounds.gameId, input.gameId));
      const usedIds = usedRows.map((r: { photoId: number }) => r.photoId);
      const available = usedIds.length > 0
        ? await db.select().from(bullgerdashPhotos).where(notInArray(bullgerdashPhotos.id, usedIds))
        : await db.select().from(bullgerdashPhotos);
      const pool = available.length > 0 ? available : await db.select().from(bullgerdashPhotos);
      if (pool.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "No photos in pool" });
      const photo = pool[Math.floor(Math.random() * pool.length)]!;

      const isOddRound = nextRoundNum % 2 === 1;
      const storytellerId = isOddRound ? game.player1Id : game.player2Id;

      const [newRound] = await db
        .insert(bullgerdashRounds)
        .values({ gameId: input.gameId, roundNumber: nextRoundNum, storytellerId, photoId: photo.id, phase: "storyteller_writing" })
        .$returningId();
      const round = await db.select().from(bullgerdashRounds).where(eq(bullgerdashRounds.id, (newRound as { id: number }).id)).limit(1);
      return { round: round[0]! };
    }),

  // ── End the game ────────────────────────────────────────────────────────────
  endGame: protectedProcedure
    .input(z.object({ gameId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.update(bullgerdashGames).set({ status: "finished" }).where(eq(bullgerdashGames.id, input.gameId));
      return { success: true };
    }),

  // ── Get round history ───────────────────────────────────────────────────────
  getRoundHistory: protectedProcedure
    .input(z.object({ gameId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const rounds = await db.select().from(bullgerdashRounds)
        .where(eq(bullgerdashRounds.gameId, input.gameId))
        .orderBy(bullgerdashRounds.roundNumber);

      const photoIdSet = new Set<number>();
      rounds.forEach((r: BullRound) => photoIdSet.add(r.photoId));
      const photoIds = Array.from(photoIdSet);
      const photoRows: BullPhoto[] = photoIds.length > 0
        ? await db.select().from(bullgerdashPhotos).where(sql`id IN (${sql.join(photoIds.map((id: number) => sql`${id}`), sql`, `)})`)
        : [];
      const photoMap: Record<number, BullPhoto> = {};
      photoRows.forEach((p: BullPhoto) => { photoMap[p.id] = p; });

      return rounds.map((r: BullRound) => ({ ...r, photo: photoMap[r.photoId] ?? null }));
    }),

  // ── Group Game Lobby flow ───────────────────────────────────────────────────
  // This remains separate from the existing private match game above. A player
  // snapshot is taken at start so late room joins do not alter a round mid-vote.
  groupStart: protectedProcedure
    .input(z.object({ roomId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const room = await getGameRoom(input.roomId);
      if (!room || room.gameType !== "bullgerdash") throw new TRPCError({ code: "NOT_FOUND", message: "Bulger Dash room not found" });
      if (room.hostUserId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only the room host can start Bulger Dash" });
      const players = await getGameRoomPlayers(input.roomId);
      const playerIds = players.map((player) => player.userId);
      if (playerIds.length < 2) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "At least two players are needed to start Bulger Dash" });

      const existing = await db.select().from(bullgerdashGroupGames).where(eq(bullgerdashGroupGames.roomId, input.roomId)).limit(1);
      if (existing[0]) return buildGroupViewerPayload(db, existing[0], ctx.user.id);

      const [inserted] = await db.insert(bullgerdashGroupGames).values({
        roomId: input.roomId,
        hostUserId: ctx.user.id,
        playerIds,
        scores: Object.fromEntries(playerIds.map((playerId) => [String(playerId), 0])),
        status: "active",
      }).$returningId();
      const game = (await db.select().from(bullgerdashGroupGames).where(eq(bullgerdashGroupGames.id, (inserted as { id: number }).id)).limit(1))[0]!;
      await createGroupRound(db, game, playerIds);
      await startGameRoom(input.roomId);
      return buildGroupViewerPayload(db, game, ctx.user.id);
    }),

  groupGet: protectedProcedure
    .input(z.object({ roomId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const games = await db.select().from(bullgerdashGroupGames).where(eq(bullgerdashGroupGames.roomId, input.roomId)).limit(1);
      const game = games[0];
      if (!game) return null;
      if (!game.playerIds.includes(ctx.user.id)) throw new TRPCError({ code: "FORBIDDEN", message: "You were not part of this Bulger Dash game" });
      return buildGroupViewerPayload(db, game, ctx.user.id);
    }),

  groupSubmitCaption: protectedProcedure
    .input(z.object({ roomId: z.number().int().positive(), caption: z.string().trim().min(5).max(500), isLie: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const game = await getGroupGameForRoom(db, input.roomId);
      const round = await getCurrentGroupRound(db, game);
      if (round.storytellerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only the storyteller can submit a caption" });
      if (round.phase !== "storyteller_writing") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This caption has already been submitted" });
      await db.update(bullgerdashGroupRounds).set({ caption: input.caption, isLie: input.isLie, phase: "group_voting" }).where(eq(bullgerdashGroupRounds.id, round.id));
      return { success: true };
    }),

  groupSubmitVote: protectedProcedure
    .input(z.object({ roomId: z.number().int().positive(), guess: z.enum(["truth", "lie"]) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const game = await getGroupGameForRoom(db, input.roomId);
      const round = await getCurrentGroupRound(db, game);
      if (round.phase !== "group_voting") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Voting is not open" });
      if (round.storytellerId === ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "The storyteller cannot vote" });
      if (!round.participantIds.includes(ctx.user.id)) throw new TRPCError({ code: "FORBIDDEN", message: "You were not part of this round" });
      const existing = await db.select().from(bullgerdashGroupVotes).where(and(eq(bullgerdashGroupVotes.roundId, round.id), eq(bullgerdashGroupVotes.voterId, ctx.user.id))).limit(1);
      if (existing[0]) throw new TRPCError({ code: "CONFLICT", message: "You have already voted this round" });
      await db.insert(bullgerdashGroupVotes).values({ roundId: round.id, voterId: ctx.user.id, guess: input.guess });

      const votes = await db.select().from(bullgerdashGroupVotes).where(eq(bullgerdashGroupVotes.roundId, round.id));
      const eligibleVoterIds = round.participantIds.filter((playerId) => playerId !== round.storytellerId);
      if (votes.length < eligibleVoterIds.length) return { revealed: false, votesSubmitted: votes.length, requiredVotes: eligibleVoterIds.length };

      const scores = { ...game.scores };
      let storytellerPoints = 0;
      for (const vote of votes) {
        const correct = round.isLie ? vote.guess === "lie" : vote.guess === "truth";
        if (correct) scores[String(vote.voterId)] = (scores[String(vote.voterId)] ?? 0) + POINTS_VOTER_CORRECT;
        else storytellerPoints += POINTS_STORYTELLER_FOOLED;
      }
      scores[String(round.storytellerId)] = (scores[String(round.storytellerId)] ?? 0) + storytellerPoints;
      await db.update(bullgerdashGroupGames).set({ scores }).where(eq(bullgerdashGroupGames.id, game.id));
      await db.update(bullgerdashGroupRounds).set({ phase: "reveal" }).where(eq(bullgerdashGroupRounds.id, round.id));
      return { revealed: true, votesSubmitted: votes.length, requiredVotes: eligibleVoterIds.length };
    }),

  groupNextRound: protectedProcedure
    .input(z.object({ roomId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const game = await getGroupGameForRoom(db, input.roomId);
      if (game.hostUserId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only the room host can advance the round" });
      const currentRound = await getCurrentGroupRound(db, game);
      if (currentRound.phase !== "reveal") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Wait for the round reveal before advancing" });
      const nextRound = game.currentRound + 1;
      await db.update(bullgerdashGroupGames).set({ currentRound: nextRound }).where(eq(bullgerdashGroupGames.id, game.id));
      const refreshedGame = { ...game, currentRound: nextRound };
      await createGroupRound(db, refreshedGame, game.playerIds);
      return { success: true };
    }),

  groupEnd: protectedProcedure
    .input(z.object({ roomId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const game = await getGroupGameForRoom(db, input.roomId);
      if (game.hostUserId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only the room host can end the game" });
      await db.update(bullgerdashGroupGames).set({ status: "finished" }).where(eq(bullgerdashGroupGames.id, game.id));
      return { success: true };
    }),
});

async function getGroupGameForRoom(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, roomId: number) {
  const rows = await db.select().from(bullgerdashGroupGames).where(eq(bullgerdashGroupGames.roomId, roomId)).limit(1);
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Group Bulger Dash has not started yet" });
  return rows[0];
}

async function getCurrentGroupRound(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, game: GroupGame) {
  const rows = await db.select().from(bullgerdashGroupRounds)
    .where(and(eq(bullgerdashGroupRounds.groupGameId, game.id), eq(bullgerdashGroupRounds.roundNumber, game.currentRound)))
    .limit(1);
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Current group round not found" });
  return rows[0];
}

async function createGroupRound(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, game: Pick<GroupGame, "id" | "currentRound"> & { playerIds: number[] }, participantIds: number[]) {
  const usedRows = await db.select({ photoId: bullgerdashGroupRounds.photoId }).from(bullgerdashGroupRounds).where(eq(bullgerdashGroupRounds.groupGameId, game.id));
  const usedIds = usedRows.map((row) => row.photoId);
  const available = usedIds.length > 0 ? await db.select().from(bullgerdashPhotos).where(notInArray(bullgerdashPhotos.id, usedIds)) : await db.select().from(bullgerdashPhotos);
  const pool = available.length ? available : await db.select().from(bullgerdashPhotos);
  if (!pool.length) throw new TRPCError({ code: "NOT_FOUND", message: "No Bulger Dash photos are available" });
  const storytellerId = participantIds[(game.currentRound - 1) % participantIds.length]!;
  await db.insert(bullgerdashGroupRounds).values({
    groupGameId: game.id,
    roundNumber: game.currentRound,
    storytellerId,
    participantIds,
    photoId: pool[Math.floor(Math.random() * pool.length)]!.id,
  });
}

async function buildGroupViewerPayload(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, game: GroupGame, viewerId: number) {
  const round = await getCurrentGroupRound(db, game);
  const [photo] = await db.select().from(bullgerdashPhotos).where(eq(bullgerdashPhotos.id, round.photoId)).limit(1);
  const votes = await db.select().from(bullgerdashGroupVotes).where(eq(bullgerdashGroupVotes.roundId, round.id));
  const eligibleVoterIds = round.participantIds.filter((playerId) => playerId !== round.storytellerId);
  const myVote = votes.find((vote) => vote.voterId === viewerId)?.guess ?? null;
  const reveal = round.phase === "reveal";
  return {
    game: { id: game.id, roomId: game.roomId, hostUserId: game.hostUserId, playerIds: game.playerIds, scores: game.scores, currentRound: game.currentRound, status: game.status },
    round: { id: round.id, roundNumber: round.roundNumber, storytellerId: round.storytellerId, caption: round.caption, phase: round.phase, isLie: reveal ? round.isLie : null },
    photo: photo ? { id: photo.id, imageUrl: photo.imageUrl, truthCaption: reveal ? photo.truthCaption : null } : null,
    myVote,
    votesSubmitted: votes.length,
    requiredVotes: eligibleVoterIds.length,
    isStoryteller: round.storytellerId === viewerId,
  };
}
