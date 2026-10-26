import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getDb, getTriviaPursuitChatMessages, recordCompetitiveGameResults, sendTriviaPursuitChatMessage } from "../db";
import { triviaPursuitRooms, triviaPursuitRoomPlayers, triviaPursuitAnswers, triviaPursuitQuestions } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

// Generate a unique game code
function generateGameCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export const triviaPursuitRouter = router({
  // Create a new Trivia Pursuit room
  createRoom: protectedProcedure
    .input(z.object({
      categoryIds: z.array(z.number()).min(1).max(5),
      maxPlayers: z.number().min(1).max(10).default(10),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const gameCode = generateGameCode();
      // Use sql`` to pass JSON as a raw string — Drizzle's json() type can mishandle arrays
      await db.execute(
        sql`INSERT INTO trivia_pursuit_rooms (gameCode, hostUserId, status, maxPlayers, categoryIds, currentQuestionIndex, questionIds)
            VALUES (${gameCode}, ${ctx.user.id}, 'waiting', ${input.maxPlayers}, ${JSON.stringify(input.categoryIds)}, 0, '[]')`
      );

      // Get the created room
      const rooms = await db.select().from(triviaPursuitRooms).where(eq(triviaPursuitRooms.gameCode, gameCode)).limit(1);
      const roomId = rooms[0]?.id;

      if (!roomId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create room" });
      }

      // Host joins automatically
      await db.insert(triviaPursuitRoomPlayers).values({
        roomId,
        userId: ctx.user.id,
        score: 0,
        correctAnswers: 0,
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

      const rooms = await db.select().from(triviaPursuitRooms).where(eq(triviaPursuitRooms.gameCode, input.gameCode)).limit(1);
      const room = rooms[0];

      if (!room) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Game not found" });
      }

      if (room.status !== "waiting") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Game already started" });
      }

      // Check if user already in room
      const existing = await db.select().from(triviaPursuitRoomPlayers)
        .where(and(eq(triviaPursuitRoomPlayers.roomId, room.id), eq(triviaPursuitRoomPlayers.userId, ctx.user.id)))
        .limit(1);

      if (existing.length > 0) {
        return { success: true, roomId: room.id };
      }

      // Check player count
      const playerCount = await db.select().from(triviaPursuitRoomPlayers).where(eq(triviaPursuitRoomPlayers.roomId, room.id));

      if (playerCount.length >= room.maxPlayers) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Room is full" });
      }

      await db.insert(triviaPursuitRoomPlayers).values({
        roomId: room.id,
        userId: ctx.user.id,
        score: 0,
        correctAnswers: 0,
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

      const rooms = await db.select().from(triviaPursuitRooms).where(eq(triviaPursuitRooms.id, input.roomId)).limit(1);
      const room = rooms[0];

      if (!room) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
      }

      const players = await db.select().from(triviaPursuitRoomPlayers).where(eq(triviaPursuitRoomPlayers.roomId, room.id));

      // Get questions for the selected categories
      const categoryIds = room.categoryIds as number[];
      const questions = categoryIds.length > 0
        ? await db.select().from(triviaPursuitQuestions).where(
            sql`${triviaPursuitQuestions.categoryId} IN (${sql.join(categoryIds.map((id) => sql`${id}`), sql`, `)})`
          )
        : [];

      return {
        id: room.id,
        gameCode: room.gameCode,
        status: room.status,
        players: players.map((p) => ({ userId: p.userId, score: p.score, correctAnswers: p.correctAnswers, isReady: p.isReady })),
        questions: questions.map((q) => ({ id: q.id, categoryId: q.categoryId, question: q.clue ?? "", answered: false })),
        currentQuestionIndex: room.currentQuestionIndex,
      };
    }),

  // Get next question
  nextQuestion: protectedProcedure
    .input(z.object({ roomId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const rooms = await db.select().from(triviaPursuitRooms).where(eq(triviaPursuitRooms.id, input.roomId)).limit(1);
      const room = rooms[0];

      if (!room) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
      }

      // Get questions for the selected categories
      const categoryIds = room.categoryIds as number[];
      const questions = categoryIds.length > 0
        ? await db.select().from(triviaPursuitQuestions).where(
            sql`${triviaPursuitQuestions.categoryId} IN (${sql.join(categoryIds.map((id) => sql`${id}`), sql`, `)})`
          )
        : [];

      if (room.hostUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the host can move to the next question" });
      }
      const servedQuestionIds = (room.questionIds ?? []) as number[];
      const question = questions.find((candidate) => !servedQuestionIds.includes(candidate.id));
      if (!question) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No more questions" });
      }

      // Update room
      await db.update(triviaPursuitRooms)
        .set({ currentQuestionIndex: room.currentQuestionIndex + 1, questionIds: [...servedQuestionIds, question.id] })
        .where(eq(triviaPursuitRooms.id, room.id));

      return {
        questionId: question.id,
        question: question.clue ?? "",
        optionA: question.optionA ?? "",
        optionB: question.optionB ?? "",
        optionC: question.optionC ?? "",
        optionD: question.optionD ?? "",
        // Client will use TTS on this question text
        ttsText: question.clue ?? "",
      };
    }),

  // Submit an answer
  submitAnswer: protectedProcedure
    .input(z.object({
      roomId: z.number(),
      questionId: z.number(),
      answer: z.enum(["A", "B", "C", "D"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const questions = await db.select().from(triviaPursuitQuestions).where(eq(triviaPursuitQuestions.id, input.questionId)).limit(1);
      const question = questions[0];

      if (!question) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Question not found" });
      }

      const [player] = await db.select().from(triviaPursuitRoomPlayers)
        .where(and(eq(triviaPursuitRoomPlayers.roomId, input.roomId), eq(triviaPursuitRoomPlayers.userId, ctx.user.id))).limit(1);
      if (!player) throw new TRPCError({ code: "FORBIDDEN", message: "Join this game before answering" });
      const priorAnswers = await db.select().from(triviaPursuitAnswers)
        .where(and(eq(triviaPursuitAnswers.roomId, input.roomId), eq(triviaPursuitAnswers.userId, ctx.user.id), eq(triviaPursuitAnswers.questionId, input.questionId))).limit(1);
      if (priorAnswers.length > 0) throw new TRPCError({ code: "BAD_REQUEST", message: "You already answered this question" });

      const isCorrect = input.answer === (question.correctAnswer ?? "");
      const pointsAwarded = isCorrect ? 100 : 0;

      // Save answer — use raw SQL to match actual DB column names (selectedAnswer, answeredAt)
      await db.execute(
        sql`INSERT INTO trivia_pursuit_answers (roomId, userId, questionId, selectedAnswer, isCorrect, answeredAt)
            VALUES (${input.roomId}, ${ctx.user.id}, ${input.questionId}, ${input.answer}, ${isCorrect ? 1 : 0}, NOW())`
      );

      // Update player score
      if (isCorrect) {
        await db.update(triviaPursuitRoomPlayers)
          .set({ score: player.score + pointsAwarded, correctAnswers: player.correctAnswers + 1 })
          .where(eq(triviaPursuitRoomPlayers.id, player.id));
      }

      return { isCorrect, pointsAwarded, correctAnswer: question.correctAnswer ?? null };
    }),

  // Send chat message
  chat: protectedProcedure
    .input(z.object({ roomId: z.number(), message: z.string().trim().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [player] = await db.select().from(triviaPursuitRoomPlayers)
        .where(and(eq(triviaPursuitRoomPlayers.roomId, input.roomId), eq(triviaPursuitRoomPlayers.userId, ctx.user.id))).limit(1);
      if (!player) throw new TRPCError({ code: "FORBIDDEN", message: "Join this game before using its chat" });
      return sendTriviaPursuitChatMessage(input.roomId, ctx.user.id, input.message);
    }),

  getChat: protectedProcedure
    .input(z.object({ roomId: z.number(), limit: z.number().min(1).max(100).optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [player] = await db.select().from(triviaPursuitRoomPlayers)
        .where(and(eq(triviaPursuitRoomPlayers.roomId, input.roomId), eq(triviaPursuitRoomPlayers.userId, ctx.user.id))).limit(1);
      if (!player) throw new TRPCError({ code: "FORBIDDEN", message: "Join this game before viewing its chat" });
      return getTriviaPursuitChatMessages(input.roomId, input.limit ?? 50);
    }),

  // Get scoreboard
  getScoreboard: protectedProcedure
    .input(z.object({ roomId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const players = await db.select().from(triviaPursuitRoomPlayers).where(eq(triviaPursuitRoomPlayers.roomId, input.roomId));

      return {
        players: players
          .sort((a, b) => b.score - a.score)
          .map((p, idx) => ({
            rank: idx + 1,
            userId: p.userId,
            score: p.score,
            correctAnswers: p.correctAnswers,
          })),
      };
    }),

  // Get players with usernames and scores (for real-time scoreboard polling)
  getPlayers: protectedProcedure
    .input(z.object({ roomId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const rooms = await db.select().from(triviaPursuitRooms).where(eq(triviaPursuitRooms.id, input.roomId)).limit(1);
      const room = rooms[0];
      if (!room) throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });

      const players = await db.select().from(triviaPursuitRoomPlayers).where(eq(triviaPursuitRoomPlayers.roomId, input.roomId));

      const { userProfiles, users } = await import("../../drizzle/schema");
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
            correctAnswers: p.correctAnswers,
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

      const rooms = await db.select().from(triviaPursuitRooms).where(eq(triviaPursuitRooms.id, input.roomId)).limit(1);
      const room = rooms[0];

      if (!room) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
      }

      if (room.hostUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only host can start game" });
      }

      await db.update(triviaPursuitRooms)
        .set({ status: "in_progress", startedAt: new Date() })
        .where(eq(triviaPursuitRooms.id, room.id));

      return { success: true };
    }),

  // End the game
  endGame: protectedProcedure
    .input(z.object({ roomId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const rooms = await db.select().from(triviaPursuitRooms).where(eq(triviaPursuitRooms.id, input.roomId)).limit(1);
      const room = rooms[0];

      if (!room) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
      }

      if (room.hostUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only host can end game" });
      }

      await db.update(triviaPursuitRooms)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(triviaPursuitRooms.id, room.id));

      const players = await db.select({ userId: triviaPursuitRoomPlayers.userId, score: triviaPursuitRoomPlayers.score })
        .from(triviaPursuitRoomPlayers)
        .where(eq(triviaPursuitRoomPlayers.roomId, room.id));
      await recordCompetitiveGameResults("trivia_pursuit", room.id, players);

      return { success: true };
    }),
});
