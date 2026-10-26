import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  watchPartyRooms,
  watchPartyPlayers,
  watchPartyChat,
  watchPartyTrivia,
  watchPartyTriviaAnswers,
  sportsTriviaPool,
} from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export const watchPartyRouter = router({
  // Create a watch party room
  createRoom: protectedProcedure
    .input(
      z.object({
        title: z.string().min(3).max(200),
        teamHome: z.string().min(1).max(100),
        teamAway: z.string().min(1).max(100),
        sport: z.enum(["nfl", "nba", "mlb", "nhl", "local"]).default("nfl"),
        gameTime: z.string().optional(), // ISO string
        isLocal: z.boolean().default(false),
        maxPlayers: z.number().min(2).max(200).default(50),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const gameCode = generateCode();
      const [result] = await db.execute(
        sql`INSERT INTO watch_party_rooms (host_id, game_code, title, team_home, team_away, sport, game_time, status, max_players, is_local)
            VALUES (${ctx.user.id}, ${gameCode}, ${input.title}, ${input.teamHome}, ${input.teamAway}, ${input.sport},
                    ${input.gameTime ? new Date(input.gameTime) : null}, 'live', ${input.maxPlayers}, ${input.isLocal})`
      ) as unknown as [{ insertId: number }];

      const roomId = (result as unknown as { insertId: number }).insertId;

      // Auto-join as host
      await db.execute(
        sql`INSERT INTO watch_party_players (room_id, user_id) VALUES (${roomId}, ${ctx.user.id})`
      );

      return { roomId, gameCode };
    }),

  // Join a watch party room by code
  joinRoom: protectedProcedure
    .input(z.object({ gameCode: z.string().min(4).max(10) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const rooms = await db
        .select()
        .from(watchPartyRooms)
        .where(eq(watchPartyRooms.gameCode, input.gameCode.toUpperCase()))
        .limit(1);

      if (!rooms.length) throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
      const room = rooms[0];
      if (room.status === "ended") throw new TRPCError({ code: "BAD_REQUEST", message: "This watch party has ended" });

      // Check if already joined
      const existing = await db
        .select()
        .from(watchPartyPlayers)
        .where(and(eq(watchPartyPlayers.roomId, room.id), eq(watchPartyPlayers.userId, ctx.user.id)))
        .limit(1);

      if (!existing.length) {
        await db.execute(
          sql`INSERT INTO watch_party_players (room_id, user_id) VALUES (${room.id}, ${ctx.user.id})`
        );
      }

      return { roomId: room.id, title: room.title, teamHome: room.teamHome, teamAway: room.teamAway, sport: room.sport };
    }),

  // Get room info + players
  getRoom: protectedProcedure
    .input(z.object({ roomId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const rooms = await db.select().from(watchPartyRooms).where(eq(watchPartyRooms.id, input.roomId)).limit(1);
      if (!rooms.length) throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });

      const room = rooms[0];

      // Get players with user info
      const playersRaw = await db.execute(
        sql`SELECT wp.user_id, wp.score, wp.correct_answers, wp.is_mvp, wp.joined_at,
                   u.name as display_name, u.avatar_emoji, u.avatar_color
            FROM watch_party_players wp
            JOIN users u ON u.id = wp.user_id
            WHERE wp.room_id = ${input.roomId}
            ORDER BY wp.score DESC`
      ) as unknown as Array<{
        user_id: number; score: number; correct_answers: number; is_mvp: boolean;
        joined_at: Date; display_name: string; avatar_emoji: string; avatar_color: string;
      }>;

      const players = (playersRaw as unknown as typeof playersRaw).map((p) => ({
        userId: p.user_id,
        displayName: p.display_name || "Fan",
        avatarEmoji: p.avatar_emoji || "🏈",
        avatarColor: p.avatar_color || "#ea580c",
        score: p.score,
        correctAnswers: p.correct_answers,
        isMvp: p.is_mvp,
        isHost: p.user_id === room.hostId,
      }));

      return { room, players, isHost: room.hostId === ctx.user.id };
    }),

  // Get chat messages (last 50)
  getChat: protectedProcedure
    .input(z.object({ roomId: z.number(), since: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const rows = await db.execute(
        sql`SELECT wc.id, wc.user_id, wc.message, wc.created_at,
                   u.name as display_name, u.avatar_emoji, u.avatar_color,
                   wpp.team_flair
            FROM watch_party_chat wc
            JOIN users u ON u.id = wc.user_id
            LEFT JOIN watch_party_players wpp ON wpp.room_id = wc.room_id AND wpp.user_id = wc.user_id
            WHERE wc.room_id = ${input.roomId}
              ${input.since ? sql`AND wc.id > ${input.since}` : sql``}
            ORDER BY wc.created_at ASC
            LIMIT 100`
      ) as unknown as Array<{
        id: number; user_id: number; message: string; created_at: Date;
        display_name: string; avatar_emoji: string; avatar_color: string;
        team_flair: string | null;
      }>;

      return {
        messages: (rows as unknown as typeof rows).map((r) => ({
          id: r.id,
          userId: r.user_id,
          displayName: r.display_name || "Fan",
          avatarEmoji: r.avatar_emoji || "🏈",
          avatarColor: r.avatar_color || "#ea580c",
          message: r.message,
          createdAt: r.created_at,
          teamFlair: r.team_flair ?? null,
        })),
      };
    }),

  // Send chat message
  sendChat: protectedProcedure
    .input(z.object({ roomId: z.number(), message: z.string().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      await db.execute(
        sql`INSERT INTO watch_party_chat (room_id, user_id, message) VALUES (${input.roomId}, ${ctx.user.id}, ${input.message})`
      );

      return { ok: true };
    }),

  // Host launches a trivia question (from pool or custom)
  launchTrivia: protectedProcedure
    .input(
      z.object({
        roomId: z.number(),
        questionText: z.string().min(5),
        optionA: z.string().min(1),
        optionB: z.string().min(1),
        optionC: z.string().min(1),
        optionD: z.string().min(1),
        correctAnswer: z.enum(["A", "B", "C", "D"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Verify host
      const rooms = await db.select().from(watchPartyRooms).where(eq(watchPartyRooms.id, input.roomId)).limit(1);
      if (!rooms.length || rooms[0].hostId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the host can launch trivia" });
      }

      // Deactivate previous active question
      await db.execute(sql`UPDATE watch_party_trivia SET is_active = false WHERE room_id = ${input.roomId} AND is_active = true`);

      // Insert new question
      const [res] = await db.execute(
        sql`INSERT INTO watch_party_trivia (room_id, question_text, option_a, option_b, option_c, option_d, correct_answer, is_active)
            VALUES (${input.roomId}, ${input.questionText}, ${input.optionA}, ${input.optionB}, ${input.optionC}, ${input.optionD}, ${input.correctAnswer}, true)`
      ) as unknown as [{ insertId: number }];

      return { triviaId: (res as unknown as { insertId: number }).insertId };
    }),

  // Get active trivia question for a room
  getActiveTrivia: protectedProcedure
    .input(z.object({ roomId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const questions = await db
        .select()
        .from(watchPartyTrivia)
        .where(and(eq(watchPartyTrivia.roomId, input.roomId), eq(watchPartyTrivia.isActive, true)))
        .limit(1);

      if (!questions.length) return { question: null };

      const q = questions[0];

      // Check if current user already answered
      const answered = await db
        .select()
        .from(watchPartyTriviaAnswers)
        .where(and(eq(watchPartyTriviaAnswers.triviaId, q.id), eq(watchPartyTriviaAnswers.userId, ctx.user.id)))
        .limit(1);

      return {
        question: {
          id: q.id,
          questionText: q.questionText,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          launchedAt: q.launchedAt,
        },
        alreadyAnswered: answered.length > 0,
        myAnswer: answered.length > 0 ? answered[0].answer : null,
      };
    }),

  // Submit answer to active trivia
  submitTriviaAnswer: protectedProcedure
    .input(z.object({ roomId: z.number(), triviaId: z.number(), answer: z.enum(["A", "B", "C", "D"]) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const questions = await db.select().from(watchPartyTrivia).where(eq(watchPartyTrivia.id, input.triviaId)).limit(1);
      if (!questions.length) throw new TRPCError({ code: "NOT_FOUND", message: "Question not found" });

      const q = questions[0];
      const isCorrect = q.correctAnswer === input.answer;
      const points = isCorrect ? 10 : 0;

      await db.execute(
        sql`INSERT INTO watch_party_trivia_answers (trivia_id, room_id, user_id, answer, is_correct)
            VALUES (${input.triviaId}, ${input.roomId}, ${ctx.user.id}, ${input.answer}, ${isCorrect})`
      );

      if (isCorrect) {
        await db.execute(
          sql`UPDATE watch_party_players SET score = score + ${points}, correct_answers = correct_answers + 1
              WHERE room_id = ${input.roomId} AND user_id = ${ctx.user.id}`
        );
      }

      return { isCorrect, correctAnswer: q.correctAnswer, pointsAwarded: points };
    }),

  // Get leaderboard for a room
  getLeaderboard: protectedProcedure
    .input(z.object({ roomId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const rows = await db.execute(
        sql`SELECT wp.user_id, wp.score, wp.correct_answers, wp.is_mvp,
                   u.name as display_name, u.avatar_emoji, u.avatar_color
            FROM watch_party_players wp
            JOIN users u ON u.id = wp.user_id
            WHERE wp.room_id = ${input.roomId}
            ORDER BY wp.score DESC
            LIMIT 20`
      ) as unknown as Array<{
        user_id: number; score: number; correct_answers: number; is_mvp: boolean;
        display_name: string; avatar_emoji: string; avatar_color: string;
      }>;

      return {
        players: (rows as unknown as typeof rows).map((r, idx) => ({
          rank: idx + 1,
          userId: r.user_id,
          displayName: r.display_name || "Fan",
          avatarEmoji: r.avatar_emoji || "🏈",
          avatarColor: r.avatar_color || "#ea580c",
          score: r.score,
          correctAnswers: r.correct_answers,
          isMvp: r.is_mvp,
        })),
      };
    }),

  // Get a random trivia question from the pool for a team
  getPoolQuestion: protectedProcedure
    .input(z.object({ team: z.string(), sport: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const rows = await db.execute(
        sql`SELECT * FROM sports_trivia_pool
            WHERE team = ${input.team}
            ORDER BY RAND()
            LIMIT 1`
      ) as unknown as Array<{
        id: number; team: string; sport: string; question_text: string;
        option_a: string; option_b: string; option_c: string; option_d: string;
        correct_answer: string; difficulty: string;
      }>;

      if (!(rows as unknown as typeof rows).length) return { question: null };
      const q = (rows as unknown as typeof rows)[0];

      return {
        question: {
          id: q.id,
          questionText: q.question_text,
          optionA: q.option_a,
          optionB: q.option_b,
          optionC: q.option_c,
          optionD: q.option_d,
          correctAnswer: q.correct_answer,
          difficulty: q.difficulty,
        },
      };
    }),

  // List all active/recent rooms
  listRooms: publicProcedure
    .input(z.object({ sport: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const rows = await db.execute(
        sql`SELECT r.*, 
                   (SELECT COUNT(*) FROM watch_party_players WHERE room_id = r.id) as player_count,
                   u.name as host_name
            FROM watch_party_rooms r
            JOIN users u ON u.id = r.host_id
            WHERE r.status != 'ended'
              ${input.sport ? sql`AND r.sport = ${input.sport}` : sql``}
            ORDER BY r.created_at DESC
            LIMIT 30`
      ) as unknown as Array<{
        id: number; game_code: string; title: string; team_home: string; team_away: string;
        sport: string; game_time: Date | null; status: string; player_count: number; host_name: string;
      }>;

      return {
        rooms: (rows as unknown as typeof rows).map((r) => ({
          id: r.id,
          gameCode: r.game_code,
          title: r.title,
          teamHome: r.team_home,
          teamAway: r.team_away,
          sport: r.sport,
          gameTime: r.game_time,
          status: r.status,
          playerCount: Number(r.player_count),
          hostName: r.host_name,
        })),
      };
    }),

  // End a room (host only)
  endRoom: protectedProcedure
    .input(z.object({ roomId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const rooms = await db.select().from(watchPartyRooms).where(eq(watchPartyRooms.id, input.roomId)).limit(1);
      if (!rooms.length || rooms[0].hostId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the host can end the room" });
      }

      // Crown MVP
      await db.execute(
        sql`UPDATE watch_party_players SET is_mvp = true
            WHERE room_id = ${input.roomId}
            ORDER BY score DESC LIMIT 1`
      );

      await db.execute(sql`UPDATE watch_party_rooms SET status = 'ended' WHERE id = ${input.roomId}`);

      return { ok: true };
    }),

  // Find an existing room for a specific game today, or create one automatically
  findOrCreateGameRoom: protectedProcedure
    .input(z.object({
      teamHome: z.string().min(1).max(100),
      teamAway: z.string().min(1).max(100),
      sport: z.enum(["nfl", "nba", "mlb", "nhl", "local"]),
      gameTitle: z.string().min(1).max(200),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Look for an active room for this exact matchup today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const existing = await db.execute(
        sql`SELECT id, game_code FROM watch_party_rooms
            WHERE team_home = ${input.teamHome}
              AND team_away = ${input.teamAway}
              AND sport = ${input.sport}
              AND status != 'ended'
              AND created_at >= ${today}
            ORDER BY id ASC LIMIT 1`
      ) as unknown as [Array<{ id: number; game_code: string }>];

      const rows = existing[0] as Array<{ id: number; game_code: string }>;

      if (rows && rows.length > 0) {
        const room = rows[0];
        // Auto-join if not already in
        await db.execute(
          sql`INSERT IGNORE INTO watch_party_players (room_id, user_id) VALUES (${room.id}, ${ctx.user.id})`
        );
        return { roomId: room.id, gameCode: room.game_code, created: false };
      }

      // Create a new room
      const gameCode = generateCode();
      const [result] = await db.execute(
        sql`INSERT INTO watch_party_rooms (host_id, game_code, title, team_home, team_away, sport, game_time, status, max_players, is_local)
            VALUES (${ctx.user.id}, ${gameCode}, ${input.gameTitle}, ${input.teamHome}, ${input.teamAway}, ${input.sport},
                    NULL, 'live', 200, false)`
      ) as unknown as [{ insertId: number }];
      const roomId = (result as unknown as { insertId: number }).insertId;
      await db.execute(
        sql`INSERT INTO watch_party_players (room_id, user_id) VALUES (${roomId}, ${ctx.user.id})`
      );
      return { roomId, gameCode, created: true };
    }),

  // Get the fan count for a specific game (no auth required)
  getGameFanCount: publicProcedure
    .input(z.object({
      teamHome: z.string(),
      teamAway: z.string(),
      sport: z.string(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { count: 0 };
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const rows = await db.execute(
        sql`SELECT COUNT(DISTINCT wp.user_id) as fan_count
            FROM watch_party_rooms r
            JOIN watch_party_players wp ON wp.room_id = r.id
            WHERE r.team_home = ${input.teamHome}
              AND r.team_away = ${input.teamAway}
              AND r.sport = ${input.sport}
              AND r.status != 'ended'
              AND r.created_at >= ${today}`
      ) as unknown as [Array<{ fan_count: number }>];
      const count = (rows[0] as Array<{ fan_count: number }>)?.[0]?.fan_count ?? 0;
      return { count: Number(count) };
    }),

  // Set the user's team flair for a room
  setFlair: protectedProcedure
    .input(z.object({ roomId: z.number(), teamFlair: z.string().max(20).nullable() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Upsert the player row with the flair
      await db.execute(
        sql`INSERT INTO watch_party_players (room_id, user_id, team_flair)
            VALUES (${input.roomId}, ${ctx.user.id}, ${input.teamFlair})
            ON DUPLICATE KEY UPDATE team_flair = ${input.teamFlair}`
      );
      return { ok: true };
    }),

  // Get the current user's flair for a room
  getMyFlair: protectedProcedure
    .input(z.object({ roomId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { teamFlair: null };
      const rows = await db.execute(
        sql`SELECT team_flair FROM watch_party_players WHERE room_id = ${input.roomId} AND user_id = ${ctx.user.id} LIMIT 1`
      ) as unknown as [Array<{ team_flair: string | null }>];
      const row = (rows[0] as Array<{ team_flair: string | null }>)?.[0];
      return { teamFlair: row?.team_flair ?? null };
    }),
});
