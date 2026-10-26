import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScoreTeam {
  id: string;
  abbreviation: string;
  displayName: string;
  shortDisplayName: string;
  logo: string;
  color: string;
  alternateColor: string;
  score: string;
  homeAway: "home" | "away";
  winner?: boolean;
  record?: string;
}

export interface ScoreGame {
  id: string;
  name: string;
  shortName: string;
  date: string;
  statusName: string; // STATUS_SCHEDULED | STATUS_IN_PROGRESS | STATUS_FINAL
  statusDetail: string; // "Q3 4:22" | "Final" | "7:30 PM EDT"
  isLive: boolean;
  isFinal: boolean;
  sport: "nfl" | "nba" | "mlb";
  homeTeam: ScoreTeam;
  awayTeam: ScoreTeam;
  broadcast?: string;
  venue?: string;
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 60_000; // 60 seconds

const cache = new Map<string, { data: ScoreGame[]; fetchedAt: number }>();

function getTodayESPN(): string {
  // Returns today's date in YYYYMMDD format in UTC — ESPN uses this to scope the scoreboard
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

async function fetchScoreboard(sport: "nfl" | "nba" | "mlb"): Promise<ScoreGame[]> {
  const today = getTodayESPN();
  const cacheKey = `${sport}-${today}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const sportSlug = sport === "nfl" ? "football/nfl" : sport === "nba" ? "basketball/nba" : "baseball/mlb";
  const url = `https://site.api.espn.com/apis/site/v2/sports/${sportSlug}/scoreboard?dates=${today}&limit=50`;

  let raw: Record<string, unknown>;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "JustPutzit/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`ESPN API returned ${res.status}`);
    raw = (await res.json()) as Record<string, unknown>;
  } catch (err) {
    // Return stale cache if available
    if (cached) return cached.data;
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to fetch ${sport.toUpperCase()} scores: ${(err as Error).message}`,
    });
  }

  const events = (raw.events as unknown[]) ?? [];

  const games: ScoreGame[] = events.map((ev) => {
    const e = ev as Record<string, unknown>;
    const comp = ((e.competitions as unknown[])?.[0] ?? {}) as Record<string, unknown>;
    const competitors = (comp.competitors as unknown[]) ?? [];
    const status = (e.status as Record<string, unknown>) ?? {};
    const statusType = (status.type as Record<string, unknown>) ?? {};

    const mapTeam = (c: Record<string, unknown>): ScoreTeam => {
      const t = (c.team as Record<string, unknown>) ?? {};
      return {
        id: String(t.id ?? ""),
        abbreviation: String(t.abbreviation ?? ""),
        displayName: String(t.displayName ?? ""),
        shortDisplayName: String(t.shortDisplayName ?? t.displayName ?? ""),
        logo: String(t.logo ?? ""),
        color: String(t.color ?? "1a1a2e"),
        alternateColor: String(t.alternateColor ?? ""),
        score: String(c.score ?? "0"),
        homeAway: (c.homeAway as "home" | "away") ?? "home",
        winner: Boolean(c.winner),
        record: (c.records as Record<string, unknown>[])?.[0]?.summary
          ? String((c.records as Record<string, unknown>[])[0].summary)
          : undefined,
      };
    };

    const home = competitors.find((c) => (c as Record<string, unknown>).homeAway === "home") as Record<string, unknown> | undefined;
    const away = competitors.find((c) => (c as Record<string, unknown>).homeAway === "away") as Record<string, unknown> | undefined;

    const broadcasts = (comp.broadcasts as Record<string, unknown>[]) ?? [];
    const broadcast = broadcasts[0]?.names
      ? (broadcasts[0].names as string[])[0]
      : String(comp.broadcast ?? "");

    const venue = (comp.venue as Record<string, unknown>)?.fullName
      ? String((comp.venue as Record<string, unknown>).fullName)
      : undefined;

    const statusName = String(statusType.name ?? "STATUS_SCHEDULED");
    const isLive = statusName === "STATUS_IN_PROGRESS";
    const isFinal = Boolean(statusType.completed);

    return {
      id: String(e.id ?? ""),
      name: String(e.name ?? ""),
      shortName: String(e.shortName ?? ""),
      date: String(e.date ?? ""),
      statusName,
      statusDetail: String(statusType.shortDetail ?? ""),
      isLive,
      isFinal,
      sport,
      homeTeam: home ? mapTeam(home) : ({} as ScoreTeam),
      awayTeam: away ? mapTeam(away) : ({} as ScoreTeam),
      broadcast: broadcast || undefined,
      venue,
    };
  });

  cache.set(cacheKey, { data: games, fetchedAt: Date.now() });
  return games;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const sportsScoresRouter = router({
  /** Get live/scheduled scores for a sport */
  getScores: publicProcedure
    .input(z.object({ sport: z.enum(["nfl", "nba", "mlb"]) }))
    .query(async ({ input }) => {
      const games = await fetchScoreboard(input.sport);
      return { games, fetchedAt: Date.now() };
    }),

  /** Get scores for all three sports at once */
  getAllScores: publicProcedure.query(async () => {
    const [nfl, nba, mlb] = await Promise.allSettled([
      fetchScoreboard("nfl"),
      fetchScoreboard("nba"),
      fetchScoreboard("mlb"),
    ]);
    return {
      nfl: nfl.status === "fulfilled" ? nfl.value : [],
      nba: nba.status === "fulfilled" ? nba.value : [],
      mlb: mlb.status === "fulfilled" ? mlb.value : [],
      fetchedAt: Date.now(),
    };
  }),

  /** Get only the live (in-progress) games across all sports */
  getLiveGames: publicProcedure.query(async () => {
    const [nfl, nba, mlb] = await Promise.allSettled([
      fetchScoreboard("nfl"),
      fetchScoreboard("nba"),
      fetchScoreboard("mlb"),
    ]);
    const all = [
      ...(nfl.status === "fulfilled" ? nfl.value : []),
      ...(nba.status === "fulfilled" ? nba.value : []),
      ...(mlb.status === "fulfilled" ? mlb.value : []),
    ];
    return {
      games: all.filter((g) => g.isLive),
      fetchedAt: Date.now(),
    };
  }),

  /** Save a team alert preference for the logged-in user */
  setTeamAlert: protectedProcedure
    .input(z.object({
      teamAbbreviation: z.string().min(1).max(10),
      teamName: z.string().min(1).max(100),
      sport: z.enum(["nfl", "nba", "mlb"]),
      enabled: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { getDb } = await import("../db");
      const { sportTeamAlerts } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const existing = await db
        .select()
        .from(sportTeamAlerts)
        .where(and(eq(sportTeamAlerts.userId, ctx.user.id), eq(sportTeamAlerts.teamAbbreviation, input.teamAbbreviation)))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(sportTeamAlerts)
          .set({ enabled: input.enabled })
          .where(and(eq(sportTeamAlerts.userId, ctx.user.id), eq(sportTeamAlerts.teamAbbreviation, input.teamAbbreviation)));
      } else if (input.enabled) {
        await db.insert(sportTeamAlerts).values({
          userId: ctx.user.id,
          teamAbbreviation: input.teamAbbreviation,
          teamName: input.teamName,
          sport: input.sport,
          enabled: true,
        });
      }
      return { success: true };
    }),

  /** Get upcoming games for a sport over the next N days (for Sports page schedule) */
  getUpcomingSchedule: publicProcedure
    .input(z.object({ sport: z.enum(["nfl", "nba", "mlb"]), days: z.number().min(1).max(30).default(7) }))
    .query(async ({ input }) => {
      const now = new Date();
      const end = new Date(now);
      end.setUTCDate(end.getUTCDate() + input.days);

      const fmt = (d: Date) => {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, "0");
        const day = String(d.getUTCDate()).padStart(2, "0");
        return `${y}${m}${day}`;
      };

      const sportSlug = input.sport === "nfl" ? "football/nfl" : input.sport === "nba" ? "basketball/nba" : "baseball/mlb";
      const url = `https://site.api.espn.com/apis/site/v2/sports/${sportSlug}/scoreboard?dates=${fmt(now)}-${fmt(end)}&limit=50`;

      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "JustPutzit/1.0" },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error(`ESPN ${res.status}`);
        const raw = (await res.json()) as Record<string, unknown>;
        const events = (raw.events as unknown[]) ?? [];

        return {
          games: events.map((ev) => {
            const e = ev as Record<string, unknown>;
            const comp = ((e.competitions as unknown[])?.[0] ?? {}) as Record<string, unknown>;
            const competitors = (comp.competitors as unknown[]) ?? [];
            const status = (e.status as Record<string, unknown>) ?? {};
            const statusType = (status.type as Record<string, unknown>) ?? {};

            const home = competitors.find((c) => (c as Record<string, unknown>).homeAway === "home") as Record<string, unknown> | undefined;
            const away = competitors.find((c) => (c as Record<string, unknown>).homeAway === "away") as Record<string, unknown> | undefined;

            const getTeam = (c: Record<string, unknown> | undefined) => {
              if (!c) return { name: "TBD", abbreviation: "TBD", logo: "" };
              const t = (c.team as Record<string, unknown>) ?? {};
              return {
                name: String(t.displayName ?? ""),
                shortName: String(t.shortDisplayName ?? t.displayName ?? ""),
                abbreviation: String(t.abbreviation ?? ""),
                logo: String(t.logo ?? ""),
                color: String(t.color ?? "1a1a2e"),
              };
            };

            const broadcasts = (comp.broadcasts as Record<string, unknown>[]) ?? [];
            const broadcast = broadcasts[0]?.names ? (broadcasts[0].names as string[])[0] : String(comp.broadcast ?? "");

            return {
              id: String(e.id ?? ""),
              name: String(e.name ?? ""),
              shortName: String(e.shortName ?? ""),
              date: String(e.date ?? ""),
              statusName: String(statusType.name ?? "STATUS_SCHEDULED"),
              statusDetail: String(statusType.shortDetail ?? ""),
              isLive: String(statusType.name ?? "") === "STATUS_IN_PROGRESS",
              isFinal: Boolean(statusType.completed),
              sport: input.sport,
              homeTeam: getTeam(home),
              awayTeam: getTeam(away),
              broadcast: broadcast || undefined,
              venue: (comp.venue as Record<string, unknown>)?.fullName ? String((comp.venue as Record<string, unknown>).fullName) : undefined,
            };
          }),
          fetchedAt: Date.now(),
        };
      } catch {
        return { games: [], fetchedAt: Date.now() };
      }
    }),

  /** Get the logged-in user's team alert preferences */
  getMyAlerts: protectedProcedure.query(async ({ ctx }) => {
    const { getDb } = await import("../db");
    const { sportTeamAlerts } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return { alerts: [] };
    const rows = await db
      .select()
      .from(sportTeamAlerts)
      .where(eq(sportTeamAlerts.userId, ctx.user.id));
        return { alerts: rows };
  }),

  /** Look up a specific game by home/away team names — used by Watch Party live score header */
  getGameByTeams: publicProcedure
    .input(z.object({
      teamHome: z.string(),
      teamAway: z.string(),
      sport: z.enum(["nfl", "nba", "mlb"]),
    }))
    .query(async ({ input }) => {
      const games = await fetchScoreboard(input.sport);
      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const homeNorm = normalize(input.teamHome);
      const awayNorm = normalize(input.teamAway);
      const match = games.find((g) => {
        const hName = normalize(g.homeTeam.displayName);
        const hShort = normalize(g.homeTeam.shortDisplayName);
        const aName = normalize(g.awayTeam.displayName);
        const aShort = normalize(g.awayTeam.shortDisplayName);
        return (
          (hName.includes(homeNorm) || homeNorm.includes(hName) || hShort.includes(homeNorm) || homeNorm.includes(hShort)) &&
          (aName.includes(awayNorm) || awayNorm.includes(aName) || aShort.includes(awayNorm) || awayNorm.includes(aShort))
        );
      });
      return { game: match ?? null, fetchedAt: Date.now() };
    }),
});

