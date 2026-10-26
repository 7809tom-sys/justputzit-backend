import { and, desc, eq, getTableColumns, gt, inArray, lt, or, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { selectCurrentVerifiedEvents } from "./eventRecommendations";
import { normalizeSavedLocationDraft } from "./savedLocationPolicy";
import { buildPartnerImpactTrend, buildPartnerImpactTrendForRange, summarizePartnerImpact } from "./partnerImpact";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  chatMessages,
  gameSessions,
  interviewSessions,
  matches,
  eventProposals,
  pickPlanRounds,
  pickPlanVotes,
  notifications,
  birthdayNotifications,
  userProfiles,
  users,
  reports,
  blocks,
  adminFlags,
  venuePartners,
  activityListings,
  sponsoredPlacements,
  sponsoredPlacementEvents,
  activityRsvps,
  activityBookmarks,
  communityGroups,
  communityGroupMembers,
  bookings,
  conciergeRequests,
  coupleLinks,
  coupleMatches,
  campuses,
  referrals,
  wouldYouRatherQuestions,
  wouldYouRatherAnswers,
  wyrChallenges,
  communityEvents,
  eventSourceHealth,
  eventRsvps,
  eventIntroductions,
  eventInterests,
  eventRecommendationFeedback,
  pickupAlertPreferences,
  pickupSessions,
  pickupParticipants,
  passkeyCredentials,
  webauthnChallenges,
  loginAds,
  profilePhotos,
  venueOutreach,
  gameRooms,
  gameRoomPlayers,
  gameResults,
  movieBookingClicks,
  entertainmentClicks,
  friendInvites,
  campusMembers,
  familyProfiles,
  familyChildren,
  familyMatches,
  tripPlans,
  userHomepageLayout,
  savedLocations,
  todaysPlans,
  triviaQuestions,
  triviaRooms,
  triviaRoomPlayers,
  triviaAnswers,
  gameChatMessages,
  gameChatMessagesUpdated,
  sharedQuestionLibrary,
  sharedQuestionGameTargets,
  type TriviaQuestion,
  type TriviaRoom,
  type TriviaRoomPlayer,
  type TriviaAnswer,
  type GameChatMessage,
  type TripItem,
  type TripPlan,
  type CommunityEvent,
  type InsertCommunityEvent,
  type ProfileTraits,
  type InterviewMessage,
  type MatchGameQuestion as GameQuestion,
  type ConciergePlanItem,
} from "../drizzle/schema";
import { isSharedQuestionFormatEligible, toSharedQuestionClientRecord, type SharedGameType } from "../shared/sharedQuestionLibrary";
import { ENV } from "./_core/env";
import { PICKUP_ALERT_CATEGORY, type PickupActivityType, isPickupPreferenceMatch } from "../shared/pickupActivityPolicy";
import { isActiveSponsoredPlacement } from "../shared/sponsoredPlacementPolicy";
import { getSponsoredPerformanceRates } from "../shared/sponsoredPerformance";
import { buildSponsoredAudienceSummary, SPONSORED_AUDIENCE_MIN_GROUP_SIZE } from "../shared/sponsoredAudienceSummary";
import { shouldAutoSuspendForReports } from "../shared/reportEscalationPolicy";
import { getWebauthnChallengeExpiry } from "../shared/webauthnChallengePolicy";
import { canCreateEventIntroduction, getEventIntroductionPair } from "../shared/eventIntroductionPolicy";
import { getArchivableEventIds } from "../shared/eventRetentionPolicy";
import { selectCurrentSavedActivityEvents } from "../shared/savedActivityEvents";
import { makeRequest, type GeocodingResult } from "./_core/map";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function geocodePublicVenueAddress(address: string | null): Promise<{ lat: number; lng: number } | null> {
  if (!address?.trim()) return null;
  try {
    const response = await makeRequest<GeocodingResult>("/maps/api/geocode/json", { address: address.trim() });
    const location = response.results[0]?.geometry.location;
    if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) return null;
    return { lat: location.lat, lng: location.lng };
  } catch {
    // A source refresh must remain available if public-address geocoding is unavailable.
    return null;
  }
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

/** Points an existing member at a new auth identity (Supabase user id), keeping all their data. */
export async function relinkUserOpenId(userId: number, openId: string, loginMethod: string | null) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(users).set({ openId, loginMethod, lastSignedIn: new Date() }).where(eq(users.id, userId));
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users);
}

export async function setMemberAdministratorRole(userId: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(users).set({
    role,
    adminPromotedAt: role === "admin" ? new Date() : null,
  }).where(eq(users.id, userId));
  return getUserById(userId);
}

// ─── User Profiles ────────────────────────────────────────────────────────────

export async function getOrCreateProfile(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  if (existing[0]) return existing[0];
  await db.insert(userProfiles).values({ userId, traits: {} });
  const created = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  return created[0] ?? null;
}

export async function updateProfile(userId: number, data: Partial<typeof userProfiles.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(userProfiles).set(data).where(eq(userProfiles.userId, userId));
}

export async function getProfileByUserId(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  return result[0] ?? null;
}

export async function getAllProfiles() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userProfiles);
}

// ─── Interview Sessions ───────────────────────────────────────────────────────

export async function createInterviewSession(userId: number) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(interviewSessions).values({ userId, messages: [], extractedTraits: {} });
  const result = await db
    .select()
    .from(interviewSessions)
    .where(eq(interviewSessions.userId, userId))
    .orderBy(desc(interviewSessions.createdAt))
    .limit(1);
  return result[0] ?? null;
}

export async function getInterviewSession(sessionId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(interviewSessions).where(eq(interviewSessions.id, sessionId)).limit(1);
  return result[0] ?? null;
}

export async function updateInterviewSession(
  sessionId: number,
  data: { messages?: InterviewMessage[]; extractedTraits?: ProfileTraits; completedAt?: Date }
) {
  const db = await getDb();
  if (!db) return;
  await db.update(interviewSessions).set(data).where(eq(interviewSessions.id, sessionId));
}

export async function getLatestInterviewSession(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(interviewSessions)
    .where(eq(interviewSessions.userId, userId))
    .orderBy(desc(interviewSessions.createdAt))
    .limit(1);
  return result[0] ?? null;
}

export async function getLatestCompletedInterviewSessions(userId: number, limit = 2) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(interviewSessions)
    .where(and(eq(interviewSessions.userId, userId), sql`${interviewSessions.completedAt} IS NOT NULL`))
    .orderBy(desc(interviewSessions.completedAt))
    .limit(limit);
}

// ─── Matches ──────────────────────────────────────────────────────────────────

export async function createMatch(user1Id: number, user2Id: number, score: number, reason: string) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(matches).values({ user1Id, user2Id, compatibilityScore: score, compatibilityReason: reason });
  const result = await db
    .select()
    .from(matches)
    .where(and(eq(matches.user1Id, user1Id), eq(matches.user2Id, user2Id)))
    .orderBy(desc(matches.createdAt))
    .limit(1);
  return result[0] ?? null;
}

export async function getMatchesForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(matches)
    .where(or(eq(matches.user1Id, userId), eq(matches.user2Id, userId)))
    .orderBy(desc(matches.createdAt));
}

export async function getMatchById(matchId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  return result[0] ?? null;
}

export async function existingMatch(user1Id: number, user2Id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(matches)
    .where(
      or(
        and(eq(matches.user1Id, user1Id), eq(matches.user2Id, user2Id)),
        and(eq(matches.user1Id, user2Id), eq(matches.user2Id, user1Id))
      )
    )
    .limit(1);
  return result[0] ?? null;
}

// ─── Chat Messages ────────────────────────────────────────────────────────────

export async function sendChatMessage(matchId: number, senderId: number, content: string) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(chatMessages).values({ matchId, senderId, content });
  const result = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.matchId, matchId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(1);
  return result[0] ?? null;
}

export async function getChatMessages(matchId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.matchId, matchId))
    .orderBy(chatMessages.createdAt)
    .limit(limit);
}

// ─── Public Event Proposals ────────────────────────────────────────────────────

export function isMatchParticipant(match: { user1Id: number; user2Id: number } | null, userId: number) {
  return !!match && (match.user1Id === userId || match.user2Id === userId);
}

export async function getEventProposalsForMatch(matchId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ proposal: eventProposals, event: communityEvents })
    .from(eventProposals)
    .innerJoin(communityEvents, eq(eventProposals.eventId, communityEvents.id))
    .where(eq(eventProposals.matchId, matchId))
    .orderBy(desc(eventProposals.createdAt));
}

export async function createEventProposal(input: {
  matchId: number;
  eventId: number;
  proposerId: number;
  recipientId: number;
  note?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const existing = await db
    .select({ id: eventProposals.id })
    .from(eventProposals)
    .where(and(
      eq(eventProposals.matchId, input.matchId),
      eq(eventProposals.eventId, input.eventId),
      eq(eventProposals.proposerId, input.proposerId),
      eq(eventProposals.recipientId, input.recipientId),
      eq(eventProposals.status, "pending"),
    ))
    .limit(1);
  if (existing[0]) throw new Error("You already have a pending invitation for this event");

  const [result] = await db.insert(eventProposals).values({
    ...input,
    note: input.note?.trim() || null,
  });
  const [proposal] = await db.select().from(eventProposals).where(eq(eventProposals.id, Number(result.insertId))).limit(1);
  if (!proposal) throw new Error("Could not create invitation");

  await db.insert(chatMessages).values({
    matchId: input.matchId,
    senderId: input.proposerId,
    content: "Sent a public-event proposal.",
    messageType: "event_proposal",
    proposalId: proposal.id,
  });
  return proposal;
}

export async function respondToEventProposal(input: {
  proposalId: number;
  recipientId: number;
  status: "accepted" | "declined";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [proposal] = await db.select().from(eventProposals).where(eq(eventProposals.id, input.proposalId)).limit(1);
  if (!proposal || proposal.recipientId !== input.recipientId) throw new Error("Proposal not found");
  if (proposal.status !== "pending") throw new Error("This invitation has already been answered");

  await db.update(eventProposals).set({ status: input.status, respondedAt: new Date() }).where(eq(eventProposals.id, proposal.id));
  if (input.status === "accepted") {
    await Promise.all([
      markEventInterest(proposal.eventId, proposal.proposerId, "going"),
      markEventInterest(proposal.eventId, proposal.recipientId, "going"),
    ]);
  }
  const [updated] = await db.select().from(eventProposals).where(eq(eventProposals.id, proposal.id)).limit(1);
  return updated ?? proposal;
}

// ─── Pick a Plan ──────────────────────────────────────────────────────────────

export async function createPickPlanRound(input: {
  matchId: number;
  creatorId: number;
  candidateEventIds: number[];
  expiresAt: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [result] = await db.insert(pickPlanRounds).values(input);
  const [round] = await db.select().from(pickPlanRounds).where(eq(pickPlanRounds.id, Number(result.insertId))).limit(1);
  if (!round) throw new Error("Could not create Pick a Plan round");
  return round;
}

export async function getActivePickPlanRoundForMatch(matchId: number) {
  const db = await getDb();
  if (!db) return null;
  const [round] = await db.select()
    .from(pickPlanRounds)
    .where(and(
      eq(pickPlanRounds.matchId, matchId),
      eq(pickPlanRounds.status, "voting"),
      gt(pickPlanRounds.expiresAt, new Date()),
    ))
    .orderBy(desc(pickPlanRounds.createdAt))
    .limit(1);
  return round ?? null;
}

export async function getPickPlanRound(roundId: number) {
  const db = await getDb();
  if (!db) return null;
  const [round] = await db.select().from(pickPlanRounds).where(eq(pickPlanRounds.id, roundId)).limit(1);
  if (!round) return null;
  const candidateIds = (round.candidateEventIds ?? []).filter((id): id is number => Number.isInteger(id));
  const [candidates, votes] = await Promise.all([
    candidateIds.length > 0 ? db.select().from(communityEvents).where(inArray(communityEvents.id, candidateIds)) : Promise.resolve([]),
    db.select().from(pickPlanVotes).where(eq(pickPlanVotes.roundId, round.id)),
  ]);
  return { round, candidates, votes };
}

export async function recordPickPlanVote(input: { roundId: number; userId: number; eventId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const current = await getPickPlanRound(input.roundId);
  if (!current) throw new Error("Pick a Plan round not found");
  if (current.round.status !== "voting") throw new Error("This Pick a Plan round is no longer open");
  if (current.round.expiresAt.getTime() <= Date.now()) {
    await db.update(pickPlanRounds).set({ status: "expired" }).where(eq(pickPlanRounds.id, input.roundId));
    throw new Error("This Pick a Plan round has expired");
  }
  if (!(current.round.candidateEventIds ?? []).includes(input.eventId)) {
    throw new Error("Choose one of this round’s suggested events");
  }

  await db.insert(pickPlanVotes).values(input).onDuplicateKeyUpdate({
    set: { eventId: input.eventId, updatedAt: new Date() },
  });
  const updated = await getPickPlanRound(input.roundId);
  if (!updated) throw new Error("Pick a Plan round not found");
  return updated;
}

export async function revealPickPlanMatch(roundId: number, memberIds: [number, number]) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const current = await getPickPlanRound(roundId);
  if (!current) throw new Error("Pick a Plan round not found");
  const votesByMember = new Map(current.votes.map((vote) => [vote.userId, vote.eventId]));
  const firstVote = votesByMember.get(memberIds[0]);
  const secondVote = votesByMember.get(memberIds[1]);
  if (firstVote === undefined || secondVote === undefined || firstVote !== secondVote) return current;

  await db.update(pickPlanRounds).set({ status: "matched", matchedEventId: firstVote }).where(eq(pickPlanRounds.id, roundId));
  const revealed = await getPickPlanRound(roundId);
  return revealed ?? current;
}

// ─── Game Sessions ────────────────────────────────────────────────────────────

export async function createGameSession(
  matchId: number,
  gameType: "newlywed" | "two_truths" | "this_or_that",
  questions: GameQuestion[]
) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(gameSessions).values({ matchId, gameType, questions, status: "in_progress" });
  const result = await db
    .select()
    .from(gameSessions)
    .where(eq(gameSessions.matchId, matchId))
    .orderBy(desc(gameSessions.createdAt))
    .limit(1);
  return result[0] ?? null;
}

export async function updateGameSession(
  sessionId: number,
  data: Partial<typeof gameSessions.$inferInsert>
) {
  const db = await getDb();
  if (!db) return;
  await db.update(gameSessions).set(data).where(eq(gameSessions.id, sessionId));
}

export async function getGameSession(sessionId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(gameSessions).where(eq(gameSessions.id, sessionId)).limit(1);
  return result[0] ?? null;
}

export async function getGameSessionsForMatch(matchId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(gameSessions)
    .where(eq(gameSessions.matchId, matchId))
    .orderBy(desc(gameSessions.createdAt));
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function createNotification(
  userId: number,
  type: "new_match" | "game_ready" | "new_message" | "interview_reminder" | "pickup_invite" | "event_proposal" | "report_update",
  title: string,
  body: string,
  relatedId?: number
) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notifications).values({ userId, type, title, body, relatedId });
}

export async function getNotificationsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(20);
}

export async function markNotificationRead(notifId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, notifId));
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
}

/**
 * Creates one private, in-app birthday reminder for each eligible matched member.
 * The birthday record tracks delivery by recipient, birthday member, and UTC run
 * date so Heartbeat retries cannot produce duplicate alerts.
 */
export async function createBirthdayMatchNotifications(now = new Date()) {
  const db = await getDb();
  if (!db) return { birthdayMembers: 0, created: 0, skipped: 0 };

  const month = now.getUTCMonth() + 1;
  const day = now.getUTCDate();
  const birthdayDateKey = now.toISOString().slice(0, 10);
  const birthdayMembers = await db
    .select({ userId: userProfiles.userId, displayName: userProfiles.displayName })
    .from(userProfiles)
    .where(sql`MONTH(${userProfiles.birthDate}) = ${month} AND DAY(${userProfiles.birthDate}) = ${day}`);
  const birthdayUserIds = birthdayMembers.map((member) => member.userId);

  if (birthdayUserIds.length === 0) {
    return { birthdayMembers: 0, created: 0, skipped: 0 };
  }

  const activeMatches = await db
    .select()
    .from(matches)
    .where(and(
      eq(matches.status, "active"),
      or(inArray(matches.user1Id, birthdayUserIds), inArray(matches.user2Id, birthdayUserIds)),
    ));
  const birthdayNames = new Map(birthdayMembers.map((member) => [member.userId, member.displayName || "Your match"]));
  let created = 0;
  let skipped = 0;

  for (const match of activeMatches) {
    const birthdayUserId = birthdayUserIds.includes(match.user1Id) ? match.user1Id : match.user2Id;
    const recipientUserId = birthdayUserId === match.user1Id ? match.user2Id : match.user1Id;

    if (await isBlockInEffect(birthdayUserId, recipientUserId)) {
      skipped += 1;
      continue;
    }

    const [existing] = await db
      .select({ id: birthdayNotifications.id })
      .from(birthdayNotifications)
      .where(and(
        eq(birthdayNotifications.recipientUserId, recipientUserId),
        eq(birthdayNotifications.birthdayUserId, birthdayUserId),
        eq(birthdayNotifications.birthdayDateKey, birthdayDateKey),
      ))
      .limit(1);
    if (existing) {
      skipped += 1;
      continue;
    }

    await db.insert(birthdayNotifications).values({
      recipientUserId,
      birthdayUserId,
      matchId: match.id,
      birthdayDateKey,
    });
    await db.insert(notifications).values({
      userId: recipientUserId,
      type: "birthday_reminder",
      title: "A match has a birthday today",
      body: `${birthdayNames.get(birthdayUserId)} has a birthday today. A kind message is a thoughtful way to reach out.`,
      relatedId: match.id,
    });
    created += 1;
  }

  return { birthdayMembers: birthdayMembers.length, created, skipped };
}

// ─── Safety: Reports & Blocks ─────────────────────────────────────────────────

