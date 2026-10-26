import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb } from "../db";
import { workoutExercises, workoutLogs } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

// ─── Starter exercises seeded for new users ───────────────────────────────────
const STARTER_EXERCISES = [
  { name: "Squats",          muscleGroup: "Legs & Glutes",             sets: 3, reps: "12",  dayOfWeek: "Mon" as const },
  { name: "Push-Ups",        muscleGroup: "Chest, Shoulders, Triceps", sets: 3, reps: "10",  dayOfWeek: "Mon" as const },
  { name: "Planks",          muscleGroup: "Core & Stability",          sets: 3, reps: "30s", dayOfWeek: "Wed" as const },
  { name: "Lunges",          muscleGroup: "Legs & Core",               sets: 3, reps: "10",  dayOfWeek: "Wed" as const },
  { name: "Overhead Press",  muscleGroup: "Shoulders & Arms",          sets: 3, reps: "10",  dayOfWeek: "Fri" as const },
  { name: "Glute Bridges",   muscleGroup: "Posterior Chain",           sets: 3, reps: "15",  dayOfWeek: "Fri" as const },
];

export const workoutRouter = router({
  /** Get all exercises for the current user (starters + custom). Seeds starters on first call. */
  listExercises: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const userId = ctx.user.id;

    const existing = await db
      .select()
      .from(workoutExercises)
      .where(eq(workoutExercises.userId, userId));

    if (existing.length === 0) {
      // Seed starter exercises for first-time users
      await db.insert(workoutExercises).values(
        STARTER_EXERCISES.map((ex, i) => ({
          userId,
          name: ex.name,
          muscleGroup: ex.muscleGroup,
          sets: ex.sets,
          reps: ex.reps,
          dayOfWeek: ex.dayOfWeek,
          isCustom: false,
          sortOrder: i,
        }))
      );
      return await db
        .select()
        .from(workoutExercises)
        .where(eq(workoutExercises.userId, userId));
    }

    return existing;
  }),

  /** Add a custom exercise to the user's program */
  addExercise: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(120),
        muscleGroup: z.string().min(1).max(80).default("Full Body"),
        sets: z.number().int().min(1).max(20).default(3),
        reps: z.string().min(1).max(30).default("10"),
        notes: z.string().max(500).optional(),
        dayOfWeek: z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const userId = ctx.user.id;

      const existing = await db
        .select({ sortOrder: workoutExercises.sortOrder })
        .from(workoutExercises)
        .where(eq(workoutExercises.userId, userId));
      const maxOrder = existing.reduce((m, e) => Math.max(m, e.sortOrder), 0);

      await db.insert(workoutExercises).values({
        userId,
        name: input.name,
        muscleGroup: input.muscleGroup,
        sets: input.sets,
        reps: input.reps,
        notes: input.notes ?? null,
        dayOfWeek: input.dayOfWeek ?? null,
        isCustom: true,
        sortOrder: maxOrder + 1,
      });

      return { success: true };
    }),

  /** Delete a custom exercise (only custom ones can be deleted) */
  deleteExercise: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db
        .delete(workoutExercises)
        .where(
          and(
            eq(workoutExercises.id, input.id),
            eq(workoutExercises.userId, ctx.user.id),
            eq(workoutExercises.isCustom, true)
          )
        );
      return { success: true };
    }),

  /** Log a completed workout session for an exercise */
  logSet: protectedProcedure
    .input(
      z.object({
        exerciseId: z.number().int(),
        setsCompleted: z.number().int().min(0).max(20),
        repsActual: z.string().max(30).optional(),
        weightLbs: z.number().min(0).max(2000).optional(),
        notes: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.insert(workoutLogs).values({
        userId: ctx.user.id,
        exerciseId: input.exerciseId,
        setsCompleted: input.setsCompleted,
        repsActual: input.repsActual ?? null,
        weightLbs: input.weightLbs ?? null,
        notes: input.notes ?? null,
      });
      return { success: true };
    }),

  /** Get recent workout logs for the current user */
  getRecentLogs: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return await db
      .select()
      .from(workoutLogs)
      .where(eq(workoutLogs.userId, ctx.user.id))
      .orderBy(desc(workoutLogs.loggedAt))
      .limit(100);
  }),
});
