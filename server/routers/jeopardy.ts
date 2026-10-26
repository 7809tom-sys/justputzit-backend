import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getDb, getJeopardyChatMessages, recordCompetitiveGameResults, sendJeopardyChatMessage } from "../db";
import { jeopardyRooms, jeopardyRoomPlayers, jeopardyAnswers, jeopardyQuestions, jeopardyCategories } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import { answeredJeopardyClueIds } from "../../shared/jeopardyAnswerPolicy";
import { isJeopardyAnswerCorrect } from "../../shared/jeopardyAnswerMatching";

// Generate a unique game code
function generateGameCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export const jeopardyRouter = router({
  // Get available categories
  getCategories: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(jeopardyCategories).orderBy(jeopardyCategories.id);
  }),

  // Create a new Jeopardy room
  createRoom: protectedProcedure
    .input(z.object({
      categoryIds: z.array(z.number()).min(1).max(5),
      maxPlayers: z.number().min(1).max(10).default(10),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const gameCode = generateGameCode();
      // Use raw SQL to avoid Drizzle json() type mishandling arrays
      await db.execute(
        sql`INSERT INTO jeopardy_rooms (gameCode, hostUserId, status, maxPlayers, categoryIds, currentClueIndex, clueOrder)
            VALUES (${gameCode}, ${ctx.user.id}, 'waiting', ${input.maxPlayers}, ${JSON.stringify(input.categoryIds)}, 0, '[]')`
      );

      // Get the created room
      const rooms = await db.select().from(jeopardyRooms).where(eq(jeopardyRooms.gameCode, gameCode)).limit(1);
      const roomId = rooms[0]?.id;

      if (!roomId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create room" });
      }

      // Host joins automatically
      await db.insert(jeopardyRoomPlayers).values({
        roomId,
        userId: ctx.user.id,
        score: 0,
        isReady: true,
      });

      return { gameCode, roomId };
    }),

  // Join an existing room
  joinRoom: protectedProcedure
    .input(z.object({ gameCode: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const rooms = await db.select().from(jeopardyRooms).where(eq(jeopardyRooms.gameCode, input.gameCode)).limit(1);
      const room = rooms[0];

      if (!room) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Game not found" });
      }

      if (room.status !== "waiting") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Game already started" });
      }

      // Check if user already in room
      const existing = await db.select().from(jeopardyRoomPlayers)
        .where(and(eq(jeopardyRoomPlayers.roomId, room.id), eq(jeopardyRoomPlayers.userId, ctx.user.id)))
        .limit(1);

      if (existing.length > 0) {
        return { success: true, roomId: room.id };
      }

      // Check player count
      const playerCount = await db.select().from(jeopardyRoomPlayers).where(eq(jeopardyRoomPlayers.roomId, room.id));

      if (playerCount.length >= room.maxPlayers) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Room is full" });
      }

      await db.insert(jeopardyRoomPlayers).values({
        roomId: room.id,
        userId: ctx.user.id,
        score: 0,
        isReady: false,
      });

      return { success: true, roomId: room.id };
    }),

  // Get room details
  getRoom: protectedProcedure
    .input(z.object({ roomId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const rooms = await db.select().from(jeopardyRooms).where(eq(jeopardyRooms.id, input.roomId)).limit(1);
      const room = rooms[0];

      if (!room) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
      }

      const players = await db.select().from(jeopardyRoomPlayers).where(eq(jeopardyRoomPlayers.roomId, room.id));

      // Get clues for the selected categories
      const categoryIds = room.categoryIds as number[];
      const clues = categoryIds.length > 0
        ? await db.select().from(jeopardyQuestions).where(
            sql`${jeopardyQuestions.categoryId} IN (${sql.join(categoryIds.map((id) => sql`${id}`), sql`, `)})`
          )
        : [];
      const answers = await db.select({ questionId: jeopardyAnswers.questionId })
        .from(jeopardyAnswers)
        .where(eq(jeopardyAnswers.roomId, room.id));
      const answeredClueIds = answeredJeopardyClueIds(answers);

      return {
        id: room.id,
        gameCode: room.gameCode,
        status: room.status,
        players: players.map((p) => ({ userId: p.userId, score: p.score, isReady: p.isReady })),
        clues: clues.map((c) => ({ id: c.id, categoryId: c.categoryId, clue: c.clue, value: c.value, answered: answeredClueIds.has(c.id) })),
        currentClueIndex: room.currentClueIndex,
      };
    }),

  // Select and reveal a clue
  selectClue: protectedProcedure
    .input(z.object({ roomId: z.number(), clueId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [room] = await db.select().from(jeopardyRooms).where(eq(jeopardyRooms.id, input.roomId)).limit(1);
      if (!room || room.status !== "in_progress") throw new TRPCError({ code: "BAD_REQUEST", message: "This game is not ready for a clue yet" });
      const [player] = await db.select().from(jeopardyRoomPlayers)
        .where(and(eq(jeopardyRoomPlayers.roomId, input.roomId), eq(jeopardyRoomPlayers.userId, ctx.user.id))).limit(1);
      if (!player) throw new TRPCError({ code: "FORBIDDEN", message: "Join this game before selecting a clue" });

      const clues = await db.select().from(jeopardyQuestions).where(eq(jeopardyQuestions.id, input.clueId)).limit(1);
      const clue = clues[0];

      if (!clue) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Clue not found" });
      }
      const categoryIds = room.categoryIds as number[];
      if (!categoryIds.includes(clue.categoryId)) throw new TRPCError({ code: "BAD_REQUEST", message: "That clue is not on this board" });
      const existingAnswer = await db.select({ id: jeopardyAnswers.id }).from(jeopardyAnswers)
        .where(and(eq(jeopardyAnswers.roomId, input.roomId), eq(jeopardyAnswers.questionId, input.clueId))).limit(1);
      if (existingAnswer.length > 0) throw new TRPCError({ code: "BAD_REQUEST", message: "That clue has already been answered" });

      return {
        clueId: clue.id,
        clue: clue.clue,
        value: clue.value,
        // Client will use TTS on this clue text
        ttsText: clue.clue,
      };
    }),

  // Submit an answer
  submitAnswer: protectedProcedure
    .input(z.object({
      roomId: z.number(),
      clueId: z.number(),
      answer: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [room] = await db.select().from(jeopardyRooms).where(eq(jeopardyRooms.id, input.roomId)).limit(1);
      if (!room || room.status !== "in_progress") throw new TRPCError({ code: "BAD_REQUEST", message: "This game is not accepting answers yet" });
      const [player] = await db.select().from(jeopardyRoomPlayers)
        .where(and(eq(jeopardyRoomPlayers.roomId, input.roomId), eq(jeopardyRoomPlayers.userId, ctx.user.id))).limit(1);
      if (!player) throw new TRPCError({ code: "FORBIDDEN", message: "Join this game before answering" });

      const clues = await db.select().from(jeopardyQuestions).where(eq(jeopardyQuestions.id, input.clueId)).limit(1);
      const clue = clues[0];

      if (!clue) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Clue not found" });
      }
      const categoryIds = room.categoryIds as number[];
      if (!categoryIds.includes(clue.categoryId)) throw new TRPCError({ code: "BAD_REQUEST", message: "That clue is not on this board" });
      const existingAnswer = await db.select({ id: jeopardyAnswers.id }).from(jeopardyAnswers)
        .where(and(eq(jeopardyAnswers.roomId, input.roomId), eq(jeopardyAnswers.questionId, input.clueId))).limit(1);
      if (existingAnswer.length > 0) throw new TRPCError({ code: "BAD_REQUEST", message: "That clue has already been answered" });

      // Accept standard Jeopardy phrasing such as “Who is Gene Sarazen?”
      const correctAns = clue.answer ?? "";
      const isCorrect = isJeopardyAnswerCorrect(input.answer, correctAns);
      const pointsAwarded = isCorrect ? (clue.value ?? 400) : 0;

      // A Unix timestamp in milliseconds exceeds a signed 32-bit integer. The
      // column is intentionally BIGINT so the persisted answer remains valid.
      try {
        await db.insert(jeopardyAnswers).values({
          roomId: input.roomId,
          userId: ctx.user.id,
          questionId: input.clueId,
          answer: input.answer,
          isCorrect,
          pointsAwarded,
          answeredAtMs: Date.now(),
        });
      } catch (error) {
        console.error("[Jeopardy] Failed to save answer", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "We couldn't save that answer. Please try again." });
      }

      // Update player score
      if (isCorrect) {
        if (player) {
          await db.update(jeopardyRoomPlayers)
            .set({ score: player.score + pointsAwarded })
            .where(eq(jeopardyRoomPlayers.id, player.id));
        }
      }

      return { isCorrect, pointsAwarded, correctAnswer: clue.answer };
    }),

  // Send chat message
  chat: protectedProcedure
    .input(z.object({ roomId: z.number(), message: z.string().trim().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [player] = await db.select().from(jeopardyRoomPlayers)
        .where(and(eq(jeopardyRoomPlayers.roomId, input.roomId), eq(jeopardyRoomPlayers.userId, ctx.user.id))).limit(1);
      if (!player) throw new TRPCError({ code: "FORBIDDEN", message: "Join this game before using its chat" });
      return sendJeopardyChatMessage(input.roomId, ctx.user.id, input.message);
    }),

  getChat: protectedProcedure
    .input(z.object({ roomId: z.number(), limit: z.number().min(1).max(100).optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [player] = await db.select().from(jeopardyRoomPlayers)
        .where(and(eq(jeopardyRoomPlayers.roomId, input.roomId), eq(jeopardyRoomPlayers.userId, ctx.user.id))).limit(1);
      if (!player) throw new TRPCError({ code: "FORBIDDEN", message: "Join this game before viewing its chat" });
      return getJeopardyChatMessages(input.roomId, input.limit ?? 50);
    }),

  // Get scoreboard
  getScoreboard: protectedProcedure
    .input(z.object({ roomId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const players = await db.select().from(jeopardyRoomPlayers).where(eq(jeopardyRoomPlayers.roomId, input.roomId));

      return {
        players: players
          .sort((a, b) => b.score - a.score)
          .map((p, idx) => ({
            rank: idx + 1,
            userId: p.userId,
            score: p.score,
          })),
      };
    }),

  // Get players with usernames and scores (for real-time scoreboard polling)
  getPlayers: protectedProcedure
    .input(z.object({ roomId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const rooms = await db.select().from(jeopardyRooms).where(eq(jeopardyRooms.id, input.roomId)).limit(1);
      const room = rooms[0];
      if (!room) throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });

      const players = await db.select().from(jeopardyRoomPlayers).where(eq(jeopardyRoomPlayers.roomId, input.roomId));

      // Fetch display names from user_profiles
      const { userProfiles } = await import("../../drizzle/schema");
      const { users } = await import("../../drizzle/schema");
      const playerDetails = await Promise.all(
        players.map(async (p) => {
          const profiles = await db.select({ displayName: userProfiles.displayName, avatarEmoji: userProfiles.avatarEmoji, avatarColor: userProfiles.avatarColor })
            .from(userProfiles).where(eq(userProfiles.userId, p.userId)).limit(1);
          const userRows = await db.select({ name: users.name }).from(users).where(eq(users.id, p.userId)).limit(1);
          const displayName = profiles[0]?.displayName ?? userRows[0]?.name ?? `Player ${p.userId}`;
          return {
            userId: p.userId,
            displayName,
            avatarEmoji: profiles[0]?.avatarEmoji ?? "🎮",
            avatarColor: profiles[0]?.avatarColor ?? "#6366f1",
            score: p.score,
            isReady: p.isReady,
            isHost: p.userId === room.hostUserId,
          };
        })
      );

      return {
        roomStatus: room.status,
        players: playerDetails.sort((a, b) => b.score - a.score),
      };
    }),

  // Start the game
  startGame: protectedProcedure
    .input(z.object({ roomId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const rooms = await db.select().from(jeopardyRooms).where(eq(jeopardyRooms.id, input.roomId)).limit(1);
      const room = rooms[0];

      if (!room) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
      }

      if (room.hostUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only host can start game" });
      }

      await db.update(jeopardyRooms)
        .set({ status: "in_progress", startedAt: new Date() })
        .where(eq(jeopardyRooms.id, room.id));

      return { success: true };
    }),

  // End the game
  endGame: protectedProcedure
    .input(z.object({ roomId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const rooms = await db.select().from(jeopardyRooms).where(eq(jeopardyRooms.id, input.roomId)).limit(1);
      const room = rooms[0];

      if (!room) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
      }

      if (room.hostUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only host can end game" });
      }

      await db.update(jeopardyRooms)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(jeopardyRooms.id, room.id));

      const players = await db.select({ userId: jeopardyRoomPlayers.userId, score: jeopardyRoomPlayers.score })
        .from(jeopardyRoomPlayers)
        .where(eq(jeopardyRoomPlayers.roomId, room.id));
      await recordCompetitiveGameResults("jeopardy", room.id, players);

      return { success: true };
    }),
});