export async function createReport(
  reporterId: number,
  reportedUserId: number,
  reason: typeof reports.$inferInsert["reason"],
  details?: string
) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(reports).values({ reporterId, reportedUserId, reason, details });
  // Escalate only independently filed open reports; dismissed reports and administrators
  // never count toward an automatic suspension.
  const allReports = await db.select().from(reports).where(eq(reports.reportedUserId, reportedUserId));
  const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, reportedUserId)).limit(1);
  if (shouldAutoSuspendForReports(target?.role, allReports)) {
    await db.update(users).set({ role: "banned" as any }).where(eq(users.id, reportedUserId));
    const existingEscalation = await db.select({ id: adminFlags.id }).from(adminFlags)
      .where(and(eq(adminFlags.userId, reportedUserId), eq(adminFlags.flagType, "multiple_reports"), sql`${adminFlags.resolvedAt} IS NULL`)).limit(1);
    if (!existingEscalation[0]) {
      const distinctReporterCount = new Set(allReports.filter((report) => report.status !== "dismissed").map((report) => report.reporterId)).size;
      await db.insert(adminFlags).values({
        userId: reportedUserId,
        flagType: "multiple_reports",
        severity: "high",
        notes: `Automatically suspended pending review after ${distinctReporterCount} distinct open reports`,
      });
    }
    return { success: true, autoSuspended: true };
  }
  return { success: true };
}

export async function getReportsForAdmin() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reports).orderBy(desc(reports.createdAt)).limit(100);
}

export async function updateReportStatus(
  reportId: number,
  status: typeof reports.$inferInsert["status"]
) {
  const db = await getDb();
  if (!db) return;
  const [report] = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
  if (!report || report.status === status) return;
  await db.update(reports).set({ status, reviewedAt: new Date() }).where(eq(reports.id, reportId));
  if (status !== "pending") {
    await createNotification(
      report.reporterId,
      "report_update",
      "Your safety report was reviewed",
      "A report you submitted has been reviewed. To protect everyone’s privacy, we can’t share any action taken. Thank you for helping keep Just Putzit safe.",
      reportId,
    );
  }
}

export async function blockUser(blockerId: number, blockedUserId: number) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(blocks)
    .where(and(eq(blocks.blockerId, blockerId), eq(blocks.blockedUserId, blockedUserId))).limit(1);
  if (!existing[0]) {
    await db.insert(blocks).values({ blockerId, blockedUserId });
  }
}

export async function getBlockedUserIds(userId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select().from(blocks).where(eq(blocks.blockerId, userId));
  return result.map(b => b.blockedUserId);
}

export async function isBlockInEffect(userAId: number, userBId: number) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select({ id: blocks.id }).from(blocks).where(or(
    and(eq(blocks.blockerId, userAId), eq(blocks.blockedUserId, userBId)),
    and(eq(blocks.blockerId, userBId), eq(blocks.blockedUserId, userAId)),
  )).limit(1);
  return Boolean(result[0]);
}

export async function getAdminFlags() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(adminFlags).orderBy(desc(adminFlags.createdAt)).limit(100);
}

export async function resolveAdminFlag(flagId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(adminFlags).set({ resolvedAt: new Date() }).where(eq(adminFlags.id, flagId));
}

export async function suspendUser(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role: "banned" as any }).where(eq(users.id, userId));
  // Record the suspension decision for admin audit history.
  await db.insert(adminFlags).values({
    userId,
    flagType: "manual_review",
    severity: "high",
    notes: "Account suspended by admin pending review",
  });
}

// ─── Venue Partners ───────────────────────────────────────────────────────────

export async function getVenuePartners(city?: string) {
  const db = await getDb();
  if (!db) return [];
  if (city) {
    return db.select().from(venuePartners)
      .where(and(eq(venuePartners.isActive, true), eq(venuePartners.city, city)))
      .orderBy(desc(venuePartners.isFeatured));
  }
  return db.select().from(venuePartners)
    .where(eq(venuePartners.isActive, true))
    .orderBy(desc(venuePartners.isFeatured));
}

export async function getVenueById(venueId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(venuePartners).where(eq(venuePartners.id, venueId)).limit(1);
  return result[0] ?? null;
}

export async function createVenuePartner(data: typeof venuePartners.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(venuePartners).values(data);
  const result = await db.select().from(venuePartners).orderBy(desc(venuePartners.createdAt)).limit(1);
  return result[0] ?? null;
}

export async function recordReferralVisit(activityId: number) {
  const db = await getDb();
  if (!db) return;
  const activity = await db.select().from(activityListings).where(eq(activityListings.id, activityId)).limit(1);
  if (activity[0]) {
    await db.update(activityListings)
      .set({ totalReferrals: (activity[0].totalReferrals ?? 0) + 1 })
      .where(eq(activityListings.id, activityId));
  }
}

// ─── Activity Listings ────────────────────────────────────────────────────────

export async function getActivityListings(
  city?: string,
  category?: string,
  geo?: { lat?: number; lng?: number; radiusMiles?: number },
) {
  const db = await getDb();
  if (!db) return [];

  // Join with venuePartners to get city/location info
  const rows = await db
    .select({
      id: activityListings.id,
      venueId: activityListings.venueId,
      title: activityListings.title,
      description: activityListings.description,
      category: activityListings.category,
      eventDate: activityListings.eventDate,
      durationMinutes: activityListings.durationMinutes,
      maxGroupSize: activityListings.maxGroupSize,
      minGroupSize: activityListings.minGroupSize,
      isRecurring: activityListings.isRecurring,
      recurringSchedule: activityListings.recurringSchedule,
      checkInCode: activityListings.checkInCode,
      totalReferrals: activityListings.totalReferrals,
      priceCents: activityListings.priceCents,
      hasTickets: activityListings.hasTickets,
      imageEmoji: activityListings.imageEmoji,
      isPublicAccess: activityListings.isPublicAccess,
      accessNotes: activityListings.accessNotes,
      isSponsored: activityListings.isSponsored,
      isActive: activityListings.isActive,
      createdAt: activityListings.createdAt,
      venueName: venuePartners.name,
      venueCity: venuePartners.city,
      venueAddress: venuePartners.address,
      venueLat: venuePartners.latitude,
      venueLng: venuePartners.longitude,
      venuePhone: venuePartners.phone,
      venueWebsite: venuePartners.website,
      venueIsPublicAccess: venuePartners.isPublicAccess,
      venueAccessNotes: venuePartners.accessNotes,
      venueIsLocallyOwned: venuePartners.isLocallyOwned,
      venueOwnershipNote: venuePartners.ownershipNote,
    })
    .from(activityListings)
    .leftJoin(venuePartners, eq(activityListings.venueId, venuePartners.id))
    .where(eq(activityListings.isActive, true))
    .orderBy(desc(activityListings.isSponsored), desc(activityListings.createdAt))
    .limit(200);

  const sponsoredActivityIds = new Set(await getActiveSponsoredActivityIds());
  let filtered = rows.map((row) => ({
    ...row,
    isSponsored: row.isSponsored || sponsoredActivityIds.has(row.id),
  }));

  // GPS is authoritative when available; city is the fallback for users without coordinates.
  if (geo?.lat !== undefined && geo.lng !== undefined) {
    const radiusMiles = geo.radiusMiles ?? 25;
    filtered = filtered.filter((row) => {
      if (row.venueLat === null || row.venueLng === null) return false;
      return haversineDistanceKm(geo.lat!, geo.lng!, Number(row.venueLat), Number(row.venueLng)) <= radiusMiles * 1.60934;
    });
  } else if (city && city.trim()) {
    const cityLower = city.toLowerCase();
    filtered = filtered.filter(r => {
      if (!r.venueCity) return false;
      const vc = r.venueCity.toLowerCase();
      return vc.includes(cityLower) || cityLower.includes(vc);
    });
    // Keep the city-specific feed honest; do not silently replace it with another city.
  }

  if (category && category !== "all") {
    filtered = filtered.filter(r => r.category === category);
  }

  const uniqueRows = Array.from(
    filtered
    .sort((left, right) => Number(right.isSponsored) - Number(left.isSponsored) || Number(right.createdAt) - Number(left.createdAt))
    .reduce((unique, row) => {
      const key = [
        row.venueId,
        row.category,
        row.title.trim().toLowerCase(),
        row.eventDate?.getTime() ?? "recurring",
        row.recurringSchedule?.trim().toLowerCase() ?? "",
      ].join("|");
      if (!unique.has(key)) unique.set(key, row);
      return unique;
    }, new Map<string, typeof filtered[number]>())
    .values(),
  );

  return uniqueRows
    .slice(0, 80)
    .map((row) => ({
      ...row,
      distanceMiles: geo?.lat !== undefined && geo.lng !== undefined && row.venueLat !== null && row.venueLng !== null
        ? haversineDistanceKm(geo.lat, geo.lng, Number(row.venueLat), Number(row.venueLng)) / 1.60934
        : null,
    }));
}

export async function getActivityMarketplaceCategoryCounts(city?: string) {
  const db = await getDb();
  if (!db) return {} as Record<string, number>;
  const rows = await db
    .select({
      venueId: activityListings.venueId,
      category: activityListings.category,
      title: activityListings.title,
      eventDate: activityListings.eventDate,
      recurringSchedule: activityListings.recurringSchedule,
      venueCity: venuePartners.city,
    })
    .from(activityListings)
    .leftJoin(venuePartners, eq(activityListings.venueId, venuePartners.id))
    .where(eq(activityListings.isActive, true));
  const normalizedCity = city?.trim().toLowerCase();
  const seen = new Set<string>();
  return rows.reduce<Record<string, number>>((counts, row) => {
    if (!row.category) return counts;
    if (normalizedCity && row.venueCity?.trim().toLowerCase() !== normalizedCity) return counts;
    const key = [
      row.venueId,
      row.category,
      row.title.trim().toLowerCase(),
      row.eventDate?.getTime() ?? "recurring",
      row.recurringSchedule?.trim().toLowerCase() ?? "",
    ].join("|");
    if (seen.has(key)) return counts;
    seen.add(key);
    counts[row.category] = (counts[row.category] ?? 0) + 1;
    return counts;
  }, {});
}

export async function getActivityById(activityId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(activityListings).where(eq(activityListings.id, activityId)).limit(1);
  return result[0] ?? null;
}

export async function createActivityListing(data: typeof activityListings.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(activityListings).values(data);
  const result = await db.select().from(activityListings).orderBy(desc(activityListings.createdAt)).limit(1);
  return result[0] ?? null;
}

export async function rsvpToActivity(activityId: number, userId: number, matchId?: number) {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(activityRsvps)
    .where(and(eq(activityRsvps.activityId, activityId), eq(activityRsvps.userId, userId))).limit(1);
  if (existing[0]) return existing[0];
  await db.insert(activityRsvps).values({ activityId, userId, matchId, status: "going" });
  const result = await db.select().from(activityRsvps)
    .where(and(eq(activityRsvps.activityId, activityId), eq(activityRsvps.userId, userId))).limit(1);
  return result[0] ?? null;
}

export async function getActivityBookmarksForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ activityId: activityBookmarks.activityId })
    .from(activityBookmarks)
    .where(eq(activityBookmarks.userId, userId));
  return rows.map((row) => row.activityId);
}

export async function getSavedActivityEventsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: activityListings.id,
    title: activityListings.title,
    category: activityListings.category,
    eventDate: activityListings.eventDate,
    isRecurring: activityListings.isRecurring,
    recurringSchedule: activityListings.recurringSchedule,
    imageEmoji: activityListings.imageEmoji,
    priceCents: activityListings.priceCents,
    isActive: activityListings.isActive,
    savedAt: activityBookmarks.createdAt,
  })
    .from(activityBookmarks)
    .innerJoin(activityListings, eq(activityBookmarks.activityId, activityListings.id))
    .where(eq(activityBookmarks.userId, userId));

  return selectCurrentSavedActivityEvents(rows).slice(0, 6);
}

export async function toggleActivityBookmark(activityId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const existing = await db.select({ id: activityBookmarks.id })
    .from(activityBookmarks)
    .where(and(eq(activityBookmarks.activityId, activityId), eq(activityBookmarks.userId, userId)))
    .limit(1);
  if (existing[0]) {
    await db.delete(activityBookmarks).where(eq(activityBookmarks.id, existing[0].id));
    return { bookmarked: false };
  }
  await db.insert(activityBookmarks).values({ activityId, userId });
  return { bookmarked: true };
}

export async function getRsvpsForActivity(activityId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(activityRsvps).where(eq(activityRsvps.activityId, activityId));
}

export async function checkInToActivity(activityId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(activityRsvps)
    .set({ checkedIn: true, checkedInAt: new Date() })
    .where(and(eq(activityRsvps.activityId, activityId), eq(activityRsvps.userId, userId)));
  await recordReferralVisit(activityId);
}

// ─── Community Groups ─────────────────────────────────────────────────────────

export async function getCommunityGroups(city?: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(communityGroups)
    .where(eq(communityGroups.isPublic, true))
    .orderBy(desc(communityGroups.createdAt))
    .limit(50);
}

export async function createCommunityGroup(data: typeof communityGroups.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(communityGroups).values(data);
  const result = await db.select().from(communityGroups).orderBy(desc(communityGroups.createdAt)).limit(1);
  return result[0] ?? null;
}

export async function joinCommunityGroup(groupId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(communityGroupMembers)
    .where(and(eq(communityGroupMembers.groupId, groupId), eq(communityGroupMembers.userId, userId))).limit(1);
  if (!existing[0]) {
    await db.insert(communityGroupMembers).values({ groupId, userId, role: "member" });
  }
}

export async function getGroupMembers(groupId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(communityGroupMembers).where(eq(communityGroupMembers.groupId, groupId));
}

// ─── Bookings (marketplace) ─────────────────────────────────────────────────────

function genCode(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function createBooking(data: typeof bookings.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(bookings).values(data);
  const result = await db.select().from(bookings)
    .where(and(eq(bookings.userId, data.userId), eq(bookings.confirmationCode, data.confirmationCode)))
    .limit(1);
  return result[0] ?? null;
}

export async function getBookingsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bookings)
    .where(eq(bookings.userId, userId))
    .orderBy(desc(bookings.createdAt));
}

export async function getBookingById(bookingId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  return result[0] ?? null;
}

export async function getBookingByStripeCheckoutSessionId(stripeCheckoutSessionId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(bookings)
    .where(eq(bookings.stripeCheckoutSessionId, stripeCheckoutSessionId))
    .limit(1);
  return result[0] ?? null;
}

export async function cancelBooking(bookingId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(bookings).set({ status: "cancelled" })
    .where(and(eq(bookings.id, bookingId), eq(bookings.userId, userId)));
}

export async function requestBookingReschedule(
  bookingId: number,
  userId: number,
  requestedFor: Date,
  note?: string,
) {
  const db = await getDb();
  if (!db) return;
  await db.update(bookings).set({
    rescheduleRequestedFor: requestedFor,
    rescheduleRequestNote: note?.trim() || null,
    rescheduleRequestedAt: new Date(),
  }).where(and(eq(bookings.id, bookingId), eq(bookings.userId, userId), eq(bookings.status, "confirmed")));
}

export async function checkInBooking(bookingId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(bookings).set({ status: "checked_in", checkedInAt: new Date() })
    .where(and(eq(bookings.id, bookingId), eq(bookings.userId, userId), eq(bookings.status, "confirmed")));
}

export async function getBookingsForVenue(venueId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bookings)
    .where(eq(bookings.venueId, venueId))
    .orderBy(desc(bookings.createdAt));
}

export { genCode };

// ─── Concierge Requests ─────────────────────────────────────────────────────────

export async function createConciergeRequest(data: typeof conciergeRequests.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(conciergeRequests).values(data);
  const result = await db.select().from(conciergeRequests)
    .where(eq(conciergeRequests.userId, data.userId))
    .orderBy(desc(conciergeRequests.createdAt))
    .limit(1);
  return result[0] ?? null;
}

export async function updateConciergeRequest(id: number, data: Partial<typeof conciergeRequests.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(conciergeRequests).set(data).where(eq(conciergeRequests.id, id));
}

export async function getConciergeRequestById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(conciergeRequests).where(eq(conciergeRequests.id, id)).limit(1);
  return result[0] ?? null;
}

export async function getConciergeRequestsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(conciergeRequests)
    .where(eq(conciergeRequests.userId, userId))
    .orderBy(desc(conciergeRequests.createdAt));
}

// ─── Vendor Portal ──────────────────────────────────────────────────────────────

export async function getVenuesByOwner(ownerUserId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(venuePartners)
    .where(eq(venuePartners.ownerUserId, ownerUserId))
    .orderBy(desc(venuePartners.createdAt));
}

export async function getPartnerImpactForOwner(ownerUserId: number) {
  const venues = await getVenuesByOwner(ownerUserId);
  const resultsWithSources = await Promise.all(venues.map(async (venue) => {
    const [listings, venueBookings] = await Promise.all([
      getListingsByVenue(venue.id),
      getBookingsForVenue(venue.id),
    ]);
    const rsvpGroups = await Promise.all(listings.map((listing) => getRsvpsForActivity(listing.id)));
    return { venue, metrics: summarizePartnerImpact(venueBookings, rsvpGroups.flat()), venueBookings, rsvps: rsvpGroups.flat() };
  }));
  const results = resultsWithSources.map(({ venue, metrics }) => ({ ...venue, metrics }));

  const totals = results.reduce((aggregate, venue) => ({
    bookingCount: aggregate.bookingCount + venue.metrics.bookingCount,
    bookedSeats: aggregate.bookedSeats + venue.metrics.bookedSeats,
    attendanceSignals: aggregate.attendanceSignals + venue.metrics.attendanceSignals,
    rsvpIntent: aggregate.rsvpIntent + venue.metrics.rsvpIntent,
    rsvpCheckIns: aggregate.rsvpCheckIns + venue.metrics.rsvpCheckIns,
    grossBookingValueCents: aggregate.grossBookingValueCents + venue.metrics.grossBookingValueCents,
    platformCommissionCents: aggregate.platformCommissionCents + venue.metrics.platformCommissionCents,
  }), { bookingCount: 0, bookedSeats: 0, attendanceSignals: 0, rsvpIntent: 0, rsvpCheckIns: 0, grossBookingValueCents: 0, platformCommissionCents: 0 });

  return {
    venues: results,
    totals,
    trend: buildPartnerImpactTrend(resultsWithSources.flatMap((result) => result.venueBookings), resultsWithSources.flatMap((result) => result.rsvps)),
  };
}

