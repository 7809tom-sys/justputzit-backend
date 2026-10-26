import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { gyms, gymBuddyProfiles, gymSessions, gymSessionRsvps } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

export const gymRouter = router({
  // List all gyms with buddy counts
  listGyms: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const gymList = await db.select().from(gyms).orderBy(gyms.isPartner, gyms.name);
    // Get buddy counts per gym
    const counts = await db.execute(
      sql`SELECT gym_id, COUNT(*) as buddy_count FROM gym_buddy_profiles GROUP BY gym_id`
    ) as unknown as Array<{ gym_id: number; buddy_count: number }>;
    const countMap = new Map(counts.map((c) => [c.gym_id, Number(c.buddy_count)]));
    return gymList.map((g: typeof gyms.$inferSelect) => ({
      ...g,
      amenities: g.amenities ? (JSON.parse(g.amenities) as string[]) : [],
      buddyCount: countMap.get(g.id) ?? 0,
      partnerTier: g.partnerTier ?? "basic",
      claimedByUserId: g.claimedByUserId ?? null,
      referralCode: g.referralCode ?? null,
    }));
  }),

  // Get a single gym with full details
  getGym: publicProcedure
    .input(z.object({ gymId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const rows = await db.select().from(gyms).where(eq(gyms.id, input.gymId)).limit(1);
      if (!rows.length) throw new TRPCError({ code: "NOT_FOUND", message: "Gym not found" });
      const gym = rows[0];
      return {
        ...gym,
        amenities: gym.amenities ? (JSON.parse(gym.amenities) as string[]) : [],
        partnerTier: gym.partnerTier ?? "basic",
        claimedByUserId: gym.claimedByUserId ?? null,
        referralCode: gym.referralCode ?? null,
      };
    }),

  // Get buddy profile for current user at a gym
  getMyBuddyProfile: protectedProcedure
    .input(z.object({ gymId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(gymBuddyProfiles)
        .where(and(eq(gymBuddyProfiles.userId, ctx.user.id), eq(gymBuddyProfiles.gymId, input.gymId)))
        .limit(1);
      if (!rows.length) return null;
      const p = rows[0];
      return {
        ...p,
        workoutStyles: JSON.parse(p.workoutStyles || "[]") as string[],
        schedule: JSON.parse(p.schedule || "[]") as string[],
      };
    }),

  // Save / update buddy profile for current user at a gym
  saveBuddyProfile: protectedProcedure
    .input(z.object({
      gymId: z.number(),
      workoutStyles: z.array(z.string()),
      schedule: z.array(z.string()),
      fitnessLevel: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
      goals: z.string().optional(),
      bio: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const existing = await db.select({ id: gymBuddyProfiles.id })
        .from(gymBuddyProfiles)
        .where(and(eq(gymBuddyProfiles.userId, ctx.user.id), eq(gymBuddyProfiles.gymId, input.gymId)))
        .limit(1);
      const values = {
        workoutStyles: JSON.stringify(input.workoutStyles),
        schedule: JSON.stringify(input.schedule),
        fitnessLevel: input.fitnessLevel,
        goals: input.goals ?? null,
        bio: input.bio ?? null,
      };
      if (existing.length) {
        await db.update(gymBuddyProfiles).set(values).where(eq(gymBuddyProfiles.id, existing[0].id));
      } else {
        await db.insert(gymBuddyProfiles).values({
          userId: ctx.user.id,
          gymId: input.gymId,
          ...values,
        });
      }
      return { success: true };
    }),

  // Find gym buddies at a gym — matched by workout style overlap
  findBuddies: protectedProcedure
    .input(z.object({ gymId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      // Get current user's profile
      const myProfiles = await db.select().from(gymBuddyProfiles)
        .where(and(eq(gymBuddyProfiles.userId, ctx.user.id), eq(gymBuddyProfiles.gymId, input.gymId)))
        .limit(1);
      const myProfile = myProfiles[0] ?? null;
      const myStyles: string[] = myProfile ? (JSON.parse(myProfile.workoutStyles || "[]") as string[]) : [];
      const mySchedule: string[] = myProfile ? (JSON.parse(myProfile.schedule || "[]") as string[]) : [];

      // Get all other buddies at this gym
      const buddies = await db.execute(
        sql`SELECT gbp.id, gbp.user_id, gbp.workout_styles, gbp.schedule, gbp.fitness_level, gbp.goals, gbp.bio, gbp.is_verified,
                   u.name as display_name, u.avatar_emoji, u.avatar_color,
                   up.city, up.gpsVerifiedCity, up.locationVerified, up.claimedCity
            FROM gym_buddy_profiles gbp
            JOIN users u ON u.id = gbp.user_id
            LEFT JOIN user_profiles up ON up.userId = gbp.user_id
            WHERE gbp.gym_id = ${input.gymId} AND gbp.user_id != ${ctx.user.id}
            ORDER BY gbp.is_verified DESC, gbp.created_at DESC`
      ) as unknown as Array<{
        id: number; user_id: number; workout_styles: string; schedule: string;
        fitness_level: string; goals: string | null; bio: string | null; is_verified: boolean;
        display_name: string; avatar_emoji: string; avatar_color: string;
        city: string | null; gpsVerifiedCity: string | null; locationVerified: boolean; claimedCity: string | null;
      }>;

      return buddies.map((b) => {
        const theirStyles = JSON.parse(b.workout_styles || "[]") as string[];
        const theirSchedule = JSON.parse(b.schedule || "[]") as string[];
        const styleOverlap = myStyles.filter((s) => theirStyles.includes(s));
        const scheduleOverlap = mySchedule.filter((s) => theirSchedule.includes(s));
        const matchScore = styleOverlap.length * 20 + scheduleOverlap.length * 10;
        const displayCity = b.gpsVerifiedCity || b.claimedCity || b.city || "Unknown";
        return {
          userId: b.user_id,
          displayName: b.display_name || "Gym Buddy",
          avatarEmoji: b.avatar_emoji || "💪",
          avatarColor: b.avatar_color || "#ea580c",
          workoutStyles: theirStyles,
          schedule: theirSchedule,
          fitnessLevel: b.fitness_level,
          goals: b.goals,
          bio: b.bio,
          isVerified: b.is_verified,
          locationVerified: b.locationVerified,
          city: displayCity,
          styleOverlap,
          scheduleOverlap,
          matchScore,
        };
      }).sort((a, b) => b.matchScore - a.matchScore);
    }),

  // List group sessions at a gym
  listSessions: publicProcedure
    .input(z.object({ gymId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const now = Date.now();
      const sessions = await db.execute(
        sql`SELECT gs.id, gs.gym_id, gs.host_user_id, gs.title, gs.workout_type, gs.scheduled_at,
                   gs.duration_minutes, gs.max_participants, gs.notes, gs.created_at,
                   u.name as host_name, u.avatar_emoji as host_emoji, u.avatar_color as host_color,
                   COUNT(rsvp.id) as rsvp_count
            FROM gym_sessions gs
            JOIN users u ON u.id = gs.host_user_id
            LEFT JOIN gym_session_rsvps rsvp ON rsvp.session_id = gs.id
            WHERE gs.gym_id = ${input.gymId} AND gs.scheduled_at > ${now - 3600000}
            GROUP BY gs.id
            ORDER BY gs.scheduled_at ASC
            LIMIT 20`
      ) as unknown as Array<{
        id: number; gym_id: number; host_user_id: number; title: string; workout_type: string | null;
        scheduled_at: number; duration_minutes: number; max_participants: number; notes: string | null;
        created_at: Date; host_name: string; host_emoji: string; host_color: string; rsvp_count: number;
      }>;

      // Fetch participant avatars for each session (up to 5 per session)
      const sessionIds = sessions.map((s) => s.id);
      let participantMap = new Map<number, Array<{ userId: number; emoji: string; color: string; name: string }>>();
      if (sessionIds.length > 0) {
        const placeholders = sessionIds.map(() => "?").join(",");
        const participants = await db.execute(
          sql`SELECT gsr.session_id, gsr.user_id, u.avatar_emoji, u.avatar_color, u.name
              FROM gym_session_rsvps gsr
              JOIN users u ON u.id = gsr.user_id
              WHERE gsr.session_id IN (${sql.raw(sessionIds.join(","))})
              ORDER BY gsr.joined_at ASC`
        ) as unknown as Array<{ session_id: number; user_id: number; avatar_emoji: string; avatar_color: string; name: string }>;
        for (const p of participants) {
          const list = participantMap.get(p.session_id) ?? [];
          list.push({ userId: p.user_id, emoji: p.avatar_emoji || "💪", color: p.avatar_color || "#ea580c", name: p.name || "Gym Member" });
          participantMap.set(p.session_id, list);
        }
      }

      return sessions.map((s) => {
        const allParticipants = participantMap.get(s.id) ?? [];
        return {
          id: s.id,
          gymId: s.gym_id,
          hostUserId: s.host_user_id,
          title: s.title,
          workoutType: s.workout_type,
          scheduledAt: Number(s.scheduled_at),
          durationMinutes: s.duration_minutes,
          maxParticipants: s.max_participants,
          notes: s.notes,
          hostName: s.host_name || "Gym Member",
          hostEmoji: s.host_emoji || "💪",
          hostColor: s.host_color || "#ea580c",
          rsvpCount: Number(s.rsvp_count),
          spotsLeft: s.max_participants - Number(s.rsvp_count),
          participantAvatars: allParticipants.slice(0, 5),
          extraParticipants: Math.max(0, allParticipants.length - 5),
        };
      });
    }),

  // Create a group session
  createSession: protectedProcedure
    .input(z.object({
      gymId: z.number(),
      title: z.string().min(3).max(150),
      workoutType: z.string().optional(),
      scheduledAt: z.number().int().positive().refine((value) => value > Date.now(), { message: "Workout sessions must be scheduled in the future" }), // unix ms
      durationMinutes: z.number().default(60),
      maxParticipants: z.number().min(2).max(20).default(6),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const result = await db.insert(gymSessions).values({
        gymId: input.gymId,
        hostUserId: ctx.user.id,
        title: input.title,
        workoutType: input.workoutType ?? null,
        scheduledAt: input.scheduledAt,
        durationMinutes: input.durationMinutes,
        maxParticipants: input.maxParticipants,
        notes: input.notes ?? null,
      });
      return { sessionId: (result as unknown as { insertId: number }).insertId };
    }),

  // RSVP to a session
  rsvpSession: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      // Check if already RSVPd
      const existing = await db.select({ id: gymSessionRsvps.id })
        .from(gymSessionRsvps)
        .where(and(eq(gymSessionRsvps.sessionId, input.sessionId), eq(gymSessionRsvps.userId, ctx.user.id)))
        .limit(1);
      if (existing.length) {
        // Toggle off — cancel RSVP
        await db.delete(gymSessionRsvps).where(eq(gymSessionRsvps.id, existing[0].id));
        return { joined: false };
      }
      await db.insert(gymSessionRsvps).values({ sessionId: input.sessionId, userId: ctx.user.id });
      return { joined: true };
    }),

  // Claim a gym (sets claimedByUserId to current user, pending admin approval)
  claimGym: protectedProcedure
    .input(z.object({ gymId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const rows = await db.select({ id: gyms.id, claimedByUserId: gyms.claimedByUserId })
        .from(gyms).where(eq(gyms.id, input.gymId)).limit(1);
      if (!rows.length) throw new TRPCError({ code: "NOT_FOUND", message: "Gym not found" });
      if (rows[0].claimedByUserId) {
        throw new TRPCError({ code: "CONFLICT", message: "This gym has already been claimed" });
      }
      await db.update(gyms)
        .set({ claimedByUserId: ctx.user.id })
        .where(eq(gyms.id, input.gymId));
      return { success: true };
    }),

  // Get my RSVPs
  getMyRsvps: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const rsvps = await db.select({ sessionId: gymSessionRsvps.sessionId })
      .from(gymSessionRsvps)
      .where(eq(gymSessionRsvps.userId, ctx.user.id));
    return rsvps.map((r: { sessionId: number }) => r.sessionId);
  }),
});