export async function getPartnerImpactTrendForOwner(ownerUserId: number, start: Date, end: Date) {
  const venues = await getVenuesByOwner(ownerUserId);
  const sources = await Promise.all(venues.map(async (venue) => {
    const [listings, venueBookings] = await Promise.all([getListingsByVenue(venue.id), getBookingsForVenue(venue.id)]);
    const rsvpGroups = await Promise.all(listings.map((listing) => getRsvpsForActivity(listing.id)));
    return { venueBookings, rsvps: rsvpGroups.flat() };
  }));
  return buildPartnerImpactTrendForRange(
    sources.flatMap((source) => source.venueBookings),
    sources.flatMap((source) => source.rsvps),
    start,
    end,
  );
}

export async function updateVenuePartner(venueId: number, data: Partial<typeof venuePartners.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(venuePartners).set(data).where(eq(venuePartners.id, venueId));
}

export async function getListingsByVenue(venueId: number) {
  const db = await getDb();
  if (!db) return [];
  const listings = await db.select().from(activityListings)
    .where(eq(activityListings.venueId, venueId))
    .orderBy(desc(activityListings.createdAt));
  const placements = await getSponsoredPlacementsForActivities(listings.map((listing) => listing.id));
  const placementByActivity = new Map(placements.map((placement) => [placement.activityId, placement]));
  return listings.map((listing) => ({
    ...listing,
    sponsorPlacement: placementByActivity.get(listing.id) ?? null,
    isSponsored: listing.isSponsored || isActiveSponsoredPlacement(placementByActivity.get(listing.id) ?? { status: "expired", endsAt: null }),
  }));
}

export async function getListingsForOwner(ownerUserId: number) {
  const db = await getDb();
  if (!db) return [];
  const venues = await getVenuesByOwner(ownerUserId);
  if (venues.length === 0) return [];
  const venueIds = venues.map(v => v.id);
  const all = await db.select().from(activityListings).orderBy(desc(activityListings.createdAt));
  return all.filter(a => venueIds.includes(a.venueId));
}

export async function updateActivityListing(id: number, data: Partial<typeof activityListings.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(activityListings).set(data).where(eq(activityListings.id, id));
}

// ─── Paid Sponsored Placement ─────────────────────────────────────────────────

export async function getSponsoredPlacementEligibleListing(activityId: number, ownerUserId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({ listing: activityListings, venue: venuePartners })
    .from(activityListings)
    .innerJoin(venuePartners, eq(activityListings.venueId, venuePartners.id))
    .where(and(eq(activityListings.id, activityId), eq(venuePartners.ownerUserId, ownerUserId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createSponsoredPlacement(data: {
  activityId: number;
  venueId: number;
  purchaserUserId: number;
  packageCode: "week" | "month";
  amountCents: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.insert(sponsoredPlacements).values({ ...data, status: "checkout_pending" });
  const rows = await db.select().from(sponsoredPlacements)
    .where(and(eq(sponsoredPlacements.activityId, data.activityId), eq(sponsoredPlacements.purchaserUserId, data.purchaserUserId)))
    .orderBy(desc(sponsoredPlacements.createdAt)).limit(1);
  return rows[0] ?? null;
}

export async function attachSponsoredPlacementCheckoutSession(placementId: number, purchaserUserId: number, sessionId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.update(sponsoredPlacements)
    .set({ stripeCheckoutSessionId: sessionId })
    .where(and(eq(sponsoredPlacements.id, placementId), eq(sponsoredPlacements.purchaserUserId, purchaserUserId), eq(sponsoredPlacements.status, "checkout_pending")));
}

export async function activateSponsoredPlacementFromCheckout(input: { placementId: number; sessionId: string; paymentIntentId?: string | null; startsAt: Date; endsAt: Date }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const existing = await db.select().from(sponsoredPlacements).where(eq(sponsoredPlacements.id, input.placementId)).limit(1);
  if (!existing[0]) throw new Error("Sponsored placement not found");
  if (existing[0].status === "active") return existing[0];
  await db.update(sponsoredPlacements).set({
    status: "active",
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    stripeCheckoutSessionId: input.sessionId,
    stripePaymentIntentId: input.paymentIntentId ?? null,
  }).where(eq(sponsoredPlacements.id, input.placementId));
  const active = await db.select().from(sponsoredPlacements).where(eq(sponsoredPlacements.id, input.placementId)).limit(1);
  return active[0] ?? null;
}

export async function getSponsoredPlacementById(placementId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(sponsoredPlacements).where(eq(sponsoredPlacements.id, placementId)).limit(1);
  return rows[0] ?? null;
}

export async function getActiveSponsoredActivityIds() {
  const db = await getDb();
  if (!db) return [] as number[];
  const rows = await db.select({ activityId: sponsoredPlacements.activityId }).from(sponsoredPlacements)
    .where(and(eq(sponsoredPlacements.status, "active"), gt(sponsoredPlacements.endsAt, new Date())));
  return rows.map((row) => row.activityId);
}

export async function getSponsoredPlacementsForActivities(activityIds: number[]) {
  const db = await getDb();
  if (!db || activityIds.length === 0) return [];
  return db.select().from(sponsoredPlacements)
    .where(inArray(sponsoredPlacements.activityId, activityIds))
    .orderBy(desc(sponsoredPlacements.createdAt));
}

type SponsoredMetricType = "view" | "click" | "sign_up";

function getMetricDay(value = new Date()) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export async function recordSponsoredPlacementMetric(input: {
  activityId: number;
  userId: number;
  eventType: SponsoredMetricType;
}) {
  const db = await getDb();
  if (!db) return null;
  const [placement] = await db.select().from(sponsoredPlacements).where(and(
    eq(sponsoredPlacements.activityId, input.activityId),
    eq(sponsoredPlacements.status, "active"),
    gt(sponsoredPlacements.endsAt, new Date()),
  )).orderBy(desc(sponsoredPlacements.createdAt)).limit(1);
  if (!placement) return null;

  const eventDay = getMetricDay();
  const existing = await db.select({ id: sponsoredPlacementEvents.id }).from(sponsoredPlacementEvents).where(and(
    eq(sponsoredPlacementEvents.placementId, placement.id),
    eq(sponsoredPlacementEvents.userId, input.userId),
    eq(sponsoredPlacementEvents.eventType, input.eventType),
    eq(sponsoredPlacementEvents.eventDay, eventDay),
  )).limit(1);
  if (existing[0]) return placement.id;

  await db.insert(sponsoredPlacementEvents).values({
    placementId: placement.id,
    activityId: input.activityId,
    userId: input.userId,
    eventType: input.eventType,
    eventDay,
  });
  return placement.id;
}

export async function getSponsoredPlacementPerformanceForOwner(ownerUserId: number) {
  const db = await getDb();
  if (!db) return { summary: { views: 0, clicks: 0, signUps: 0, clickThroughRate: 0, signUpRate: 0 }, placements: [] as Array<any> };
  const venues = await getVenuesByOwner(ownerUserId);
  const venueIds = venues.map((venue) => venue.id);
  if (venueIds.length === 0) return { summary: { views: 0, clicks: 0, signUps: 0, clickThroughRate: 0, signUpRate: 0 }, placements: [] as Array<any> };

  const placements = await db.select().from(sponsoredPlacements).where(inArray(sponsoredPlacements.venueId, venueIds)).orderBy(desc(sponsoredPlacements.createdAt));
  if (placements.length === 0) return { summary: { views: 0, clicks: 0, signUps: 0, clickThroughRate: 0, signUpRate: 0 }, placements: [] as Array<any> };
  const placementIds = placements.map((placement) => placement.id);
  const activityIds = placements.map((placement) => placement.activityId);
  const [events, listings] = await Promise.all([
    db.select().from(sponsoredPlacementEvents).where(inArray(sponsoredPlacementEvents.placementId, placementIds)),
    db.select().from(activityListings).where(inArray(activityListings.id, activityIds)),
  ]);
  const listingById = new Map(listings.map((listing) => [listing.id, listing]));
  const summary = { views: 0, clicks: 0, signUps: 0 };
  const byPlacement = new Map<number, { views: number; clicks: number; signUps: number }>();
  for (const placement of placements) byPlacement.set(placement.id, { views: 0, clicks: 0, signUps: 0 });
  for (const event of events) {
    const row = byPlacement.get(event.placementId);
    if (!row) continue;
    if (event.eventType === "view") { row.views += 1; summary.views += 1; }
    if (event.eventType === "click") { row.clicks += 1; summary.clicks += 1; }
    if (event.eventType === "sign_up") { row.signUps += 1; summary.signUps += 1; }
  }
  return {
    summary: getSponsoredPerformanceRates(summary),
    placements: placements.map((placement) => ({
      ...placement,
      activityTitle: listingById.get(placement.activityId)?.title ?? "Activity",
      ...getSponsoredPerformanceRates(byPlacement.get(placement.id) ?? { views: 0, clicks: 0, signUps: 0 }),
    })),
  };
}

export async function getSponsoredAudienceSummaryForOwner(ownerUserId: number) {
  const empty = buildSponsoredAudienceSummary({ signUpCount: 0, birthDates: [], interestCategories: [] });
  const db = await getDb();
  if (!db) return empty;
  const venues = await getVenuesByOwner(ownerUserId);
  const venueIds = venues.map((venue) => venue.id);
  if (venueIds.length === 0) return empty;
  const placements = await db.select().from(sponsoredPlacements).where(inArray(sponsoredPlacements.venueId, venueIds));
  const placementIds = placements.map((placement) => placement.id);
  if (placementIds.length === 0) return empty;

  const signUpEvents = await db.select().from(sponsoredPlacementEvents).where(and(
    inArray(sponsoredPlacementEvents.placementId, placementIds),
    eq(sponsoredPlacementEvents.eventType, "sign_up"),
  ));
  const signUpUserIds = Array.from(new Set(signUpEvents.map((event) => event.userId)));
  if (signUpUserIds.length < SPONSORED_AUDIENCE_MIN_GROUP_SIZE) {
    return buildSponsoredAudienceSummary({ signUpCount: signUpUserIds.length, birthDates: [], interestCategories: [] });
  }

  const [profiles, rsvpRows, listings] = await Promise.all([
    db.select({ userId: userProfiles.userId, birthDate: userProfiles.birthDate }).from(userProfiles).where(inArray(userProfiles.userId, signUpUserIds)),
    db.select({ userId: activityRsvps.userId, category: activityListings.category })
      .from(activityRsvps)
      .innerJoin(activityListings, eq(activityRsvps.activityId, activityListings.id))
      .where(and(inArray(activityRsvps.userId, signUpUserIds), eq(activityRsvps.status, "going"))),
    db.select({ id: activityListings.id, category: activityListings.category }).from(activityListings).where(inArray(activityListings.id, placements.map((placement) => placement.activityId))),
  ]);
  const categoryByActivityId = new Map(listings.map((listing) => [listing.id, listing.category]));
  const placementById = new Map(placements.map((placement) => [placement.id, placement]));
  const sponsoredCategories = signUpEvents.flatMap((event) => {
    const activityId = placementById.get(event.placementId)?.activityId;
    const category = activityId ? categoryByActivityId.get(activityId) : undefined;
    return category ? [category] : [];
  });
  return buildSponsoredAudienceSummary({
    signUpCount: signUpUserIds.length,
    birthDates: profiles.map((profile) => profile.birthDate),
    interestCategories: [...sponsoredCategories, ...rsvpRows.map((rsvp) => rsvp.category)],
  });
}

// ─── Couples Network ────────────────────────────────────────────────────────────

export async function getCoupleLinkForUser(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(coupleLinks)
    .where(and(eq(coupleLinks.userId, userId), eq(coupleLinks.isActive, true)))
    .limit(1);
  return result[0] ?? null;
}

export async function upsertCoupleLink(userId: number, data: Partial<typeof coupleLinks.$inferInsert>) {
  const db = await getDb();
  if (!db) return null;
  const existing = await getCoupleLinkForUser(userId);
  if (existing) {
    await db.update(coupleLinks).set(data).where(eq(coupleLinks.id, existing.id));
    return getCoupleLinkForUser(userId);
  }
  await db.insert(coupleLinks).values({
    userId,
    partnerName: data.partnerName ?? "My Partner",
    ...data,
  });
  return getCoupleLinkForUser(userId);
}

export async function getAllCoupleLinks() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(coupleLinks).where(eq(coupleLinks.isActive, true));
}

export async function existingCoupleMatch(user1Id: number, user2Id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(coupleMatches)
    .where(or(
      and(eq(coupleMatches.couple1UserId, user1Id), eq(coupleMatches.couple2UserId, user2Id)),
      and(eq(coupleMatches.couple1UserId, user2Id), eq(coupleMatches.couple2UserId, user1Id)),
    ))
    .limit(1);
  return result[0] ?? null;
}

export async function createCoupleMatch(user1Id: number, user2Id: number, score: number, reason: string) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(coupleMatches).values({
    couple1UserId: user1Id, couple2UserId: user2Id, compatibilityScore: score, compatibilityReason: reason,
  });
  const result = await db.select().from(coupleMatches)
    .where(and(eq(coupleMatches.couple1UserId, user1Id), eq(coupleMatches.couple2UserId, user2Id)))
    .orderBy(desc(coupleMatches.createdAt))
    .limit(1);
  return result[0] ?? null;
}

export async function getCoupleMatchesForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(coupleMatches)
    .where(or(eq(coupleMatches.couple1UserId, userId), eq(coupleMatches.couple2UserId, userId)))
    .orderBy(desc(coupleMatches.createdAt));
}

// ─── Would You Rather helpers (low AI cost) ─────────────────────────────────────
export async function getWyrAnsweredQuestionIds(userId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ questionId: wouldYouRatherAnswers.questionId })
    .from(wouldYouRatherAnswers)
    .where(eq(wouldYouRatherAnswers.userId, userId));
  return rows.map((r) => r.questionId);
}

export async function getWyrQuestions(category?: string) {
  const db = await getDb();
  if (!db) return [];
  if (category && category !== "all") {
    return db
      .select()
      .from(wouldYouRatherQuestions)
      .where(
        and(
          eq(wouldYouRatherQuestions.isActive, true),
          eq(wouldYouRatherQuestions.category, category as never),
        ),
      );
  }
  return db
    .select()
    .from(wouldYouRatherQuestions)
    .where(eq(wouldYouRatherQuestions.isActive, true));
}

export async function getWyrQuestionById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(wouldYouRatherQuestions)
    .where(eq(wouldYouRatherQuestions.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function recordWyrAnswer(userId: number, questionId: number, choice: "A" | "B") {
  const db = await getDb();
  if (!db) return;
  // One answer per user per question: remove any prior answer, then insert.
  await db
    .delete(wouldYouRatherAnswers)
    .where(
      and(
        eq(wouldYouRatherAnswers.userId, userId),
        eq(wouldYouRatherAnswers.questionId, questionId),
      ),
    );
  await db.insert(wouldYouRatherAnswers).values({ userId, questionId, choice });
}

export async function getWyrSplit(questionId: number): Promise<{ a: number; b: number }> {
  const db = await getDb();
  if (!db) return { a: 0, b: 0 };
  const rows = await db
    .select({ choice: wouldYouRatherAnswers.choice })
    .from(wouldYouRatherAnswers)
    .where(eq(wouldYouRatherAnswers.questionId, questionId));
  let a = 0;
  let b = 0;
  for (const r of rows) {
    if (r.choice === "A") a += 1;
    else b += 1;
  }
  return { a, b };
}

export async function getWyrAnswerCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ id: wouldYouRatherAnswers.id })
    .from(wouldYouRatherAnswers)
    .where(eq(wouldYouRatherAnswers.userId, userId));
  return rows.length;
}

/**
 * Returns only answer-presence information for a challenge. The participant
 * router exposes a member's own question IDs and the partner's aggregate count
 * so one member never receives the other's private choices.
 */
export async function getWyrChallengeAnswerProgress(
  challengerId: number,
  challengedId: number,
  questionIds: number[],
) {
  const challengeQuestionIds = new Set(questionIds);
  const [challengerAnsweredQuestionIds, challengedAnsweredQuestionIds] = await Promise.all([
    getWyrAnsweredQuestionIds(challengerId),
    getWyrAnsweredQuestionIds(challengedId),
  ]);

  return {
    challengerAnsweredQuestionIds: challengerAnsweredQuestionIds.filter((questionId) => challengeQuestionIds.has(questionId)),
    challengedAnsweredQuestionIds: challengedAnsweredQuestionIds.filter((questionId) => challengeQuestionIds.has(questionId)),
  };
}

// ─── Admin Stats ──────────────────────────────────────────────────────────────

export async function getAdminStats() {
  const db = await getDb();
  if (!db) return { totalUsers: 0, newThisWeek: 0, verifiedCount: 0, interviewedCount: 0, totalMatches: 0, totalMessages: 0 };

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [allUsers, newUsers, allMatches, allMessages, allInterviews] = await Promise.all([
    db.select({ id: users.id, role: users.role }).from(users),
    db.select({ id: users.id }).from(users).where(sql`${users.createdAt} >= ${oneWeekAgo}`),
    db.select({ id: matches.id }).from(matches),
    db.select({ id: chatMessages.id }).from(chatMessages),
    db.select({ id: interviewSessions.id, userId: interviewSessions.userId })
      .from(interviewSessions)
      .where(sql`${interviewSessions.completedAt} IS NOT NULL`),
  ]);

  const verifiedProfiles = await db
    .select({ id: userProfiles.id })
    .from(userProfiles)
    .where(eq(userProfiles.isVerified, true));

  return {
    totalUsers: allUsers.length,
    newThisWeek: newUsers.length,
    verifiedCount: verifiedProfiles.length,
    interviewedCount: allInterviews.length,
    totalMatches: allMatches.length,
    totalMessages: allMessages.length,
  };
}

export async function searchUsers(query: string, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  const baseQuery = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      adminPromotedAt: users.adminPromotedAt,
      lastSignedIn: users.lastSignedIn,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  if (!query) return baseQuery;
  const like = `%${query}%`;
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      adminPromotedAt: users.adminPromotedAt,
      lastSignedIn: users.lastSignedIn,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(or(sql`${users.name} LIKE ${like}`, sql`${users.email} LIKE ${like}`))
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getUserWithProfile(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u) return null;
  const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  const matchCount = await db.select({ id: matches.id }).from(matches)
    .where(or(eq(matches.user1Id, userId), eq(matches.user2Id, userId)));
  const msgCount = await db.select({ id: chatMessages.id }).from(chatMessages)
    .where(eq(chatMessages.senderId, userId));
  return { user: u, profile: profile ?? null, matchCount: matchCount.length, messageCount: msgCount.length };
}

// ─── WYR 2-Player Challenges ──────────────────────────────────────────────────

export async function createWyrChallenge(
  challengerId: number,
  challengedId: number,
  questionIds: number[],
  matchId?: number
) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(wyrChallenges).values({
    challengerId,
    challengedId,
    questionIds,
    matchId: matchId ?? null,
    status: "pending",
  });
  const [row] = await db
    .select()
    .from(wyrChallenges)
    .where(and(
      eq(wyrChallenges.challengerId, challengerId),
      eq(wyrChallenges.challengedId, challengedId),
      matchId === undefined ? sql`${wyrChallenges.matchId} IS NULL` : eq(wyrChallenges.matchId, matchId),
    ))
    .orderBy(desc(wyrChallenges.id))
    .limit(1);
  return row ?? null;
}

export async function getWyrChallenge(challengeId: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(wyrChallenges).where(eq(wyrChallenges.id, challengeId)).limit(1);
  return row ?? null;
}

export async function getWyrChallengesForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(wyrChallenges)
    .where(or(eq(wyrChallenges.challengerId, userId), eq(wyrChallenges.challengedId, userId)))
    .orderBy(desc(wyrChallenges.createdAt));
}

export async function updateWyrChallengeStatus(
  challengeId: number,
  status: "pending" | "active" | "completed",
  compatibilityPct?: number
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(wyrChallenges)
    .set({
      status,
      ...(compatibilityPct !== undefined ? { compatibilityPct } : {}),
      ...(status === "completed" ? { completedAt: new Date() } : {}),
    })
    .where(eq(wyrChallenges.id, challengeId));
}

/** Compare answers between two users for a set of question IDs and return a compatibility % */
export async function computeWyrCompatibility(
  userId1: number,
  userId2: number,
  questionIds: number[]
): Promise<number> {
  if (questionIds.length === 0) return 0;
  const db = await getDb();
  if (!db) return 0;

  const answers1 = await db
    .select()
    .from(wouldYouRatherAnswers)
    .where(and(eq(wouldYouRatherAnswers.userId, userId1), sql`${wouldYouRatherAnswers.questionId} IN (${sql.join(questionIds.map((id) => sql`${id}`), sql`, `)})`));
  const answers2 = await db
    .select()
    .from(wouldYouRatherAnswers)
    .where(and(eq(wouldYouRatherAnswers.userId, userId2), sql`${wouldYouRatherAnswers.questionId} IN (${sql.join(questionIds.map((id) => sql`${id}`), sql`, `)})`));

  const map1 = new Map(answers1.map((a) => [a.questionId, a.choice]));
  const map2 = new Map(answers2.map((a) => [a.questionId, a.choice]));

  let matches = 0;
  let compared = 0;
  for (const qid of questionIds) {
    const c1 = map1.get(qid);
    const c2 = map2.get(qid);
    if (c1 && c2) {
      compared++;
      if (c1 === c2) matches++;
    }
  }
  if (compared === 0) return 0;
  return Math.round((matches / compared) * 100);
}

// ─── Campus Growth Engine ─────────────────────────────────────────────────────

export async function getCampusById(campusId: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(campuses).where(eq(campuses.id, campusId)).limit(1);
  return row ?? null;
}

export async function getCampusBySlug(slug: string) {
  const db = await getDb();
  if (!db) return null;
  // Match by lowercased name or emailDomain
  const all = await db.select().from(campuses);
  return all.find(
    (c) => c.name.toLowerCase().replace(/\s+/g, "-") === slug || c.emailDomains === slug
  ) ?? null;
}

export async function getCampusStats(campusId: number) {
  const db = await getDb();
  if (!db) return { total: 0, threshold: 100, isLive: false };
  const [campus] = await db.select().from(campuses).where(eq(campuses.id, campusId)).limit(1);
  if (!campus) return { total: 0, threshold: 100, isLive: false };

  const [countRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(userProfiles)
    .where(eq(userProfiles.campusId, campusId));

  const total = Number(countRow?.count ?? 0);
  return {
    campusId,
    name: campus.name,
    city: campus.city,
    state: campus.state,
    total,
    threshold: campus.launchThreshold,
    isLive: campus.isLive,
    pct: Math.min(100, Math.round((total / campus.launchThreshold) * 100)),
  };
}

export async function getCampusLeaderboard(campusId: number, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  // Count referrals per inviter for this campus
  const rows = await db
    .select({
      inviterUserId: referrals.inviterUserId,
      referralCount: sql<number>`COUNT(*)`,
    })
    .from(referrals)
    .where(and(eq(referrals.campusId, campusId), eq(referrals.status, "joined")))
    .groupBy(referrals.inviterUserId)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(limit);

  // Enrich with profile info
  const enriched = await Promise.all(
    rows.map(async (r) => {
      const profile = await getProfileByUserId(r.inviterUserId);
      return {
        userId: r.inviterUserId,
        referralCount: Number(r.referralCount),
        displayName: profile?.displayName ?? "Anonymous",
        avatarEmoji: profile?.avatarEmoji ?? "😊",
        avatarColor: profile?.avatarColor ?? "#f97316",
        isAmbassador: profile?.isAmbassador ?? false,
      };
    })
  );
  return enriched;
}

export async function generateInviteCode(userId: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Check if user already has a code
  const [profile] = await db.select({ inviteCode: userProfiles.inviteCode }).from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  if (profile?.inviteCode) return profile.inviteCode;
  // Generate a short unique code
  const code = `JP-${userId}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  await db.update(userProfiles).set({ inviteCode: code }).where(eq(userProfiles.userId, userId));
  return code;
}

export async function recordReferral(inviteCode: string, inviteeUserId: number) {
  const db = await getDb();
  if (!db) return null;
  // Find the inviter by invite code
  const [inviterProfile] = await db.select().from(userProfiles).where(eq(userProfiles.inviteCode, inviteCode)).limit(1);
  if (!inviterProfile) return null;
  // Avoid duplicate referral records
  const existing = await db
    .select()
    .from(referrals)
    .where(and(eq(referrals.inviterUserId, inviterProfile.userId), eq(referrals.inviteeUserId, inviteeUserId)))
    .limit(1);
  if (existing.length > 0) return existing[0];

  await db.insert(referrals).values({
    inviterUserId: inviterProfile.userId,
    inviteeUserId,
    inviteCode,
    campusId: inviterProfile.campusId ?? undefined,
    status: "joined",
  });
  // Promote to ambassador if they now have >= 5 referrals
  const [countRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(referrals)
    .where(and(eq(referrals.inviterUserId, inviterProfile.userId), eq(referrals.status, "joined")));
  if (Number(countRow?.count ?? 0) >= 5) {
    await db.update(userProfiles).set({ isAmbassador: true }).where(eq(userProfiles.userId, inviterProfile.userId));
  }
  return { success: true };
}

// ─── Email Auth Helpers ───────────────────────────────────────────────────────

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] ?? null;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0] ?? null;
}

export async function createEmailUser(data: {
  email: string;
  passwordHash: string;
  name: string;
  emailVerifyToken: string;
  emailVerifyExpires: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Use a unique openId for email-registered users
  const openId = `email_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  await db.insert(users).values({
    openId,
    email: data.email,
    name: data.name,
    loginMethod: "email",
    passwordHash: data.passwordHash,
    emailVerified: false,
    emailVerifyToken: data.emailVerifyToken,
    emailVerifyExpires: data.emailVerifyExpires,
    lastSignedIn: new Date(),
  });
  return getUserByEmail(data.email);
}

export async function verifyUserEmail(token: string) {
  const db = await getDb();
  if (!db) return null;
  const now = new Date();
  const result = await db
    .select()
    .from(users)
    .where(and(eq(users.emailVerifyToken, token)))
    .limit(1);
  const user = result[0];
  if (!user) return null;
  if (user.emailVerifyExpires && user.emailVerifyExpires < now) return null;
  await db
    .update(users)
    .set({ emailVerified: true, emailVerifyToken: null, emailVerifyExpires: null })
    .where(eq(users.id, user.id));
  return getUserByEmail(user.email!);
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

// ─── GPS Location Verification ───────────────────────────────────────────────

// Supported launch cities with center coords and radius in km
export const LAUNCH_CITIES: Record<string, { lat: number; lng: number; radiusKm: number; label: string }> = {
  "milwaukee": { lat: 43.0389, lng: -87.9065, radiusKm: 50, label: "Milwaukee, WI" },
  "waukesha": { lat: 43.0117, lng: -88.2315, radiusKm: 50, label: "Waukesha, WI" },
  "carroll": { lat: 43.0117, lng: -88.2315, radiusKm: 50, label: "Waukesha, WI (Carroll University)" },
};

export function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function checkGpsMatchesCity(
  lat: number,
  lng: number,
  claimedCity: string
): { match: boolean; distanceKm: number; cityLabel: string } {
  const key = claimedCity.toLowerCase().replace(/[^a-z]/g, "");
  // Try exact key first, then partial match
  const city =
    LAUNCH_CITIES[key] ??
    Object.entries(LAUNCH_CITIES).find(([k]) => key.includes(k) || k.includes(key))?.[1] ??
    LAUNCH_CITIES["milwaukee"]; // default to Milwaukee metro
  const distanceKm = haversineDistanceKm(lat, lng, city.lat, city.lng);
  return { match: distanceKm <= city.radiusKm, distanceKm, cityLabel: city.label };
}

export async function saveLocationVerification(
  userId: number,
  data: { lat: number; lng: number; city: string; verified: boolean }
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(userProfiles)
    .set({
      gpsVerifiedLat: String(data.lat),
      gpsVerifiedLng: String(data.lng),
      gpsVerifiedCity: data.city,
      gpsVerifiedAt: new Date(),
      locationVerified: data.verified,
      isVerified: data.verified, // also set the main isVerified flag
    })
    .where(eq(userProfiles.userId, userId));
}

// ─── Community Events ─────────────────────────────────────────────────────────

export async function getCommunityEvents(filters: {
  city?: string;
  category?: string;
  isFree?: boolean;
  limit?: number;
  lat?: number;
  lng?: number;
  radiusMiles?: number;
} = {}) {
  const db = await getDb();
  if (!db) return [];
  const currentEventCutoff = new Date();
  const conditions = [
    eq(communityEvents.isActive, true),
    or(
      gt(communityEvents.eventDate, currentEventCutoff),
      and(sql`${communityEvents.endDate} IS NOT NULL`, gt(communityEvents.endDate, currentEventCutoff)),
    ),
  ];

  // Radius-based filtering: if lat/lng provided, use Haversine formula
  // Otherwise fall back to city-name match
  if (filters.lat !== undefined && filters.lng !== undefined) {
    const radiusMiles = filters.radiusMiles ?? 90;
    const radiusKm = radiusMiles * 1.60934;
    // GPS-radius queries must only include events with coordinates. If a city is
    // explicitly supplied, older records without coordinates may remain as a
    // city-specific fallback; never use a global fallback for a GPS query.
    const missingCoordinateFallback = filters.city
      ? sql` OR (${communityEvents.lat} IS NULL AND ${communityEvents.city} = ${filters.city})`
      : sql``;
    conditions.push(
      sql`(
        (${communityEvents.lat} IS NOT NULL AND ${communityEvents.lng} IS NOT NULL AND
          6371 * 2 * ASIN(SQRT(
            POWER(SIN((RADIANS(${communityEvents.lat}) - RADIANS(${filters.lat})) / 2), 2) +
            COS(RADIANS(${filters.lat})) * COS(RADIANS(${communityEvents.lat})) *
            POWER(SIN((RADIANS(${communityEvents.lng}) - RADIANS(${filters.lng})) / 2), 2)
          )) <= ${radiusKm}
        )
        ${missingCoordinateFallback}
      )`
    );
  } else if (filters.city) {
    conditions.push(eq(communityEvents.city, filters.city));
  }

  if (filters.category && filters.category !== "all") {
    conditions.push(eq(communityEvents.category, filters.category as CommunityEvent["category"]));
  }
  if (filters.isFree !== undefined) conditions.push(eq(communityEvents.isFree, filters.isFree));
  const eventColumns = getTableColumns(communityEvents);
  const interestCount = sql<number>`(
    SELECT COUNT(*) FROM ${eventInterests}
    WHERE ${eventInterests.eventId} = ${communityEvents.id}
  )`.as("interestCount");
  return db
    .select({ ...eventColumns, interestCount })
    .from(communityEvents)
    .where(and(...conditions))
    .orderBy(communityEvents.eventDate)
    .limit(filters.limit ?? 100);
}

/**
 * Removes expired discovery rows only when no member RSVP, interest, saved plan,
 * proposal, or private event-introduction record references the event. This
 * preserves member history while keeping the discovery feed lean.
 */
export async function archiveExpiredUnreferencedCommunityEvents(cutoff: Date) {
  const db = await getDb();
  if (!db) return { archived: 0, preserved: 0 };

  const expired = await db
    .select({ id: communityEvents.id })
    .from(communityEvents)
    .where(lt(communityEvents.eventDate, cutoff));
  const expiredIds = expired.map((event) => event.id);
  if (expiredIds.length === 0) return { archived: 0, preserved: 0 };

  const [rsvps, interests, plans, proposals, introductions] = await Promise.all([
    db.select({ eventId: eventRsvps.eventId }).from(eventRsvps).where(inArray(eventRsvps.eventId, expiredIds)),
    db.select({ eventId: eventInterests.eventId }).from(eventInterests).where(inArray(eventInterests.eventId, expiredIds)),
    db.select({ eventId: todaysPlans.eventId }).from(todaysPlans).where(inArray(todaysPlans.eventId, expiredIds)),
    db.select({ eventId: eventProposals.eventId }).from(eventProposals).where(inArray(eventProposals.eventId, expiredIds)),
    db.select({ eventId: eventIntroductions.eventId }).from(eventIntroductions).where(inArray(eventIntroductions.eventId, expiredIds)),
  ]);

  const referencedIds = [
    ...rsvps.map((row) => row.eventId),
    ...interests.map((row) => row.eventId),
    ...plans.map((row) => row.eventId),
    ...proposals.map((row) => row.eventId),
    ...introductions.map((row) => row.eventId),
  ].filter((id): id is number => typeof id === "number");
  const archivableIds = getArchivableEventIds(expiredIds, referencedIds);

  if (archivableIds.length > 0) {
    await db.delete(communityEvents).where(inArray(communityEvents.id, archivableIds));
  }

  return { archived: archivableIds.length, preserved: expiredIds.length - archivableIds.length };
}

export async function getSallyEventSuggestions(userId: number, city?: string, limit = 3) {
  const db = await getDb();
  if (!db) return [];

  const upcoming = await getCommunityEvents({ city, limit: 30 });
  const feedback = await db
    .select({ eventId: eventRecommendationFeedback.eventId, response: eventRecommendationFeedback.response })
    .from(eventRecommendationFeedback)
    .where(eq(eventRecommendationFeedback.userId, userId));
  const responses = new Map(feedback.map((item) => [item.eventId, item.response]));

  return selectCurrentVerifiedEvents(upcoming, responses, limit)
    .map((event) => ({ ...event, feedback: responses.get(event.id) ?? null }));
}

export async function recordSallyEventFeedback(
  userId: number,
  eventId: number,
  response: "interested" | "not_for_me",
  interviewSessionId?: number,
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const existing = await db
    .select({ id: eventRecommendationFeedback.id })
    .from(eventRecommendationFeedback)
    .where(and(eq(eventRecommendationFeedback.userId, userId), eq(eventRecommendationFeedback.eventId, eventId)))
    .limit(1);

  if (existing[0]) {
    await db
      .update(eventRecommendationFeedback)
      .set({ response, interviewSessionId: interviewSessionId ?? null })
      .where(eq(eventRecommendationFeedback.id, existing[0].id));
  } else {
    await db.insert(eventRecommendationFeedback).values({ userId, eventId, response, interviewSessionId: interviewSessionId ?? null });
  }

  if (response === "interested") {
    await markEventInterest(userId, eventId, "interested");
  } else {
    await removeEventInterest(userId, eventId);
  }

  return { success: true, response };
}

export async function getAdminSallyEventFeedback(limit = 200) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: eventRecommendationFeedback.id,
      response: eventRecommendationFeedback.response,
      createdAt: eventRecommendationFeedback.createdAt,
      updatedAt: eventRecommendationFeedback.updatedAt,
      userId: users.id,
      userName: users.name,
      userEmail: users.email,
      eventId: communityEvents.id,
      eventTitle: communityEvents.title,
      eventDate: communityEvents.eventDate,
      eventCity: communityEvents.city,
      eventVenueName: communityEvents.venueName,
      eventExternalUrl: communityEvents.externalUrl,
    })
    .from(eventRecommendationFeedback)
    .innerJoin(users, eq(eventRecommendationFeedback.userId, users.id))
    .innerJoin(communityEvents, eq(eventRecommendationFeedback.eventId, communityEvents.id))
    .orderBy(desc(eventRecommendationFeedback.updatedAt))
    .limit(limit);
}

export async function createCommunityEvent(data: InsertCommunityEvent) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(communityEvents).values(data);
  return result;
}

export async function rsvpToEvent(eventId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Check for existing RSVP
  const existing = await db
    .select()
    .from(eventRsvps)
    .where(and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.userId, userId)))
    .limit(1);
  if (existing.length > 0) return { alreadyRsvped: true };
  await db.insert(eventRsvps).values({ eventId, userId });
  await db
    .update(communityEvents)
    .set({ rsvpCount: sql`${communityEvents.rsvpCount} + 1` })
    .where(eq(communityEvents.id, eventId));
  return { alreadyRsvped: false };
}

export async function setEventIntroductionOptIn(eventId: number, userId: number, openToSallyIntroduction: boolean) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const existing = await db
    .select({ id: eventRsvps.id })
    .from(eventRsvps)
    .where(and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.userId, userId)))
    .limit(1);
  if (!existing[0]) throw new Error("RSVP to this public event before opting in to introductions");
  await db
    .update(eventRsvps)
    .set({ openToSallyIntroduction })
    .where(eq(eventRsvps.id, existing[0].id));
  return { openToSallyIntroduction };
}

/**
 * Creates one private match for a member who has RSVP'd and opted in to Sally
 * introductions. Candidate identities remain undisclosed until the mutual opt-in
 * produces the normal private match card. Existing blocks and matches always win.
 */
export async function createMutualEventIntroduction(eventId: number, requesterUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const requester = await db
    .select({ id: eventRsvps.id, openToSallyIntroduction: eventRsvps.openToSallyIntroduction })
    .from(eventRsvps)
    .where(and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.userId, requesterUserId)))
    .limit(1);

  if (!requester[0]?.openToSallyIntroduction) {
    throw new Error("RSVP and turn on Sally introductions before requesting an event introduction");
  }

  const candidates = await db
    .select({ userId: eventRsvps.userId })
    .from(eventRsvps)
    .where(and(
      eq(eventRsvps.eventId, eventId),
      eq(eventRsvps.openToSallyIntroduction, true),
      sql`${eventRsvps.userId} <> ${requesterUserId}`,
    ))
    .orderBy(eventRsvps.createdAt);

  for (const candidate of candidates) {
    const [isBlocked, alreadyMatched] = await Promise.all([
      isBlockInEffect(requesterUserId, candidate.userId),
      existingMatch(requesterUserId, candidate.userId),
    ]);

    if (!canCreateEventIntroduction({
      requesterUserId,
      candidateUserId: candidate.userId,
      requesterOptedIn: Boolean(requester[0].openToSallyIntroduction),
      candidateOptedIn: true,
      isBlocked,
      alreadyMatched: Boolean(alreadyMatched),
    })) continue;

    const pair = getEventIntroductionPair(requesterUserId, candidate.userId);
    let introductionId: number;
    try {
      await db.insert(eventIntroductions).values({ eventId, ...pair });
      const reservation = await db
        .select({ id: eventIntroductions.id })
        .from(eventIntroductions)
        .where(and(
          eq(eventIntroductions.eventId, eventId),
          eq(eventIntroductions.lowerUserId, pair.lowerUserId),
          eq(eventIntroductions.higherUserId, pair.higherUserId),
        ))
        .limit(1);
      if (!reservation[0]) throw new Error("Could not reserve the private event introduction");
      introductionId = reservation[0].id;
    } catch (error) {
      if (String(error).toLowerCase().includes("duplicate")) continue;
      throw error;
    }

    let match;
    try {
      match = await createMatch(
        requesterUserId,
        candidate.userId,
        72,
        "You both opted in to a Sally introduction for the same public event.",
      );
    } catch (error) {
      await db.delete(eventIntroductions).where(eq(eventIntroductions.id, introductionId));
      throw error;
    }

    if (!match) {
      await db.delete(eventIntroductions).where(eq(eventIntroductions.id, introductionId));
      throw new Error("Could not create the private event introduction");
    }

    await db.update(eventIntroductions).set({ matchId: match.id }).where(eq(eventIntroductions.id, introductionId));

    await Promise.all([
      createNotification(
        requesterUserId,
        "new_match",
        "Sally introduction ready",
        "A private connection is ready with another attendee who independently opted in for this public event.",
        match.id,
      ),
      createNotification(
        candidate.userId,
        "new_match",
        "Sally introduction ready",
        "A private connection is ready with another attendee who independently opted in for this public event.",
        match.id,
      ),
    ]);

    return { status: "created" as const, matchId: match.id };
  }

  return { status: "unavailable" as const };
}

export async function getUserEventRsvps(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ rsvp: eventRsvps, event: communityEvents })
    .from(eventRsvps)
    .innerJoin(communityEvents, eq(eventRsvps.eventId, communityEvents.id))
    .where(eq(eventRsvps.userId, userId))
    .orderBy(communityEvents.eventDate);
}

export async function getEventbriteEvents(
  city: string,
  token: string,
  location?: { lat?: number; lng?: number; radiusMiles?: number },
) {
  if (!token) return [];
  try {
    const locationQuery = location?.lat !== undefined && location.lng !== undefined
      ? `location.latitude=${location.lat}&location.longitude=${location.lng}&location.within=${(location.radiusMiles ?? 25) * 1.60934}km`
      : `location.address=${encodeURIComponent(`${city} WI`)}&location.within=30km`;
    const res = await fetch(
      `https://www.eventbriteapi.com/v3/events/search/?${locationQuery}&categories=103,110,113&expand=venue&token=${token}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { events?: Array<{
      id: string; name: { text: string }; description: { text: string };
      start: { utc: string }; end: { utc: string };
      url: string; is_free: boolean; logo?: { url: string };
      venue?: { name: string; address: { localized_address_display: string }; latitude?: string; longitude?: string };
    }> };
    return (json.events ?? []).map((e) => ({
      id: `eb_${e.id}`,
      title: e.name.text,
      description: e.description?.text ?? "",
      category: "community" as const,
      eventDate: e.start.utc,
      endDate: e.end.utc,
      venueName: e.venue?.name ?? "",
      address: e.venue?.address?.localized_address_display ?? "",
      lat: e.venue?.latitude ? Number(e.venue.latitude) : null,
      lng: e.venue?.longitude ? Number(e.venue.longitude) : null,
      city,
      isFree: e.is_free,
      priceCents: 0,
      externalUrl: e.url,
      imageUrl: e.logo?.url ?? null,
      source: "eventbrite" as const,
      rsvpCount: 0,
    }));
  } catch {
    return [];
  }
}

// ─── WebAuthn Passkey Credentials ─────────────────────────────────────────────

export async function getPasskeysForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(passkeyCredentials).where(eq(passkeyCredentials.userId, userId));
}

export async function getPasskeyByCredentialId(credentialId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(passkeyCredentials)
    .where(eq(passkeyCredentials.credentialId, credentialId))
    .limit(1);
  return rows[0] ?? null;
}

export async function savePasskeyCredential(data: {
  userId: number;
  credentialId: string;
  publicKey: string;
  counter: number;
  deviceType?: string;
  transports?: string;
  aaguid?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(passkeyCredentials).values(data);
}

export async function updatePasskeyCounter(credentialId: string, counter: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(passkeyCredentials)
    .set({ counter, lastUsedAt: new Date() })
    .where(eq(passkeyCredentials.credentialId, credentialId));
}

export async function deletePasskey(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(passkeyCredentials)
    .where(and(eq(passkeyCredentials.id, id), eq(passkeyCredentials.userId, userId)));
}

export async function storeWebAuthnChallenge(
  userId: number,
  purpose: "registration" | "authentication",
  challenge: string,
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const now = new Date();
  const expiresAt = getWebauthnChallengeExpiry(now);
  await db.insert(webauthnChallenges).values({ userId, purpose, challenge, expiresAt }).onDuplicateKeyUpdate({
    set: { challenge, expiresAt, consumedAt: null, createdAt: now },
  });
}

export async function consumeWebAuthnChallenge(
  userId: number,
  purpose: "registration" | "authentication",
) {
  const db = await getDb();
  if (!db) return null;
  const now = new Date();
  const rows = await db
    .select()
    .from(webauthnChallenges)
    .where(and(eq(webauthnChallenges.userId, userId), eq(webauthnChallenges.purpose, purpose), gt(webauthnChallenges.expiresAt, now)))
    .limit(1);
  const record = rows[0];
  if (!record || record.consumedAt) return null;
  await db.update(webauthnChallenges).set({ consumedAt: now }).where(eq(webauthnChallenges.id, record.id));
  return record.challenge;
}

// ─── Login Ads ─────────────────────────────────────────────────────────────────

export async function getActiveLoginAd() {
  const db = await getDb();
  if (!db) return null;
  const now = new Date();
  const rows = await db
    .select()
    .from(loginAds)
    .where(
      and(
        eq(loginAds.isActive, true),
        sql`(${loginAds.startsAt} IS NULL OR ${loginAds.startsAt} <= ${now})`,
        sql`(${loginAds.endsAt} IS NULL OR ${loginAds.endsAt} >= ${now})`,
        sql`(${loginAds.budgetCents} = 0 OR ${loginAds.spentCents} < ${loginAds.budgetCents})`
      )
    )
    .orderBy(sql`RAND()`)
    .limit(1);
  return rows[0] ?? null;
}

export async function createLoginAd(data: {
  vendorId: number;
  title: string;
  videoUrl: string;
  ctaText?: string;
  ctaUrl?: string;
  durationSeconds?: number;
  budgetCents?: number;
  cpmCents?: number;
  startsAt?: Date;
  endsAt?: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(loginAds).values(data);
}

export async function recordAdImpression(adId: number) {
  const db = await getDb();
  if (!db) return;
  const ad = await db.select().from(loginAds).where(eq(loginAds.id, adId)).limit(1);
  if (!ad[0]) return;
  const costCents = Math.round(ad[0].cpmCents / 10); // CPM/1000 * 100 = CPM/10
  await db
    .update(loginAds)
    .set({
      impressions: sql`${loginAds.impressions} + 1`,
      spentCents: sql`${loginAds.spentCents} + ${costCents}`,
    })
    .where(eq(loginAds.id, adId));
}

export async function getLoginAdsForVendor(vendorId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(loginAds).where(eq(loginAds.vendorId, vendorId)).orderBy(desc(loginAds.createdAt));
}

export async function updateLoginAdStatus(id: number, isActive: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(loginAds).set({ isActive }).where(eq(loginAds.id, id));
}

// ─── Sponsored / Featured Placement ──────────────────────────────────────────

export async function toggleSponsoredEvent(eventId: number, isSponsored: boolean) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(communityEvents).set({ isSponsored }).where(eq(communityEvents.id, eventId));
}

export async function setThirdWheelHostForEvent(eventId: number, hasThirdWheelHost: boolean, thirdWheelHostNote?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(communityEvents).set({
    hasThirdWheelHost,
    thirdWheelHostNote: hasThirdWheelHost ? thirdWheelHostNote?.trim().slice(0, 280) || null : null,
  }).where(eq(communityEvents.id, eventId));
}

export async function recordEventSourceHealth(input: {
  sourceKey: string;
  sourceLabel: string;
  city: string;
  status: "healthy" | "empty" | "failed";
  eventsFound: number;
  errorMessage?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const now = new Date();
  const [existing] = await db.select().from(eventSourceHealth).where(eq(eventSourceHealth.sourceKey, input.sourceKey)).limit(1);
  const values = {
    sourceLabel: input.sourceLabel,
    city: input.city,
    status: input.status,
    eventsFound: input.eventsFound,
    errorMessage: input.errorMessage?.slice(0, 1000) ?? null,
    lastAttemptedAt: now,
    lastSucceededAt: input.status === "failed" ? existing?.lastSucceededAt ?? null : now,
  };
  if (existing) {
    await db.update(eventSourceHealth).set(values).where(eq(eventSourceHealth.id, existing.id));
  } else {
    await db.insert(eventSourceHealth).values({ sourceKey: input.sourceKey, ...values });
  }
}

export async function getEventSourceHealth() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(eventSourceHealth).orderBy(eventSourceHealth.city, eventSourceHealth.sourceLabel);
}

export async function recordCompetitiveGameResults(
  gameType: "jeopardy" | "trivia_pursuit",
  roomId: number,
  players: Array<{ userId: number; score: number }>,
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const sorted = [...players].sort((left, right) => right.score - left.score);
  const topScore = sorted[0]?.score ?? 0;
  const completedAt = new Date();
  await Promise.all(sorted.map((player, index) =>
    db.insert(gameResults).values({
      gameType,
      roomId,
      userId: player.userId,
      score: player.score,
      rank: index + 1,
      isWinner: player.score === topScore,
      completedAt,
    }).onDuplicateKeyUpdate({
      set: {
        score: player.score,
        rank: index + 1,
        isWinner: player.score === topScore,
        completedAt,
      },
    })
  ));
}

export async function getCompetitiveGameStatsForUser(userId: number) {
  const db = await getDb();
  if (!db) return { gamesCompleted: 0, wins: 0, totalScore: 0, jeopardyCompleted: 0, triviaCompleted: 0 };
  const [summary] = await db.select({
    gamesCompleted: sql<number>`COUNT(*)`,
    wins: sql<number>`COALESCE(SUM(CASE WHEN ${gameResults.isWinner} = 1 THEN 1 ELSE 0 END), 0)`,
    totalScore: sql<number>`COALESCE(SUM(${gameResults.score}), 0)`,
    jeopardyCompleted: sql<number>`COALESCE(SUM(CASE WHEN ${gameResults.gameType} = 'jeopardy' THEN 1 ELSE 0 END), 0)`,
    triviaCompleted: sql<number>`COALESCE(SUM(CASE WHEN ${gameResults.gameType} = 'trivia_pursuit' THEN 1 ELSE 0 END), 0)`,
  }).from(gameResults).where(eq(gameResults.userId, userId));
  return {
    gamesCompleted: Number(summary?.gamesCompleted ?? 0),
    wins: Number(summary?.wins ?? 0),
    totalScore: Number(summary?.totalScore ?? 0),
    jeopardyCompleted: Number(summary?.jeopardyCompleted ?? 0),
    triviaCompleted: Number(summary?.triviaCompleted ?? 0),
  };
}

export async function toggleSponsoredActivity(activityId: number, isSponsored: boolean) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(activityListings).set({ isSponsored }).where(eq(activityListings.id, activityId));
}

export async function getRevenueSummary() {
  const db = await getDb();
  if (!db) return { totalImpressions: 0, totalAdSpentCents: 0, sponsoredEventCount: 0, sponsoredActivityCount: 0, activeAdCampaigns: 0 };
  const [adStats] = await db
    .select({
      totalImpressions: sql<number>`COALESCE(SUM(${loginAds.impressions}), 0)`,
      totalAdSpentCents: sql<number>`COALESCE(SUM(${loginAds.spentCents}), 0)`,
      activeAdCampaigns: sql<number>`COALESCE(SUM(CASE WHEN ${loginAds.isActive} = 1 THEN 1 ELSE 0 END), 0)`,
    })
    .from(loginAds);
  const [eventStats] = await db
    .select({ sponsoredEventCount: sql<number>`COALESCE(SUM(CASE WHEN ${communityEvents.isSponsored} = 1 THEN 1 ELSE 0 END), 0)` })
    .from(communityEvents);
  const [activityStats] = await db
    .select({ sponsoredActivityCount: sql<number>`COALESCE(SUM(CASE WHEN ${activityListings.isSponsored} = 1 THEN 1 ELSE 0 END), 0)` })
    .from(activityListings);
  return {
    totalImpressions: Number(adStats?.totalImpressions ?? 0),
    totalAdSpentCents: Number(adStats?.totalAdSpentCents ?? 0),
    activeAdCampaigns: Number(adStats?.activeAdCampaigns ?? 0),
    sponsoredEventCount: Number(eventStats?.sponsoredEventCount ?? 0),
    sponsoredActivityCount: Number(activityStats?.sponsoredActivityCount ?? 0),
  };
}

// ─── Profile Photos ────────────────────────────────────────────────────────────

export async function getProfilePhotos(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(profilePhotos)
    .where(eq(profilePhotos.userId, userId))
    .orderBy(desc(profilePhotos.isPrimary), desc(profilePhotos.createdAt));
}

export async function insertProfilePhoto(data: {
  userId: number;
  s3Key: string;
  url: string;
  isPrimary?: boolean;
  exifLat?: string;
  exifLng?: string;
  exifCity?: string;
  cityVerified?: boolean;
  verificationNote?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // If this is the first photo, make it primary
  const existing = await db.select({ id: profilePhotos.id }).from(profilePhotos).where(eq(profilePhotos.userId, data.userId)).limit(1);
  const isPrimary = data.isPrimary ?? existing.length === 0;
  await db.insert(profilePhotos).values({ ...data, isPrimary });
}

export async function setPrimaryPhoto(photoId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  // Unset all primaries for user
  await db.update(profilePhotos).set({ isPrimary: false }).where(eq(profilePhotos.userId, userId));
  // Set the chosen one
  await db.update(profilePhotos).set({ isPrimary: true }).where(and(eq(profilePhotos.id, photoId), eq(profilePhotos.userId, userId)));
}

export async function deleteProfilePhoto(photoId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(profilePhotos).where(and(eq(profilePhotos.id, photoId), eq(profilePhotos.userId, userId)));
}

export async function updateProfileIdentity(userId: number, data: {
  gender?: string;
  sexualOrientation?: string;
  birthDate?: string; // YYYY-MM-DD format
}) {
  const db = await getDb();
  if (!db) return;
  const updateData: Record<string, unknown> = {};
  if (data.gender !== undefined) updateData.gender = data.gender;
  if (data.sexualOrientation !== undefined) updateData.sexualOrientation = data.sexualOrientation;
  if (data.birthDate !== undefined) updateData.birthDate = data.birthDate;
  if (Object.keys(updateData).length === 0) return;
  try {
    await db.update(userProfiles).set(updateData as any).where(eq(userProfiles.userId, userId));
  } catch (err: any) {
    console.error('[updateProfileIdentity] DB error:', err?.message || err);
    throw new Error('Failed to update profile: ' + (err?.message || 'Unknown DB error'));
  }
}

// ─── Admin: Photo Moderation ──────────────────────────────────────────────────

export async function getAllProfilePhotosAdmin(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: profilePhotos.id,
      userId: profilePhotos.userId,
      url: profilePhotos.url,
      s3Key: profilePhotos.s3Key,
      isPrimary: profilePhotos.isPrimary,
      cityVerified: profilePhotos.cityVerified,
      exifCity: profilePhotos.exifCity,
      verificationNote: profilePhotos.verificationNote,
      createdAt: profilePhotos.createdAt,
    })
    .from(profilePhotos)
    .orderBy(desc(profilePhotos.createdAt))
    .limit(limit);
}

export async function adminDeletePhoto(photoId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(profilePhotos).where(eq(profilePhotos.id, photoId));
}

// ─── Admin: Ban / Unban ───────────────────────────────────────────────────────

export async function banUser(userId: number, reason: string) {
  const db = await getDb();
  if (!db) return;
  // Use role "banned" to mark banned users
  await db.update(users).set({ role: "banned" as any }).where(eq(users.id, userId));
  await db.insert(adminFlags).values({
    userId,
    flagType: "manual_review",
    severity: "high",
    notes: `Banned by admin: ${reason}`,
  });
}

export async function unbanUser(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role: "user" }).where(eq(users.id, userId));
}

export async function approveSuspendedUser(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role: "user" }).where(eq(users.id, userId));
  await db.insert(adminFlags).values({
    userId,
    flagType: "manual_review",
    severity: "low",
    notes: "Account approved and restored by admin after review",
  });
}

export async function createSallyBehaviorReviewFlag(userId: number, reason: string) {
  const db = await getDb();
  if (!db) return;
  const existing = await db
    .select({ id: adminFlags.id })
    .from(adminFlags)
    .where(and(eq(adminFlags.userId, userId), eq(adminFlags.flagType, "bot_behavior"), sql`${adminFlags.resolvedAt} IS NULL`))
    .limit(1);
  if (existing[0]) return;
  await db.insert(adminFlags).values({
    userId,
    flagType: "bot_behavior",
    severity: "low",
    notes: `Sally interview review cue: ${reason}. Review only; no account action was taken automatically.`,
  });
}

// ─── Admin: Enhanced Stats ────────────────────────────────────────────────────

export async function getAdminStatsEnhanced() {
  const db = await getDb();
  if (!db) return null;

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    allUsers,
    newUsers,
    allMatches,
    allMessages,
    allPhotos,
    verifiedPhotos,
    allEvents,
    allActivities,
  ] = await Promise.all([
    db.select({ id: users.id, role: users.role }).from(users),
    db.select({ id: users.id }).from(users).where(sql`${users.createdAt} >= ${oneWeekAgo}`),
    db.select({ id: matches.id }).from(matches),
    db.select({ id: chatMessages.id }).from(chatMessages),
    db.select({ id: profilePhotos.id }).from(profilePhotos),
    db.select({ id: profilePhotos.id }).from(profilePhotos).where(eq(profilePhotos.cityVerified, true)),
    db.select({ id: communityEvents.id }).from(communityEvents),
    db.select({ id: activityListings.id }).from(activityListings),
  ]);

  const verifiedProfiles = await db
    .select({ id: userProfiles.id })
    .from(userProfiles)
    .where(eq(userProfiles.isVerified, true));

  const bannedUsers = allUsers.filter(u => u.role === "banned");

  return {
    totalUsers: allUsers.length,
    newThisWeek: newUsers.length,
    verifiedCount: verifiedProfiles.length,
    totalMatches: allMatches.length,
    totalMessages: allMessages.length,
    totalPhotos: allPhotos.length,
    verifiedPhotos: verifiedPhotos.length,
    totalEvents: allEvents.length,
    totalActivities: allActivities.length,
    bannedUsers: bannedUsers.length,
  };
}

// ─── Public Game Lobby ────────────────────────────────────────────────────────

export async function listGameRooms(city?: string) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(gameRooms)
    .where(sql`${gameRooms.status} != 'finished'`)
    .orderBy(desc(gameRooms.createdAt))
    .limit(50);
  if (city) {
    const cityLower = city.toLowerCase();
    const cityFiltered = rows.filter(r => !r.city || r.city.toLowerCase().includes(cityLower) || cityLower.includes(r.city.toLowerCase()));
    return cityFiltered.length > 0 ? cityFiltered : rows;
  }
  return rows;
}

export async function getGameRoom(roomId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(gameRooms).where(eq(gameRooms.id, roomId)).limit(1);
  return rows[0] ?? null;
}

export async function createGameRoom(data: {
  hostUserId: number;
  name: string;
  gameType: "would_you_rather" | "trivia" | "icebreaker" | "two_truths" | "finish_sentence" | "bullgerdash" | "team_builder";
  city?: string;
  maxPlayers?: number;
  questions: { id: number; text: string; optionA?: string; optionB?: string }[];
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(gameRooms).values({
    hostUserId: data.hostUserId,
    name: data.name,
    gameType: data.gameType,
    city: data.city,
    maxPlayers: data.maxPlayers ?? 6,
    questions: data.questions,
    answers: [],
  });
  const rows = await db.select().from(gameRooms).where(eq(gameRooms.hostUserId, data.hostUserId)).orderBy(desc(gameRooms.createdAt)).limit(1);
  return rows[0] ?? null;
}

export async function joinGameRoom(roomId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Check if already joined
  const existing = await db.select().from(gameRoomPlayers)
    .where(and(eq(gameRoomPlayers.roomId, roomId), eq(gameRoomPlayers.userId, userId)))
    .limit(1);
  if (existing[0]) {
    // Re-activate if they left
    await db.update(gameRoomPlayers)
      .set({ isActive: true, lastSeenAt: new Date() })
      .where(and(eq(gameRoomPlayers.roomId, roomId), eq(gameRoomPlayers.userId, userId)));
    return;
  }
  await db.insert(gameRoomPlayers).values({ roomId, userId });
}

export async function leaveGameRoom(roomId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(gameRoomPlayers)
    .set({ isActive: false })
    .where(and(eq(gameRoomPlayers.roomId, roomId), eq(gameRoomPlayers.userId, userId)));
}

export async function getGameRoomPlayers(roomId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: gameRoomPlayers.id,
    userId: gameRoomPlayers.userId,
    joinedAt: gameRoomPlayers.joinedAt,
    isActive: gameRoomPlayers.isActive,
    lastSeenAt: gameRoomPlayers.lastSeenAt,
    displayName: userProfiles.displayName,
    city: userProfiles.city,
  })
  .from(gameRoomPlayers)
  .leftJoin(userProfiles, eq(gameRoomPlayers.userId, userProfiles.userId))
  .where(and(eq(gameRoomPlayers.roomId, roomId), eq(gameRoomPlayers.isActive, true)));
}

export async function submitGameAnswer(roomId: number, userId: number, questionIndex: number, answer: string) {
  const db = await getDb();
  if (!db) return;
  const room = await getGameRoom(roomId);
  if (!room) return;
  const answers = (room.answers ?? []) as { userId: number; questionIndex: number; answer: string; timestamp: number }[];
  const priorAnswerIndex = answers.findIndex((item) => item.userId === userId && item.questionIndex === questionIndex);
  if (priorAnswerIndex >= 0) answers.splice(priorAnswerIndex, 1);
  answers.push({ userId, questionIndex, answer, timestamp: Date.now() });
  await db.update(gameRooms).set({ answers, updatedAt: new Date() }).where(eq(gameRooms.id, roomId));
}

export async function advanceGameQuestion(roomId: number) {
  const db = await getDb();
  if (!db) return;
  const room = await getGameRoom(roomId);
  if (!room) return;
  const nextIndex = room.currentQuestionIndex + 1;
  const questions = (room.questions ?? []) as { id: number }[];
  const isFinished = nextIndex >= questions.length;
  await db.update(gameRooms)
    .set({ currentQuestionIndex: nextIndex, status: isFinished ? "finished" : "in_progress", updatedAt: new Date() })
    .where(eq(gameRooms.id, roomId));
}

export async function startGameRoom(roomId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(gameRooms).set({ status: "in_progress", updatedAt: new Date() }).where(eq(gameRooms.id, roomId));
}


// ─── Movie & Entertainment Click Tracking ─────────────────────────────────────
export async function recordMovieBookingClick(data: {
  userId?: number;
  movieId: string;
  movieTitle: string;
  userCity?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(movieBookingClicks).values({
    userId: data.userId,
    movieId: data.movieId,
    movieTitle: data.movieTitle,
    userCity: data.userCity,
    estimatedCommissionCents: 10,
  });
}

export async function recordEntertainmentClick(data: {
  userId?: number;
  category: "concert" | "theme_park" | "adventure" | "sports" | "comedy" | "other";
  eventId: string;
  eventTitle: string;
  venueName?: string;
  venueCity?: string;
  affiliateNetwork: string;
  affiliateUrl: string;
  estimatedCommissionCents?: number;
  estimatedCommissionPct?: number;
  userCity?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(entertainmentClicks).values({
    userId: data.userId,
    category: data.category,
    eventId: data.eventId,
    eventTitle: data.eventTitle,
    venueName: data.venueName,
    venueCity: data.venueCity,
    affiliateNetwork: data.affiliateNetwork,
    affiliateUrl: data.affiliateUrl,
    estimatedCommissionCents: data.estimatedCommissionCents ?? 0,
    estimatedCommissionPct: data.estimatedCommissionPct ?? 0,
    userCity: data.userCity,
  });
}

export async function getEntertainmentRevenueSummary() {
  const db = await getDb();
  if (!db) return { movieClicks: 0, movieCommissionCents: 0, entertainmentClicks: 0, entertainmentCommissionCents: 0, totalClicks: 0, totalCommissionCents: 0, byCategory: {} as Record<string, number> };

  const [movieRows, entRows] = await Promise.all([
    db.select().from(movieBookingClicks),
    db.select().from(entertainmentClicks),
  ]);

  const movieCommissionCents = movieRows.reduce((sum, r) => sum + (r.estimatedCommissionCents ?? 0), 0);
  const entertainmentCommissionCents = entRows.reduce((sum, r) => sum + (r.estimatedCommissionCents ?? 0), 0);

  const byCategory: Record<string, number> = {};
  for (const r of entRows) {
    byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
  }

  return {
    movieClicks: movieRows.length,
    movieCommissionCents,
    entertainmentClicks: entRows.length,
    entertainmentCommissionCents,
    totalClicks: movieRows.length + entRows.length,
    totalCommissionCents: movieCommissionCents + entertainmentCommissionCents,
    byCategory,
  };
}

// ─── Friend Invites ───────────────────────────────────────────────────────────

export async function createFriendInvite(data: {
  inviterId: number;
  contactName: string;
  contactPhone?: string;
  contactEmail?: string;
}) {
  const inviteCode = randomBytes(8).toString("hex"); // 16-char unique code
  const db = (await getDb())!;
  await db.insert(friendInvites).values({
    inviterId: data.inviterId,
    contactName: data.contactName,
    contactPhone: data.contactPhone ?? null,
    contactEmail: data.contactEmail ?? null,
    inviteCode,
  });
  return { inviteCode };
}

export async function getMyInvites(inviterId: number) {
  const db = (await getDb())!;
  return db
    .select()
    .from(friendInvites)
    .where(eq(friendInvites.inviterId, inviterId))
    .orderBy(desc(friendInvites.sentAt));
}

export async function markInviteOpened(inviteCode: string) {
  const db = (await getDb())!;
  await db
    .update(friendInvites)
    .set({ status: "opened", openedAt: new Date() })
    .where(and(eq(friendInvites.inviteCode, inviteCode), eq(friendInvites.status, "sent")));
}

export async function markInviteJoined(inviteCode: string, joinedUserId: number) {
  const db = (await getDb())!;
  await db
    .update(friendInvites)
    .set({ status: "joined", joinedAt: new Date(), joinedUserId })
    .where(eq(friendInvites.inviteCode, inviteCode));
}

export async function getInviteByCode(inviteCode: string) {
  const db = (await getDb())!;
  const rows = await db
    .select()
    .from(friendInvites)
    .where(eq(friendInvites.inviteCode, inviteCode))
    .limit(1);
  return rows[0] ?? null;
}

export async function getInviteStats() {
  const db = (await getDb())!;
  const rows = await db.select().from(friendInvites);
  const total = rows.length;
  const opened = rows.filter((r: { status: string }) => r.status === "opened" || r.status === "joined").length;
  const joined = rows.filter((r: { status: string }) => r.status === "joined").length;
  return { total, opened, joined, conversionRate: total > 0 ? Math.round((joined / total) * 100) : 0 };
}

// ─── Campus Members (self-serve dating pool) ─────────────────────────────────
export async function joinCampus(userId: number, campusId: number, verifiedEmail?: string) {
  const db = await getDb();
  if (!db) return null;
  // Upsert: ignore if already joined
  const existing = await db
    .select()
    .from(campusMembers)
    .where(and(eq(campusMembers.userId, userId), eq(campusMembers.campusId, campusId)))
    .limit(1);
  if (existing.length > 0) return existing[0];
  await db.insert(campusMembers).values({ userId, campusId, verifiedEmail });
  const [row] = await db
    .select()
    .from(campusMembers)
    .where(and(eq(campusMembers.userId, userId), eq(campusMembers.campusId, campusId)))
    .limit(1);
  return row ?? null;
}

export async function leaveCampus(userId: number, campusId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(campusMembers)
    .where(and(eq(campusMembers.userId, userId), eq(campusMembers.campusId, campusId)));
}

export async function getUserCampuses(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ campusId: campusMembers.campusId, joinedAt: campusMembers.joinedAt })
    .from(campusMembers)
    .where(eq(campusMembers.userId, userId));
  return rows;
}

export async function getCampusMemberCount(campusId: number) {
  const db = await getDb();
  if (!db) return 0;
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(campusMembers)
    .where(eq(campusMembers.campusId, campusId));
  return Number(row?.count ?? 0);
}

export async function getCampusMemberProfiles(campusId: number, excludeUserId?: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      userId: campusMembers.userId,
      joinedAt: campusMembers.joinedAt,
      displayName: userProfiles.displayName,
      bio: userProfiles.bio,
      city: userProfiles.city,
      traits: userProfiles.traits,
      gender: userProfiles.gender,
      sexualOrientation: userProfiles.sexualOrientation,
    })
    .from(campusMembers)
    .leftJoin(userProfiles, eq(campusMembers.userId, userProfiles.userId))
    .where(
      excludeUserId
        ? and(eq(campusMembers.campusId, campusId), sql`${campusMembers.userId} != ${excludeUserId}`)
        : eq(campusMembers.campusId, campusId)
    )
    .limit(50);
  return rows;
}

export async function getAllCampuses() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(campuses).orderBy(campuses.name);
}

// ─── Community Scraper helpers ────────────────────────────────────────────────
export function canonicalScrapedEventTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/^\d{4}\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalScrapedEventAddress(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/\bwi\s+\d{5}(?:-\d{4})?\b/g, "wi")
    .replace(/\bunited states\b/g, "")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\bstreet\b/g, "st")
    .replace(/\broad\b/g, "rd")
    .replace(/\bdrive\b/g, "dr")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Upsert scraped events from community sources (libraries, universities, etc.).
 *  Deduplicates by (title, source, eventDate) to avoid flooding the table on
 *  repeated nightly runs. Returns the count of newly inserted rows.
 */
export async function upsertScrapedEvents(events: Array<{
  title: string;
  description: string | null;
  eventDate: Date | null;
  endDate: Date | null;
  venueName: string | null;
  venueAddress: string | null;
  venueCity: string;
  category: string;
  sourceUrl: string;
  sourceName: string;
  isFree: boolean;
  isOnCampus: boolean;
}>): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  let inserted = 0;
  const coordinateCache = new Map<string, { lat: number; lng: number } | null>();
  for (const ev of events) {
    if (!ev.title || ev.title.length < 3) continue;

    // Normalize city/state
    const parts = ev.venueCity.split(",");
    const city = parts[0]?.trim() ?? ev.venueCity;
    const state = parts[1]?.trim() ?? "WI";
    const addressKey = ev.venueAddress?.trim().toLowerCase() ?? "";
    let coordinates: { lat: number; lng: number } | null = null;
    if (addressKey) {
      if (!coordinateCache.has(addressKey)) {
        coordinateCache.set(addressKey, await geocodePublicVenueAddress(ev.venueAddress));
      }
      coordinates = coordinateCache.get(addressKey) ?? null;
    }

    // Map sourceName → source enum value
    const sourceMap: Record<string, string> = {
      "Milwaukee Public Library": "milwaukee_library",
      "Waukesha Public Library": "waukesha_library",
      "Waukesha County Parks": "waukesha_county_parks",
      "Brookfield Public Library": "brookfield_library",
      "Visit Waukesha": "visit_waukesha",
      "Downtown Waukesha": "downtown_waukesha",
      "Waukesha Area Chamber": "waukesha_chamber",
      "La Crosse Public Library": "la_crosse_library",
      "City of La Crosse Parks & Recreation": "la_crosse_parks",
      "UW-Milwaukee": "uwm",
      "Marquette University": "marquette",
      "OnMilwaukee": "onmilwaukee",
      "Milwaukee Journal Sentinel": "jsonline",
      "Journal Sentinel": "jsonline",
      "jsonline": "jsonline",
      "Waukesha Freeman": "waukesha_freeman",
      "Milwaukee Journal": "milwaukee_journal",
      "Madison Public Library": "scraped",
      "City of Madison": "community",
      "Overture Center": "scraped",
      "City Church Madison": "church",
      "Eastbrook Church": "church",
      "Corpus Christi Parish": "church",
      "James Place Waukesha": "church",
      "Hope Center WI": "community",
      "Cudahy Lions Club": "lions_club",
      "Waukesha Lions Club": "lions_club",
      "UW–Madison Events Calendar": "university",
      "Club 400": "scraped",
      "Milwaukee Comedy": "scraped",
      "The Laughing Tap": "scraped",
    };
    const source = (sourceMap[ev.sourceName] ?? "scraped") as CommunityEvent["source"];

    // Map scraper category to community_events enum
    const catMap: Record<string, string> = {
      bowling: "sports", mini_golf: "sports", kayaking: "outdoors",
      movies: "arts", dining: "food", coffee: "food",
      cooking_class: "food", escape_room: "community", wine_tasting: "food",
      hiking: "outdoors", park: "outdoors", library: "community",
      church: "community", community_center: "community", sports: "sports",
      arts: "arts", market: "market", comedy: "comedy", karaoke: "karaoke", live_music: "live_music", other: "other",
    };
    const category = (catMap[ev.category] ?? "other") as CommunityEvent["category"];

    // Dedup check: same title + source within same day
    const eventDateStr = ev.eventDate ? ev.eventDate.toISOString().slice(0, 10) : null;
    const existing = await db
      .select({ id: communityEvents.id, isActive: communityEvents.isActive })
      .from(communityEvents)
      .where(
        and(
          eq(communityEvents.title, ev.title.slice(0, 255)),
          eq(communityEvents.source, source),
          eventDateStr
            ? sql`DATE(${communityEvents.eventDate}) = ${eventDateStr}`
            : sql`${communityEvents.eventDate} IS NULL`,
        )
      )
      .limit(1);

    const eventTitleKey = canonicalScrapedEventTitle(ev.title);
    const eventAddressKey = canonicalScrapedEventAddress(ev.venueAddress);
    const sameDayCityCandidates = await db
      .select({ id: communityEvents.id, title: communityEvents.title, address: communityEvents.address, source: communityEvents.source })
      .from(communityEvents)
      .where(
        and(
          eq(communityEvents.city, city),
          eq(communityEvents.isActive, true),
          eventDateStr
            ? sql`DATE(${communityEvents.eventDate}) = ${eventDateStr}`
            : sql`${communityEvents.eventDate} IS NULL`,
        )
      )
      .limit(50);
    const isCrossSourceDuplicate = sameDayCityCandidates.some((candidate) =>
      candidate.source !== source
      && canonicalScrapedEventTitle(candidate.title) === eventTitleKey
      && (!eventAddressKey || canonicalScrapedEventAddress(candidate.address) === eventAddressKey)
    );
    if (isCrossSourceDuplicate) {
      if (existing[0]?.isActive) {
        await db.update(communityEvents).set({ isActive: false }).where(eq(communityEvents.id, existing[0].id));
      }
      continue;
    }

    if (existing.length > 0) {
      await db.update(communityEvents).set({
        description: ev.description?.slice(0, 1000) ?? null,
        category,
        eventDate: ev.eventDate ?? undefined,
        endDate: ev.endDate ?? undefined,
        venueName: ev.venueName?.slice(0, 255) ?? null,
        address: ev.venueAddress ?? null,
        city,
        state,
        lat: coordinates?.lat ?? undefined,
        lng: coordinates?.lng ?? undefined,
        isFree: ev.isFree,
        externalUrl: ev.sourceUrl,
        isOnCampus: ev.isOnCampus,
        isActive: true,
      }).where(eq(communityEvents.id, existing[0].id));
      continue;
    }

    await db.insert(communityEvents).values({
      title: ev.title.slice(0, 255),
      description: ev.description?.slice(0, 1000) ?? null,
      category,
      eventDate: ev.eventDate ?? new Date(),
      endDate: ev.endDate ?? undefined,
      venueName: ev.venueName?.slice(0, 255) ?? null,
      address: ev.venueAddress ?? null,
      city,
      state,
      isFree: ev.isFree,
      priceCents: 0,
      externalUrl: ev.sourceUrl,
      source,
      isOnCampus: ev.isOnCampus,
      isActive: true,
      lat: coordinates?.lat ?? null,
      lng: coordinates?.lng ?? null,
    });
    inserted++;
  }
  return inserted;
}

// ─── Family Network ───────────────────────────────────────────────────────────

export async function getOrCreateFamilyProfile(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(familyProfiles).where(eq(familyProfiles.userId, userId)).limit(1);
  if (existing[0]) return existing[0];
  await db.insert(familyProfiles).values({ userId, familyName: "Our Family" });
  const created = await db.select().from(familyProfiles).where(eq(familyProfiles.userId, userId)).limit(1);
  return created[0] ?? null;
}

export async function getFamilyProfileByUserId(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(familyProfiles).where(eq(familyProfiles.userId, userId)).limit(1);
  return result[0] ?? null;
}

export async function updateFamilyProfile(userId: number, data: Partial<typeof familyProfiles.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(familyProfiles).set(data).where(eq(familyProfiles.userId, userId));
}

export async function getFamilyChildren(familyProfileId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(familyChildren).where(eq(familyChildren.familyProfileId, familyProfileId));
}

export async function addFamilyChild(familyProfileId: number, ageYears: number, gender?: "boy" | "girl" | "nonbinary" | "prefer_not_to_say") {
  const db = await getDb();
  if (!db) return null;
  await db.insert(familyChildren).values({ familyProfileId, ageYears, gender });
  const result = await db.select().from(familyChildren)
    .where(eq(familyChildren.familyProfileId, familyProfileId))
    .orderBy(desc(familyChildren.createdAt)).limit(1);
  return result[0] ?? null;
}

export async function removeFamilyChild(childId: number, familyProfileId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(familyChildren).where(and(eq(familyChildren.id, childId), eq(familyChildren.familyProfileId, familyProfileId)));
}

export async function findNearbyFamilies(userId: number, city: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(familyProfiles)
    .where(and(eq(familyProfiles.isActive, true), eq(familyProfiles.neighborhoodCity, city)))
    .orderBy(desc(familyProfiles.createdAt))
    .limit(20);
}

export async function connectFamilies(family1Id: number, family2Id: number) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(familyMatches)
    .where(or(
      and(eq(familyMatches.family1Id, family1Id), eq(familyMatches.family2Id, family2Id)),
      and(eq(familyMatches.family1Id, family2Id), eq(familyMatches.family2Id, family1Id))
    )).limit(1);
  if (existing[0]) {
    await db.update(familyMatches).set({ status: "connected" }).where(eq(familyMatches.id, existing[0].id));
  } else {
    await db.insert(familyMatches).values({ family1Id, family2Id, status: "connected", compatibilityScore: 80 });
  }
}

// ─── Trip Plans ───────────────────────────────────────────────────────────────

export async function getTripPlans(userId: number): Promise<TripPlan[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tripPlans).where(eq(tripPlans.userId, userId)).orderBy(tripPlans.tripDate);
}

export async function createTripPlan(userId: number, title: string, tripDate: string, city?: string, notes?: string): Promise<TripPlan | null> {
  const db = await getDb();
  if (!db) return null;
  await db.insert(tripPlans).values({ userId, title, tripDate, city, notes, items: [] });
  const result = await db.select().from(tripPlans)
    .where(eq(tripPlans.userId, userId))
    .orderBy(desc(tripPlans.createdAt)).limit(1);
  return result[0] ?? null;
}

export async function updateTripPlan(planId: number, userId: number, data: Partial<typeof tripPlans.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(tripPlans).set(data).where(and(eq(tripPlans.id, planId), eq(tripPlans.userId, userId)));
}

export async function deleteTripPlan(planId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(tripPlans).where(and(eq(tripPlans.id, planId), eq(tripPlans.userId, userId)));
}

export async function addTripItem(planId: number, userId: number, item: TripItem) {
  const db = await getDb();
  if (!db) return;
  const plan = await db.select().from(tripPlans).where(and(eq(tripPlans.id, planId), eq(tripPlans.userId, userId))).limit(1);
  if (!plan[0]) return;
  const items = (plan[0].items as TripItem[]) ?? [];
  items.push(item);
  await db.update(tripPlans).set({ items }).where(eq(tripPlans.id, planId));
}

export async function removeTripItem(planId: number, userId: number, itemId: string) {
  const db = await getDb();
  if (!db) return;
  const plan = await db.select().from(tripPlans).where(and(eq(tripPlans.id, planId), eq(tripPlans.userId, userId))).limit(1);
  if (!plan[0]) return;
  const items = ((plan[0].items as TripItem[]) ?? []).filter(i => i.id !== itemId);
  await db.update(tripPlans).set({ items }).where(eq(tripPlans.id, planId));
}

// ─── Trivia Game ──────────────────────────────────────────────────────────────

export async function getTriviaQuestions(category?: string, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  if (category && category !== 'all') {
    return db.select().from(triviaQuestions)
      .where(eq(triviaQuestions.category, category as TriviaQuestion['category']))
      .orderBy(sql`RAND()`).limit(limit);
  }
  return db.select().from(triviaQuestions).orderBy(sql`RAND()`).limit(limit);
}

// ─── Governed Shared Question Library ─────────────────────────────────────────

export async function getPublishedSharedQuestionsForGame(
  gameType: SharedGameType,
  options: { category?: string; limit?: number } = {},
) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [
    eq(sharedQuestionGameTargets.gameType, gameType),
    eq(sharedQuestionGameTargets.enabled, true),
    eq(sharedQuestionLibrary.contentStatus, "published"),
  ];
  if (options.category && options.category !== "all") {
    conditions.push(eq(sharedQuestionLibrary.category, options.category));
  }

  const rows = await db
    .select({ question: sharedQuestionLibrary, gameConfig: sharedQuestionGameTargets.gameConfig })
    .from(sharedQuestionGameTargets)
    .innerJoin(sharedQuestionLibrary, eq(sharedQuestionGameTargets.questionId, sharedQuestionLibrary.id))
    .where(and(...conditions))
    .orderBy(sql`RAND()`)
    .limit(Math.min(options.limit ?? 20, 100));

  return rows
    .filter(({ question }) => isSharedQuestionFormatEligible(question.format, gameType))
    .map(({ question, gameConfig }) => toSharedQuestionClientRecord({
      id: question.id,
      prompt: question.prompt,
      format: question.format,
      category: question.category,
      difficulty: question.difficulty,
      optionA: question.optionA,
      optionB: question.optionB,
      optionC: question.optionC,
      optionD: question.optionD,
      imageUrl: question.imageUrl,
      attribution: question.attribution,
      sourceUrl: question.sourceUrl,
      gameConfig: gameConfig ?? {},
    }));
}

export type SharedQuestionDraftInput = {
  prompt: string;
  format: "would_you_rather" | "multiple_choice" | "free_response" | "visual";
  category: string;
  difficulty: "easy" | "medium" | "hard";
  optionA?: string | null;
  optionB?: string | null;
  optionC?: string | null;
  optionD?: string | null;
  canonicalAnswer?: string | null;
  acceptedAnswers?: string[];
  imageUrl?: string | null;
  sourceUrl?: string | null;
  license?: string | null;
  attribution?: string | null;
  gameTargets: Array<{ gameType: SharedGameType; gameConfig?: Record<string, unknown> }>;
};

export async function createSharedQuestionDraft(input: SharedQuestionDraftInput) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.transaction(async (tx) => {
    const [inserted] = await tx.insert(sharedQuestionLibrary).values({
      prompt: input.prompt,
      format: input.format,
      category: input.category,
      difficulty: input.difficulty,
      optionA: input.optionA?.trim() || null,
      optionB: input.optionB?.trim() || null,
      optionC: input.optionC?.trim() || null,
      optionD: input.optionD?.trim() || null,
      canonicalAnswer: input.canonicalAnswer?.trim() || null,
      acceptedAnswers: input.acceptedAnswers?.map((answer) => answer.trim()).filter(Boolean) ?? [],
      imageUrl: input.imageUrl?.trim() || null,
      sourceUrl: input.sourceUrl?.trim() || null,
      license: input.license?.trim() || null,
      attribution: input.attribution?.trim() || null,
      contentStatus: "draft",
    });
    const questionId = Number(inserted.insertId);
    if (input.gameTargets.length > 0) {
      await tx.insert(sharedQuestionGameTargets).values(input.gameTargets.map((target) => ({
        questionId,
        gameType: target.gameType,
        gameConfig: target.gameConfig ?? {},
      })));
    }
    const [question] = await tx.select().from(sharedQuestionLibrary).where(eq(sharedQuestionLibrary.id, questionId)).limit(1);
    if (!question) throw new Error("Could not create shared question draft");
    return question;
  });
}

export async function getSharedQuestionsForEditorialReview(status?: "draft" | "approved" | "published" | "retired", limit = 100) {
  const db = await getDb();
  if (!db) return [];
  const questions = await db.select().from(sharedQuestionLibrary)
    .where(status ? eq(sharedQuestionLibrary.contentStatus, status) : undefined)
    .orderBy(desc(sharedQuestionLibrary.updatedAt))
    .limit(Math.min(limit, 100));
  const ids = questions.map((question) => question.id);
  const targets = ids.length > 0
    ? await db.select().from(sharedQuestionGameTargets).where(inArray(sharedQuestionGameTargets.questionId, ids))
    : [];
  return questions.map((question) => ({ ...question, targets: targets.filter((target) => target.questionId === question.id) }));
}

export async function getSharedQuestionForEditorialReview(questionId: number) {
  const db = await getDb();
  if (!db) return null;
  const [question] = await db.select().from(sharedQuestionLibrary).where(eq(sharedQuestionLibrary.id, questionId)).limit(1);
  if (!question) return null;
  const targets = await db.select().from(sharedQuestionGameTargets).where(eq(sharedQuestionGameTargets.questionId, questionId));
  return { ...question, targets };
}

export async function setSharedQuestionStatus(questionId: number, status: "approved" | "published" | "retired") {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(sharedQuestionLibrary).set({
    contentStatus: status,
    publishedAt: status === "published" ? new Date() : null,
    revision: sql`${sharedQuestionLibrary.revision} + 1`,
  }).where(eq(sharedQuestionLibrary.id, questionId));
  const [question] = await db.select().from(sharedQuestionLibrary).where(eq(sharedQuestionLibrary.id, questionId)).limit(1);
  return question ?? null;
}

export async function createVenueOutreachRecord(input: {
  venueId: number;
  sentByUserId: number;
  toEmail: string;
  fromEmail: string | null;
  subject: string;
  body: string;
  status: "sent" | "failed" | "draft";
  providerMessageId?: string | null;
  errorMessage?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [result] = await db.insert(venueOutreach).values({
    ...input,
    providerMessageId: input.providerMessageId ?? null,
    errorMessage: input.errorMessage ?? null,
  });
  const [record] = await db.select().from(venueOutreach).where(eq(venueOutreach.id, Number(result.insertId))).limit(1);
  return record ?? null;
}

export async function getVenueOutreachHistory(venueId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(venueOutreach).where(eq(venueOutreach.venueId, venueId)).orderBy(desc(venueOutreach.sentAt)).limit(50);
}

export async function getTriviaQuestionById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(triviaQuestions).where(eq(triviaQuestions.id, id)).limit(1);
  return result[0] ?? null;
}

export async function createTriviaRoom(hostUserId: number, maxPlayers = 8): Promise<TriviaRoom | null> {
  const db = await getDb();
  if (!db) return null;
  // Generate unique 6-char game code
  const gameCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  // Pick 30 random question IDs
  const qs = await db.select({ id: triviaQuestions.id }).from(triviaQuestions).orderBy(sql`RAND()`).limit(30);
  const questionIds = qs.map(q => q.id);
  await db.insert(triviaRooms).values({ gameCode, hostUserId, maxPlayers, questionIds, status: 'waiting' });
  const result = await db.select().from(triviaRooms).where(eq(triviaRooms.gameCode, gameCode)).limit(1);
  return result[0] ?? null;
}

export async function getTriviaRoomByCode(gameCode: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(triviaRooms).where(eq(triviaRooms.gameCode, gameCode)).limit(1);
  return result[0] ?? null;
}

export async function getTriviaRoomById(roomId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(triviaRooms).where(eq(triviaRooms.id, roomId)).limit(1);
  return result[0] ?? null;
}

export async function getOpenTriviaRooms() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(triviaRooms).where(eq(triviaRooms.status, 'waiting')).orderBy(desc(triviaRooms.createdAt)).limit(20);
}

export async function updateTriviaRoom(roomId: number, data: Partial<TriviaRoom>) {
  const db = await getDb();
  if (!db) return;
  await db.update(triviaRooms).set(data).where(eq(triviaRooms.id, roomId));
}

export async function joinTriviaRoom(roomId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(triviaRoomPlayers)
    .where(and(eq(triviaRoomPlayers.roomId, roomId), eq(triviaRoomPlayers.userId, userId))).limit(1);
  if (existing[0]) return existing[0];
  await db.insert(triviaRoomPlayers).values({ roomId, userId, score: 0, streak: 0, isReady: false });
  const result = await db.select().from(triviaRoomPlayers)
    .where(and(eq(triviaRoomPlayers.roomId, roomId), eq(triviaRoomPlayers.userId, userId))).limit(1);
  return result[0] ?? null;
}

export async function getTriviaRoomPlayers(roomId: number): Promise<TriviaRoomPlayer[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(triviaRoomPlayers).where(eq(triviaRoomPlayers.roomId, roomId));
}

export async function setPlayerReady(roomId: number, userId: number, isReady: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(triviaRoomPlayers).set({ isReady }).where(
    and(eq(triviaRoomPlayers.roomId, roomId), eq(triviaRoomPlayers.userId, userId))
  );
}

export async function submitTriviaAnswer(
  roomId: number, userId: number, questionId: number,
  answer: 'A' | 'B' | 'C' | 'D', isCorrect: boolean, answeredAtMs: number
): Promise<TriviaAnswer | null> {
  const db = await getDb();
  if (!db) return null;
  // Check not already answered
  const existing = await db.select().from(triviaAnswers)
    .where(and(eq(triviaAnswers.roomId, roomId), eq(triviaAnswers.userId, userId), eq(triviaAnswers.questionId, questionId))).limit(1);
  if (existing[0]) return existing[0];
  await db.insert(triviaAnswers).values({ roomId, userId, questionId, answer, isCorrect, answeredAtMs });
  // Update score and streak
  if (isCorrect) {
    const player = await db.select().from(triviaRoomPlayers)
      .where(and(eq(triviaRoomPlayers.roomId, roomId), eq(triviaRoomPlayers.userId, userId))).limit(1);
    if (player[0]) {
      const newStreak = (player[0].streak ?? 0) + 1;
      const bonus = newStreak >= 3 ? 1 : 0; // streak bonus
      await db.update(triviaRoomPlayers).set({
        score: (player[0].score ?? 0) + 1 + bonus,
        streak: newStreak,
      }).where(and(eq(triviaRoomPlayers.roomId, roomId), eq(triviaRoomPlayers.userId, userId)));
    }
  } else {
    // Reset streak on wrong answer
    await db.update(triviaRoomPlayers).set({ streak: 0 })
      .where(and(eq(triviaRoomPlayers.roomId, roomId), eq(triviaRoomPlayers.userId, userId)));
  }
  const result = await db.select().from(triviaAnswers)
    .where(and(eq(triviaAnswers.roomId, roomId), eq(triviaAnswers.userId, userId), eq(triviaAnswers.questionId, questionId))).limit(1);
  return result[0] ?? null;
}

export async function getTriviaAnswersForRoom(roomId: number, questionId?: number): Promise<TriviaAnswer[]> {
  const db = await getDb();
  if (!db) return [];
  if (questionId) {
    return db.select().from(triviaAnswers)
      .where(and(eq(triviaAnswers.roomId, roomId), eq(triviaAnswers.questionId, questionId)));
  }
  return db.select().from(triviaAnswers).where(eq(triviaAnswers.roomId, roomId));
}

// ─── Game Chat Messages ───────────────────────────────────────────────────────

export async function sendGameChatMessage(
  roomId: number, userId: number, content: string,
  roomType: 'trivia' | 'match_game' = 'trivia'
) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(gameChatMessages).values({ roomId, userId, content, roomType });
  const result = await db.select().from(gameChatMessages)
    .where(eq(gameChatMessages.roomId, roomId))
    .orderBy(desc(gameChatMessages.createdAt)).limit(1);
  return result[0] ?? null;
}

export async function getGameChatMessages(roomId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(gameChatMessages)
    .where(eq(gameChatMessages.roomId, roomId))
    .orderBy(gameChatMessages.createdAt).limit(limit);
}

export async function sendJeopardyChatMessage(roomId: number, userId: number, content: string) {
  const db = await getDb();
  if (!db) return null;
  const cleanContent = content.trim();
  if (!cleanContent) return null;
  await db.insert(gameChatMessagesUpdated).values({ roomId, userId, content: cleanContent, roomType: "jeopardy" });
  const result = await db.select().from(gameChatMessagesUpdated)
    .where(and(eq(gameChatMessagesUpdated.roomId, roomId), eq(gameChatMessagesUpdated.roomType, "jeopardy")))
    .orderBy(desc(gameChatMessagesUpdated.createdAt)).limit(1);
  return result[0] ?? null;
}

export async function getJeopardyChatMessages(roomId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(gameChatMessagesUpdated)
    .where(and(eq(gameChatMessagesUpdated.roomId, roomId), eq(gameChatMessagesUpdated.roomType, "jeopardy")))
    .orderBy(gameChatMessagesUpdated.createdAt)
    .limit(Math.min(Math.max(limit, 1), 100));
}

export async function sendTriviaPursuitChatMessage(roomId: number, userId: number, content: string) {
  const db = await getDb();
  if (!db) return null;
  const cleanContent = content.trim();
  if (!cleanContent) return null;
  await db.insert(gameChatMessagesUpdated).values({ roomId, userId, content: cleanContent, roomType: "trivia_pursuit" });
  const result = await db.select().from(gameChatMessagesUpdated)
    .where(and(eq(gameChatMessagesUpdated.roomId, roomId), eq(gameChatMessagesUpdated.roomType, "trivia_pursuit")))
    .orderBy(desc(gameChatMessagesUpdated.createdAt)).limit(1);
  return result[0] ?? null;
}

export async function getTriviaPursuitChatMessages(roomId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(gameChatMessagesUpdated)
    .where(and(eq(gameChatMessagesUpdated.roomId, roomId), eq(gameChatMessagesUpdated.roomType, "trivia_pursuit")))
    .orderBy(gameChatMessagesUpdated.createdAt)
    .limit(Math.min(Math.max(limit, 1), 100));
}

// ─── Game Trait Extraction ────────────────────────────────────────────────────
export async function mergeGameTraitsIntoProfile(userId: number, newTraits: Record<string, string>) {
  const db = await getDb();
  if (!db) return;
  const profile = await getOrCreateProfile(userId);
  if (!profile) return;
  const existing = (profile.traits as Record<string, unknown>) ?? {};
  const merged = { ...existing, ...newTraits };
  await db.update(userProfiles).set({ traits: merged }).where(eq(userProfiles.userId, userId));
}

// ─── Admin GPS Location Review ────────────────────────────────────────────────
export async function getUsersWithGpsLocations() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      displayName: userProfiles.displayName,
      avatarEmoji: userProfiles.avatarEmoji,
      latitude: userProfiles.latitude,
      longitude: userProfiles.longitude,
      city: userProfiles.city,
      claimedCity: userProfiles.claimedCity,
      gpsVerifiedLat: userProfiles.gpsVerifiedLat,
      gpsVerifiedLng: userProfiles.gpsVerifiedLng,
      gpsVerifiedCity: userProfiles.gpsVerifiedCity,
      gpsVerifiedAt: userProfiles.gpsVerifiedAt,
      locationVerified: userProfiles.locationVerified,
      isVerified: userProfiles.isVerified,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .orderBy(desc(users.createdAt));
  return rows;
}

// ─── User Homepage Layout ─────────────────────────────────────────────────────

export async function getHomepageLayout(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(userHomepageLayout)
    .where(eq(userHomepageLayout.userId, userId))
    .orderBy(userHomepageLayout.position);
}

export async function saveHomepageLayout(
  userId: number,
  modules: Array<{ moduleId: string; position: number; pinned: boolean }>
) {
  const db = await getDb();
  if (!db) return;
  // Upsert each module row
  for (const m of modules) {
    await db
      .insert(userHomepageLayout)
      .values({ userId, moduleId: m.moduleId, position: m.position, pinned: m.pinned })
      .onDuplicateKeyUpdate({ set: { position: m.position, pinned: m.pinned } });
  }
}

// ─── Today’s Plan ──────────────────────────────────────────────────────────────
export async function getTodaysPlan(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(todaysPlans).where(eq(todaysPlans.userId, userId)).limit(1);
  return rows[0] ?? null;
}

export async function saveTodaysPlan(userId: number, data: { eventId?: number | null; activityId?: number | null; note?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(todaysPlans).values({ userId, eventId: data.eventId ?? null, activityId: data.activityId ?? null, note: data.note ?? null }).onDuplicateKeyUpdate({
    set: { eventId: data.eventId ?? null, activityId: data.activityId ?? null, note: data.note ?? null },
  });
  return getTodaysPlan(userId);
}

export async function clearTodaysPlan(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(todaysPlans).where(eq(todaysPlans.userId, userId));
}

// ─── Event Interests ──────────────────────────────────────────────────────────
export async function markEventInterest(userId: number, eventId: number, status: "interested" | "going" | "attended" = "interested") {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  
  // Check for existing interest
  const existing = await db
    .select()
    .from(eventInterests)
    .where(and(eq(eventInterests.userId, userId), eq(eventInterests.eventId, eventId)))
    .limit(1);
  
  if (existing.length > 0) {
    // Update existing interest
    await db
      .update(eventInterests)
      .set({ status })
      .where(and(eq(eventInterests.userId, userId), eq(eventInterests.eventId, eventId)));
  } else {
    // Insert new interest
    await db.insert(eventInterests).values({ userId, eventId, status });
  }
  
  return { success: true };
}

export async function removeEventInterest(userId: number, eventId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  
  await db
    .delete(eventInterests)
    .where(and(eq(eventInterests.userId, userId), eq(eventInterests.eventId, eventId)));
  
  return { success: true };
}

export async function getEventInterests(eventId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select({
      interest: eventInterests,
      user: {
        id: users.id,
        name: users.name,
        displayName: userProfiles.displayName,
        avatarEmoji: userProfiles.avatarEmoji,
        avatarColor: userProfiles.avatarColor,
      },
    })
    .from(eventInterests)
    .innerJoin(users, eq(eventInterests.userId, users.id))
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(eq(eventInterests.eventId, eventId))
    .orderBy(desc(eventInterests.interestedAt));
}

export async function getInterestedCount(eventId: number) {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(eventInterests)
    .where(eq(eventInterests.eventId, eventId));
  
  return result[0]?.count ?? 0;
}

export async function getUserEventInterests(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select({
      interest: eventInterests,
      event: communityEvents,
    })
    .from(eventInterests)
    .innerJoin(communityEvents, eq(eventInterests.eventId, communityEvents.id))
    .where(eq(eventInterests.userId, userId))
    .orderBy(desc(communityEvents.eventDate));
}

export async function getMatchesInterestedInSameEvents(userId: number, eventId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get all users interested in this event
  const interestedUsers = await db
    .select({ userId: eventInterests.userId })
    .from(eventInterests)
    .where(eq(eventInterests.eventId, eventId));
  
  const interestedUserIds = interestedUsers.map(u => u.userId).filter(id => id !== userId);
  
  if (interestedUserIds.length === 0) return [];
  
  // Find matches for this user that are also interested
  return db
    .select({
      match: matches,
      profile: userProfiles,
    })
    .from(matches)
    .innerJoin(userProfiles, eq(userProfiles.userId, matches.user2Id))
    .where(
      and(
        eq(matches.user1Id, userId),
        or(...interestedUserIds.map(id => eq(matches.user2Id, id)))
      )
    );
}

// ─── Personalized public pickup activities ─────────────────────────────────────
export async function getPickupAlertPreference(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(pickupAlertPreferences).where(eq(pickupAlertPreferences.userId, userId)).limit(1);
  return rows[0] ?? null;
}

export async function savePickupAlertPreference(userId: number, input: { enabled: boolean; city?: string | null; categories?: string[] }) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const values = {
    userId,
    enabled: input.enabled,
    city: input.city?.trim() || null,
    categories: input.categories ?? [],
  };
  await db.insert(pickupAlertPreferences).values(values).onDuplicateKeyUpdate({
    set: { enabled: values.enabled, city: values.city, categories: values.categories },
  });
  return getPickupAlertPreference(userId);
}

export async function getMemberPreferredPickupCategories(userId: number): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const [eventSignals, activitySignals, bookmarkSignals, alertPreference] = await Promise.all([
    db.select({ category: communityEvents.category, status: eventInterests.status })
      .from(eventInterests)
      .innerJoin(communityEvents, eq(eventInterests.eventId, communityEvents.id))
      .where(eq(eventInterests.userId, userId)),
    db.select({ category: activityListings.category, status: activityRsvps.status, checkedIn: activityRsvps.checkedIn })
      .from(activityRsvps)
      .innerJoin(activityListings, eq(activityRsvps.activityId, activityListings.id))
      .where(eq(activityRsvps.userId, userId)),
    db.select({ category: activityListings.category })
      .from(activityBookmarks)
      .innerJoin(activityListings, eq(activityBookmarks.activityId, activityListings.id))
      .where(eq(activityBookmarks.userId, userId)),
    getPickupAlertPreference(userId),
  ]);
  const categories = new Set<string>(alertPreference?.categories ?? []);
  for (const signal of eventSignals) {
    if (signal.status === "attended" || signal.status === "going" || signal.status === "interested") {
      categories.add(signal.category);
      if (signal.category === "sports") categories.add("basketball");
      if (signal.category === "community") categories.add("bowling");
    }
  }
  for (const signal of activitySignals) {
    if (signal.status === "going" || signal.status === "maybe" || signal.checkedIn) {
      categories.add(signal.category);
      if (signal.category === "sports") categories.add("basketball");
    }
  }
  for (const signal of bookmarkSignals) categories.add(signal.category);
  return Array.from(categories);
}

export async function createPickupSession(data: {
  hostUserId: number;
  activityType: PickupActivityType;
  title: string;
  description?: string;
  city: string;
  state: string;
  venueName: string;
  venueAddress?: string;
  startAt: Date;
  endAt?: Date;
  capacity: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(pickupSessions).values({ ...data, status: "open" });
  const created = await db.select().from(pickupSessions).where(eq(pickupSessions.hostUserId, data.hostUserId)).orderBy(desc(pickupSessions.createdAt)).limit(1);
  const session = created[0];
  if (!session) throw new Error("Pickup session could not be created");
  await db.insert(pickupParticipants).values({ sessionId: session.id, userId: data.hostUserId, status: "joined" });
  return session;
}

export async function getPickupSessionsForMember(userId: number, city?: string) {
  const db = await getDb();
  if (!db) return [];
  const [rows, preferredCategories] = await Promise.all([
    db.select().from(pickupSessions).where(eq(pickupSessions.status, "open")).orderBy(pickupSessions.startAt).limit(100),
    getMemberPreferredPickupCategories(userId),
  ]);
  const eligible = rows.filter((session) => session.startAt > new Date() && (!city || session.city.toLowerCase() === city.toLowerCase()));
  const participantRows = await db.select().from(pickupParticipants);
  return eligible
    .map((session) => {
      const participants = participantRows.filter((entry) => entry.sessionId === session.id && entry.status !== "declined");
      return {
        ...session,
        participantCount: participants.length,
        joined: participants.some((entry) => entry.userId === userId && entry.status === "joined"),
        recommended: isPickupPreferenceMatch(session.activityType as PickupActivityType, preferredCategories),
      };
    })
    .sort((a, b) => Number(b.recommended) - Number(a.recommended) || a.startAt.getTime() - b.startAt.getTime());
}

export async function joinPickupSession(sessionId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const session = (await db.select().from(pickupSessions).where(eq(pickupSessions.id, sessionId)).limit(1))[0];
  if (!session || session.status !== "open" || session.startAt <= new Date()) throw new Error("This pickup activity is no longer open.");
  const participants = await db.select().from(pickupParticipants).where(eq(pickupParticipants.sessionId, sessionId));
  const existing = participants.find((entry) => entry.userId === userId);
  if (!existing && participants.filter((entry) => entry.status === "joined").length >= session.capacity) throw new Error("This pickup activity is full.");
  if (existing) {
    await db.update(pickupParticipants).set({ status: "joined" }).where(eq(pickupParticipants.id, existing.id));
  } else {
    await db.insert(pickupParticipants).values({ sessionId, userId, status: "joined" });
  }
  const preference = await getPickupAlertPreference(userId);
  await savePickupAlertPreference(userId, {
    enabled: preference?.enabled ?? false,
    city: preference?.city ?? session.city,
    categories: Array.from(new Set([...(preference?.categories ?? []), PICKUP_ALERT_CATEGORY[session.activityType as PickupActivityType]])),
  });
  return { success: true };
}

export async function notifyNearbyPickupMembers(session: typeof pickupSessions.$inferSelect) {
  const db = await getDb();
  if (!db) return 0;
  const candidates = await db
    .select({ preference: pickupAlertPreferences, profile: userProfiles })
    .from(pickupAlertPreferences)
    .leftJoin(userProfiles, eq(pickupAlertPreferences.userId, userProfiles.userId));
  const recipients = candidates.filter(({ preference, profile }) =>
    preference.enabled && preference.userId !== session.hostUserId &&
    (!preference.city || preference.city.toLowerCase() === session.city.toLowerCase() || profile?.city?.toLowerCase() === session.city.toLowerCase()) &&
    isPickupPreferenceMatch(session.activityType as PickupActivityType, preference.categories ?? []),
  );
  await Promise.all(recipients.map(({ preference }) => createNotification(
    preference.userId,
    "pickup_invite",
    `Nearby ${session.activityType === "bowling_singles" ? "bowling singles mixer" : "pickup activity"}`,
    `${session.title} · ${session.venueName} · ${session.startAt.toLocaleString()}. Public venue—opt in only if it works for you.`,
    session.id,
  )));
  return recipients.length;
}

// ─── Saved travel locations ───────────────────────────────────────────────────

export type SavedLocationInput = {
  label: string;
  city: string;
  state: string;
  postalCode?: string;
  latitude: string;
  longitude: string;
  isHome?: boolean;
};

export async function listSavedLocations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(savedLocations)
    .where(eq(savedLocations.userId, userId))
    .orderBy(desc(savedLocations.isHome), savedLocations.label);
}

export async function createSavedLocation(userId: number, input: SavedLocationInput) {
  const db = await getDb();
  if (!db) return null;
  const existing = await db
    .select({ id: savedLocations.id })
    .from(savedLocations)
    .where(eq(savedLocations.userId, userId));
  const normalized = normalizeSavedLocationDraft(input, existing.length === 0);
  if (normalized.isHome) {
    await db.update(savedLocations).set({ isHome: false }).where(eq(savedLocations.userId, userId));
  }
  await db.insert(savedLocations).values({
    userId,
    label: normalized.label,
    city: normalized.city,
    state: normalized.state,
    postalCode: normalized.postalCode,
    latitude: normalized.latitude,
    longitude: normalized.longitude,
    isHome: normalized.isHome,
  });
  const rows = await db
    .select()
    .from(savedLocations)
    .where(eq(savedLocations.userId, userId))
    .orderBy(desc(savedLocations.id));
  return rows[0] ?? null;
}

export async function updateSavedLocation(userId: number, id: number, input: { label?: string; isHome?: boolean }) {
  const db = await getDb();
  if (!db) return null;
  if (input.isHome) {
    await db.update(savedLocations).set({ isHome: false }).where(eq(savedLocations.userId, userId));
  }
  const setValues: Record<string, unknown> = {};
  if (input.label !== undefined) setValues.label = input.label.trim();
  if (input.isHome !== undefined) setValues.isHome = input.isHome;
  if (Object.keys(setValues).length > 0) {
    await db
      .update(savedLocations)
      .set(setValues)
      .where(and(eq(savedLocations.id, id), eq(savedLocations.userId, userId)));
  }
  const rows = await db
    .select()
    .from(savedLocations)
    .where(and(eq(savedLocations.id, id), eq(savedLocations.userId, userId)));
  return rows[0] ?? null;
}

export async function deleteSavedLocation(userId: number, id: number) {
  const db = await getDb();
  if (!db) return false;
  await db.delete(savedLocations).where(and(eq(savedLocations.id, id), eq(savedLocations.userId, userId)));
  return true;
}
