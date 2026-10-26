import {
  bigint,
  boolean,
  date,
  double,
  int,
  json,
	mysqlEnum,
	mysqlTable,
	text,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/mysql-core";

// ─── Core user table ──────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  /** Original Manus open id, kept after openId is switched to the Supabase user id. */
  legacyOpenId: varchar("legacyOpenId", { length: 64 }),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  emailVerified: boolean("emailVerified").notNull().default(false),
  emailVerifyToken: varchar("emailVerifyToken", { length: 128 }),
  emailVerifyExpires: timestamp("emailVerifyExpires"),
  role: mysqlEnum("role", ["user", "admin", "banned"]).default("user").notNull(),
  adminPromotedAt: timestamp("adminPromotedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  passkeyVerified: boolean("passkeyVerified").notNull().default(false),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Profile traits type ──────────────────────────────────────────────────────
export type ProfileTraits = {
  hobbies?: string[];
  favoriteActivities?: string[];
  personalityKeywords?: string[];
  dreamVacation?: string;
  favoriteFood?: string;
  morningOrNight?: string;
  biggestPetPeeve?: string;
  guiltPleasure?: string;
  idealWeekend?: string;
  funFact?: string;
  lookingFor?: string;
  idealDate?: string;
  perfectSunday?: string;
  aiSummary?: string;
  /** Direct preference phrases saved from explicit Would You Rather selections. */
  wyrInsights?: string[];
  connectionPreferences?: {
    community: true;
    friendship: boolean;
    dating: boolean;
    gymBuddy: boolean;
  };
  /** A private preference that helps Sally frame first-meet suggestions. */
  meetupSafetyPreference?: "public_daytime" | "public_anytime" | "group_first";
  [key: string]: unknown;
};

// ─── User profiles ────────────────────────────────────────────────────────────
export const userProfiles = mysqlTable("user_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  avatarEmoji: varchar("avatarEmoji", { length: 10 }).notNull().default("😊"),
  avatarColor: varchar("avatarColor", { length: 20 }).notNull().default("#f97316"),
  displayName: varchar("displayName", { length: 100 }),
  bio: text("bio"),
  networkType: mysqlEnum("networkType", ["singles", "couples", "community"]).notNull().default("singles"),
  traits: json("traits").$type<ProfileTraits>().notNull().$default(() => ({})),
  interviewCount: int("interviewCount").notNull().default(0),
  isVerified: boolean("isVerified").notNull().default(false),
  onboardingComplete: boolean("onboardingComplete").notNull().default(false),
  latitude: varchar("latitude", { length: 20 }),
  longitude: varchar("longitude", { length: 20 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 32 }),
  campusId: int("campusId"),
  schoolEmail: varchar("schoolEmail", { length: 320 }),
  inviteCode: varchar("inviteCode", { length: 40 }),
  isAmbassador: boolean("isAmbassador").notNull().default(false),
  claimedCity: varchar("claimedCity", { length: 100 }),
  gpsVerifiedLat: varchar("gpsVerifiedLat", { length: 20 }),
  gpsVerifiedLng: varchar("gpsVerifiedLng", { length: 20 }),
  gpsVerifiedCity: varchar("gpsVerifiedCity", { length: 100 }),
  gpsVerifiedAt: timestamp("gpsVerifiedAt"),
  locationVerified: boolean("locationVerified").notNull().default(false),
  gender: mysqlEnum("gender", ["man", "woman", "non_binary", "other", "prefer_not_to_say"]),
  sexualOrientation: mysqlEnum("sexualOrientation", ["straight", "gay", "lesbian", "bisexual", "pansexual", "asexual", "queer", "other", "prefer_not_to_say"]),
  birthDate: date("birth_date"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Profile Photos ───────────────────────────────────────────────────────────
export const profilePhotos = mysqlTable("profile_photos", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  s3Key: varchar("s3Key", { length: 512 }).notNull(),
  url: varchar("url", { length: 1024 }).notNull(),
  isPrimary: boolean("isPrimary").notNull().default(false),
  exifLat: varchar("exifLat", { length: 20 }),
  exifLng: varchar("exifLng", { length: 20 }),
  exifCity: varchar("exifCity", { length: 100 }),
  cityVerified: boolean("cityVerified").notNull().default(false),
  verificationNote: varchar("verificationNote", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProfilePhoto = typeof profilePhotos.$inferSelect;
export type InsertProfilePhoto = typeof profilePhotos.$inferInsert;

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = typeof userProfiles.$inferInsert;

// ─── Interview message type ───────────────────────────────────────────────────
export type InterviewMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

// ─── Interview sessions ───────────────────────────────────────────────────────
export const interviewSessions = mysqlTable("interview_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  messages: json("messages").$type<InterviewMessage[]>().notNull().$default(() => []),
  extractedTraits: json("extractedTraits").$type<ProfileTraits>().notNull().$default(() => ({})),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InterviewSession = typeof interviewSessions.$inferSelect;

// ─── Matches ──────────────────────────────────────────────────────────────────
export const matches = mysqlTable("matches", {
  id: int("id").autoincrement().primaryKey(),
  user1Id: int("user1Id").notNull(),
  user2Id: int("user2Id").notNull(),
  compatibilityScore: int("compatibilityScore").notNull().default(0),
  compatibilityReason: text("compatibilityReason"),
  status: mysqlEnum("status", ["pending", "active", "completed"]).notNull().default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Match = typeof matches.$inferSelect;

// ─── Chat messages ────────────────────────────────────────────────────────────
export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  matchId: int("matchId").notNull(),
  senderId: int("senderId").notNull(),
  content: text("content").notNull(),
  messageType: mysqlEnum("messageType", ["text", "event_proposal"]).notNull().default("text"),
  proposalId: int("proposalId"),
  isRead: boolean("isRead").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;

// ─── Public event proposals ────────────────────────────────────────────────────
// Proposals are only available between existing matches and always point to a
// public community event. They do not expose contact information or locations.
export const eventProposals = mysqlTable("event_proposals", {
  id: int("id").autoincrement().primaryKey(),
  matchId: int("matchId").notNull(),
  eventId: int("eventId").notNull(),
  proposerId: int("proposerId").notNull(),
  recipientId: int("recipientId").notNull(),
  note: varchar("note", { length: 500 }),
  status: mysqlEnum("status", ["pending", "accepted", "declined", "withdrawn"]).notNull().default("pending"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  respondedAt: timestamp("respondedAt"),
});

export type EventProposal = typeof eventProposals.$inferSelect;

// ─── Pick a Plan ──────────────────────────────────────────────────────────────
// Candidate events are selected server-side from current public community events.
// Votes remain private until both matched members choose the same candidate.
export const pickPlanRounds = mysqlTable("pick_plan_rounds", {
  id: int("id").autoincrement().primaryKey(),
  matchId: int("matchId").notNull(),
  creatorId: int("creatorId").notNull(),
  candidateEventIds: json("candidateEventIds").$type<number[]>().notNull().$default(() => []),
  status: mysqlEnum("status", ["voting", "matched", "expired", "cancelled"]).notNull().default("voting"),
  matchedEventId: int("matchedEventId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
});
export type PickPlanRound = typeof pickPlanRounds.$inferSelect;

export const pickPlanVotes = mysqlTable("pick_plan_votes", {
  id: int("id").autoincrement().primaryKey(),
  roundId: int("roundId").notNull(),
  userId: int("userId").notNull(),
  eventId: int("eventId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  pickPlanRoundMemberUnique: uniqueIndex("pick_plan_round_member_unique").on(table.roundId, table.userId),
}));
export type PickPlanVote = typeof pickPlanVotes.$inferSelect;

// ─── Match game question type (used for newlywed/two-truths/this-or-that games) ─
export type MatchGameQuestion = {
  id: string;
  question: string;
  targetUserId: number;
  targetUserName: string;
  correctAnswer?: string;
  user1Answer?: string;
  user2Answer?: string;
  user1Correct?: boolean;
  user2Correct?: boolean;
  // Two Truths and a Lie
  statements?: string[];
  lieIndex?: number;
  // This or That
  optionA?: string;
  optionB?: string;
};

// ─── Game sessions ────────────────────────────────────────────────────────────
export const gameSessions = mysqlTable("game_sessions", {
  id: int("id").autoincrement().primaryKey(),
  matchId: int("matchId").notNull(),
  gameType: mysqlEnum("gameType", ["newlywed", "two_truths", "this_or_that"]).notNull().default("newlywed"),
  questions: json("questions").$type<MatchGameQuestion[]>().notNull().$default(() => []),
  status: mysqlEnum("status", ["waiting", "in_progress", "completed"]).notNull().default("waiting"),
  user1Score: int("user1Score").notNull().default(0),
  user2Score: int("user2Score").notNull().default(0),
  sallyNarration: text("sallyNarration"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type GameSession = typeof gameSessions.$inferSelect;

// ─── Notifications ────────────────────────────────────────────────────────────
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["new_match", "game_ready", "new_message", "interview_reminder", "pickup_invite", "event_proposal", "report_update", "birthday_reminder"]).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body").notNull(),
  isRead: boolean("isRead").notNull().default(false),
  relatedId: int("relatedId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
});

export type Notification = typeof notifications.$inferSelect;

// ─── Birthday reminders (private, matched-member only) ────────────────────────
export const birthdayNotifications = mysqlTable("birthday_notifications", {
  id: int("id").autoincrement().primaryKey(),
  recipientUserId: int("recipientUserId").notNull(),
  birthdayUserId: int("birthdayUserId").notNull(),
  matchId: int("matchId").notNull(),
  birthdayDateKey: varchar("birthdayDateKey", { length: 10 }).notNull(), // YYYY-MM-DD in the reminder run's UTC date
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  recipientBirthdayDateUnique: uniqueIndex("birthday_notifications_recipient_birthday_date_unique")
    .on(table.recipientUserId, table.birthdayUserId, table.birthdayDateKey),
}));

export type BirthdayNotification = typeof birthdayNotifications.$inferSelect;

// ─── Reports ──────────────────────────────────────────────────────────────────
export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  reporterId: int("reporterId").notNull(),
  reportedUserId: int("reportedUserId").notNull(),
  reason: mysqlEnum("reason", ["scammer", "bot", "harassment", "fake_profile", "inappropriate", "other"]).notNull(),
  details: text("details"),
  status: mysqlEnum("status", ["pending", "reviewed", "actioned", "dismissed"]).notNull().default("pending"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  reviewedAt: timestamp("reviewedAt"),
});

export type Report = typeof reports.$inferSelect;

// ─── Blocks ───────────────────────────────────────────────────────────────────
export const blocks = mysqlTable("blocks", {
  id: int("id").autoincrement().primaryKey(),
  blockerId: int("blockerId").notNull(),
  blockedUserId: int("blockedUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Block = typeof blocks.$inferSelect;

// ─── Admin Flags ──────────────────────────────────────────────────────────────
export const adminFlags = mysqlTable("admin_flags", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  flagType: mysqlEnum("flagType", ["bot_behavior", "multiple_reports", "suspicious_location", "identity_mismatch", "manual_review"]).notNull(),
  severity: mysqlEnum("severity", ["low", "medium", "high"]).notNull().default("medium"),
  notes: text("notes"),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AdminFlag = typeof adminFlags.$inferSelect;

// ─── Venue / Vendor Partners ──────────────────────────────────────────────────
export const venuePartners = mysqlTable("venue_partners", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  category: mysqlEnum("category", [
    "bowling", "mini_golf", "kayaking", "movies", "dining", "coffee",
    "cooking_class", "escape_room", "wine_tasting", "hiking", "park",
    "library", "church", "community_center", "sports", "arts", "swimming_pool",
    "beach", "basketball", "dirt_track", "ymca", "public_gym", "golf",
    "disc_golf", "volleyball", "tennis", "other"
  ]).notNull().default("other"),
  description: text("description"),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  latitude: varchar("latitude", { length: 20 }),
  longitude: varchar("longitude", { length: 20 }),
  phone: varchar("phone", { length: 30 }),
  website: varchar("website", { length: 300 }),
  isPublicAccess: boolean("is_public_access").notNull().default(false),
  accessNotes: varchar("access_notes", { length: 300 }),
  isLocallyOwned: boolean("is_locally_owned").notNull().default(false),
  ownershipNote: varchar("ownership_note", { length: 300 }),
  referralFeePerVisit: int("referralFeePerVisit").notNull().default(100), // cents
  commissionPct: int("commissionPct").notNull().default(12), // platform commission on bookings (percent)
  ownerUserId: int("ownerUserId"), // vendor account that owns this venue
  contactEmail: varchar("contactEmail", { length: 320 }),
  isActive: boolean("isActive").notNull().default(true),
  isFeatured: boolean("isFeatured").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type VenuePartner = typeof venuePartners.$inferSelect;
export type InsertVenuePartner = typeof venuePartners.$inferInsert;

// ─── Activity Listings ────────────────────────────────────────────────────────
export const activityListings = mysqlTable("activity_listings", {
  id: int("id").autoincrement().primaryKey(),
  venueId: int("venueId").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  category: mysqlEnum("category", [
    "bowling", "mini_golf", "kayaking", "movies", "dining", "coffee",
    "cooking_class", "escape_room", "wine_tasting", "hiking", "park",
    "library", "church", "community_center", "sports", "arts", "swimming_pool",
    "beach", "basketball", "dirt_track", "ymca", "public_gym", "golf",
    "disc_golf", "volleyball", "tennis", "other"
  ]).notNull().default("other"),
  eventDate: timestamp("eventDate"),
  durationMinutes: int("durationMinutes").default(120),
  maxGroupSize: int("maxGroupSize").default(10),
  minGroupSize: int("minGroupSize").default(2),
  isRecurring: boolean("isRecurring").notNull().default(false),
  recurringSchedule: varchar("recurringSchedule", { length: 100 }), // e.g. "Every Saturday 2pm"
  checkInCode: varchar("checkInCode", { length: 20 }),
  totalReferrals: int("totalReferrals").notNull().default(0),
  // Marketplace fields — users are FREE; price is what vendors charge, platform takes commission
  priceCents: int("priceCents").notNull().default(0), // 0 = free RSVP activity
  hasTickets: boolean("hasTickets").notNull().default(false),
  imageEmoji: varchar("imageEmoji", { length: 10 }).notNull().default("\uD83C\uDF89"),
  isPublicAccess: boolean("is_public_access").notNull().default(false),
  accessNotes: varchar("access_notes", { length: 300 }),
  isSponsored: boolean("isSponsored").notNull().default(false),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityListing = typeof activityListings.$inferSelect;
export type InsertActivityListing = typeof activityListings.$inferInsert;

// ─── Sponsored Activity Placements ────────────────────────────────────────────
// Paid business placements are always clearly disclosed in discovery and only activate after verified Checkout payment.
export const sponsoredPlacements = mysqlTable("sponsored_placements", {
  id: int("id").autoincrement().primaryKey(),
  activityId: int("activity_id").notNull(),
  venueId: int("venue_id").notNull(),
  purchaserUserId: int("purchaser_user_id").notNull(),
  packageCode: mysqlEnum("package_code", ["week", "month"]).notNull(),
  amountCents: int("amount_cents").notNull(),
  status: mysqlEnum("status", ["checkout_pending", "active", "expired", "cancelled"]).notNull().default("checkout_pending"),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  stripeCheckoutSessionId: varchar("stripe_checkout_session_id", { length: 255 }).unique(),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type SponsoredPlacement = typeof sponsoredPlacements.$inferSelect;

// ─── Sponsored Placement Performance Events ───────────────────────────────────
// Business dashboards receive only aggregate outcomes; this event store is never exposed with member identities.
export const sponsoredPlacementEvents = mysqlTable("sponsored_placement_events", {
  id: int("id").autoincrement().primaryKey(),
  placementId: int("placement_id").notNull(),
  activityId: int("activity_id").notNull(),
  userId: int("user_id").notNull(),
  eventType: mysqlEnum("event_type", ["view", "click", "sign_up"]).notNull(),
  eventDay: date("event_day").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type SponsoredPlacementEvent = typeof sponsoredPlacementEvents.$inferSelect;

// ─── Public Activity Discovery Refreshes ──────────────────────────────────────
export const cityActivityRefreshes = mysqlTable("city_activity_refreshes", {
  id: int("id").autoincrement().primaryKey(),
  city: varchar("city", { length: 100 }).notNull(),
  state: varchar("state", { length: 32 }),
  lastRefreshedAt: timestamp("last_refreshed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Activity RSVPs ───────────────────────────────────────────────────────────
export const activityRsvps = mysqlTable("activity_rsvps", {
  id: int("id").autoincrement().primaryKey(),
  activityId: int("activityId").notNull(),
  userId: int("userId").notNull(),
  matchId: int("matchId"), // optional — if attending with a match
  status: mysqlEnum("status", ["going", "maybe", "not_going"]).notNull().default("going"),
  checkedIn: boolean("checkedIn").notNull().default(false),
  checkedInAt: timestamp("checkedInAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityRsvp = typeof activityRsvps.$inferSelect;

// ─── Activity Bookmarks ─────────────────────────────────────────────────────
export const activityBookmarks = mysqlTable("activity_bookmarks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  activityId: int("activityId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userActivityUnique: uniqueIndex("activity_bookmarks_user_activity_unique").on(table.userId, table.activityId),
}));
export type ActivityBookmark = typeof activityBookmarks.$inferSelect;

// ─── Community Groups ─────────────────────────────────────────────────────────
export const communityGroups = mysqlTable("community_groups", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  category: mysqlEnum("category", [
    "book_club", "hiking", "cooking", "sports", "arts", "music",
    "gaming", "travel", "fitness", "social", "other"
  ]).notNull().default("other"),
  city: varchar("city", { length: 100 }),
  createdByUserId: int("createdByUserId").notNull(),
  maxMembers: int("maxMembers").default(20),
  isPublic: boolean("isPublic").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CommunityGroup = typeof communityGroups.$inferSelect;

// ─── Community Group Members ──────────────────────────────────────────────────
export const communityGroupMembers = mysqlTable("community_group_members", {
  id: int("id").autoincrement().primaryKey(),
  groupId: int("groupId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["member", "organizer"]).notNull().default("member"),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
});

export type CommunityGroupMember = typeof communityGroupMembers.$inferSelect;

// ─── Marketplace pricing additions live on activityListings (see migration) ─────
// New columns added via migration: priceCents, hasTickets, imageEmoji

// ─── Bookings (marketplace tickets / reservations) ──────────────────────────────
export const bookings = mysqlTable("bookings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  activityId: int("activityId").notNull(),
  venueId: int("venueId").notNull(),
  matchId: int("matchId"), // optional — booked with a match
  partySize: int("partySize").notNull().default(2),
  // Money in cents. Users are FREE — these track what vendors owe / commission.
  unitPriceCents: int("unitPriceCents").notNull().default(0),
  totalPriceCents: int("totalPriceCents").notNull().default(0),
  commissionCents: int("commissionCents").notNull().default(0), // platform earnings from vendor
  referralFeeCents: int("referralFeeCents").notNull().default(0), // pay-per-visit owed by vendor
  bookingType: mysqlEnum("bookingType", ["ticket", "reservation", "rsvp_free"]).notNull().default("ticket"),
  status: mysqlEnum("status", ["confirmed", "cancelled", "completed", "checked_in"]).notNull().default("confirmed"),
  confirmationCode: varchar("confirmationCode", { length: 20 }).notNull(),
  scheduledFor: timestamp("scheduledFor"),
  notes: text("notes"),
  // Stripe identifiers only; card details remain exclusively with Stripe.
  stripeCheckoutSessionId: varchar("stripeCheckoutSessionId", { length: 255 }).unique(),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  // A member’s requested alternative time remains a request until the venue confirms it.
  rescheduleRequestedFor: timestamp("rescheduleRequestedFor"),
  rescheduleRequestNote: text("rescheduleRequestNote"),
  rescheduleRequestedAt: timestamp("rescheduleRequestedAt"),
  checkedInAt: timestamp("checkedInAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = typeof bookings.$inferInsert;

// ─── Sally Date Concierge requests ──────────────────────────────────────────────
export type ConciergePlanItem = {
  label: string;
  detail: string;
  estCostCents?: number;
  vendorName?: string;
};

export const conciergeRequests = mysqlTable("concierge_requests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  matchId: int("matchId"), // optional — arranging a date with a match
  occasion: varchar("occasion", { length: 120 }).notNull().default("date"),
  vibe: varchar("vibe", { length: 200 }), // e.g. "romantic picnic in the park"
  location: varchar("location", { length: 200 }),
  budgetCents: int("budgetCents").notNull().default(5000),
  partySize: int("partySize").notNull().default(2),
  preferredDate: timestamp("preferredDate"),
  dietaryNotes: text("dietaryNotes"),
  // Sally's generated plan
  sallyPlanTitle: varchar("sallyPlanTitle", { length: 200 }),
  sallyPlanSummary: text("sallyPlanSummary"),
  sallyPlanItems: json("sallyPlanItems").$type<ConciergePlanItem[]>().$default(() => []),
  estTotalCents: int("estTotalCents").notNull().default(0),
  status: mysqlEnum("status", ["draft", "proposed", "confirmed", "arranged", "completed", "cancelled"]).notNull().default("draft"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ConciergeRequest = typeof conciergeRequests.$inferSelect;
export type InsertConciergeRequest = typeof conciergeRequests.$inferInsert;

// ─── Couple links (Couples Network: couple-to-couple matching) ──────────────────
export const coupleLinks = mysqlTable("couple_links", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // owner of this couple profile
  partnerName: varchar("partnerName", { length: 100 }).notNull(),
  partnerEmail: varchar("partnerEmail", { length: 320 }),
  relationshipLength: varchar("relationshipLength", { length: 60 }), // e.g. "3 years"
  sharedInterests: json("sharedInterests").$type<string[]>().$default(() => []),
  lookingFor: text("lookingFor"), // what kind of couples/activities they want
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CoupleLink = typeof coupleLinks.$inferSelect;
export type InsertCoupleLink = typeof coupleLinks.$inferInsert;

// ─── Couple matches (between two couple profiles) ───────────────────────────────
export const coupleMatches = mysqlTable("couple_matches", {
  id: int("id").autoincrement().primaryKey(),
  couple1UserId: int("couple1UserId").notNull(),
  couple2UserId: int("couple2UserId").notNull(),
  compatibilityScore: int("compatibilityScore").notNull().default(0),
  compatibilityReason: text("compatibilityReason"),
  status: mysqlEnum("status", ["active", "completed"]).notNull().default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CoupleMatch = typeof coupleMatches.$inferSelect;

// ─── Campuses (campus-by-campus growth) ─────────────────────────────────────────
export const campuses = mysqlTable("campuses", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  shortName: varchar("shortName", { length: 60 }),
  city: varchar("city", { length: 100 }).notNull(),
  state: varchar("state", { length: 60 }).notNull(),
  // Comma-separated allowed email domains (e.g. "carrollu.edu,pio.carrollu.edu")
  emailDomains: varchar("emailDomains", { length: 400 }).notNull().default(""),
  launchThreshold: int("launchThreshold").notNull().default(100),
  isLive: boolean("isLive").notNull().default(false),
  mascot: varchar("mascot", { length: 60 }),
  colorHex: varchar("colorHex", { length: 20 }).notNull().default("#f97316"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Campus = typeof campuses.$inferSelect;
export type InsertCampus = typeof campuses.$inferInsert;

// ─── Referrals (invite/referral viral loop) ─────────────────────────────────────
export const referrals = mysqlTable("referrals", {
  id: int("id").autoincrement().primaryKey(),
  inviterUserId: int("inviterUserId").notNull(),
  inviteeUserId: int("inviteeUserId").notNull(),
  inviteCode: varchar("inviteCode", { length: 40 }).notNull(),
  campusId: int("campusId"),
  status: mysqlEnum("status", ["joined", "verified"]).notNull().default("joined"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = typeof referrals.$inferInsert;

// ─── Would You Rather game (low AI cost: questions pre-written in DB) ────────────
export const wouldYouRatherQuestions = mysqlTable("would_you_rather_questions", {
  id: int("id").autoincrement().primaryKey(),
  optionA: varchar("optionA", { length: 300 }).notNull(),
  optionB: varchar("optionB", { length: 300 }).notNull(),
  category: mysqlEnum("category", ["food", "travel", "lifestyle", "romance", "fun", "deep", "campus"]).notNull().default("fun"),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WouldYouRatherQuestion = typeof wouldYouRatherQuestions.$inferSelect;
export type InsertWouldYouRatherQuestion = typeof wouldYouRatherQuestions.$inferInsert;

export const wouldYouRatherAnswers = mysqlTable("would_you_rather_answers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  questionId: int("questionId").notNull(),
  choice: mysqlEnum("choice", ["A", "B"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WouldYouRatherAnswer = typeof wouldYouRatherAnswers.$inferSelect;
export type InsertWouldYouRatherAnswer = typeof wouldYouRatherAnswers.$inferInsert;

// ─── Would You Rather 2-player challenges ────────────────────────────────────
export const wyrChallenges = mysqlTable("wyr_challenges", {
  id: int("id").autoincrement().primaryKey(),
  challengerId: int("challengerId").notNull(),   // user who sent the challenge
  challengedId: int("challengedId").notNull(),   // user who received it
  matchId: int("matchId"),                        // optional: tied to a match
  questionIds: json("questionIds").$type<number[]>().notNull().$default(() => []),
  status: mysqlEnum("status", ["pending", "active", "completed"]).notNull().default("pending"),
  compatibilityPct: int("compatibilityPct"),      // filled in once both finish
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});
export type WyrChallenge = typeof wyrChallenges.$inferSelect;
export type InsertWyrChallenge = typeof wyrChallenges.$inferInsert;

// ─── Community Events ─────────────────────────────────────────────────────────
export const communityEvents = mysqlTable("community_events", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: mysqlEnum("category", [
    "music", "food", "market", "sports", "arts", "community", "outdoors", "comedy", "karaoke", "live_music", "other"
  ]).notNull().default("other"),
  eventDate: timestamp("eventDate").notNull(),
  endDate: timestamp("endDate"),
  venueName: varchar("venueName", { length: 255 }),
  address: text("address"),
  city: varchar("city", { length: 100 }).notNull().default("Milwaukee"),
  state: varchar("state", { length: 50 }).notNull().default("WI"),
  isFree: boolean("isFree").notNull().default(true),
  priceCents: int("priceCents").notNull().default(0),
  externalUrl: text("externalUrl"),
  imageUrl: text("imageUrl"),
  source: mysqlEnum("source", ["community", "eventbrite", "admin", "milwaukee_library", "waukesha_library", "waukesha_county_parks", "brookfield_library", "visit_waukesha", "downtown_waukesha", "waukesha_chamber", "la_crosse_library", "la_crosse_parks", "uwm", "marquette", "onmilwaukee", "scraped", "jsonline", "milwaukee_journal", "waukesha_freeman", "newspaper", "college", "university", "church", "lions_club", "senior_center", "youth_group", "neighborhood", "general", "chicago_library", "chicago_museum"]).notNull().default("admin"),
  isOnCampus: boolean("isOnCampus").notNull().default(false),
  externalId: varchar("externalId", { length: 128 }),
  postedByUserId: int("postedByUserId"),
  rsvpCount: int("rsvpCount").notNull().default(0),
  isSponsored: boolean("isSponsored").notNull().default(false),
  hasThirdWheelHost: boolean("hasThirdWheelHost").notNull().default(false),
  thirdWheelHostNote: varchar("thirdWheelHostNote", { length: 280 }),
  isActive: boolean("isActive").notNull().default(true),
  lat: double("lat"),
  lng: double("lng"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CommunityEvent = typeof communityEvents.$inferSelect;
export type InsertCommunityEvent = typeof communityEvents.$inferInsert;

// ─── Event Source Health ─────────────────────────────────────────────────────
export const eventSourceHealth = mysqlTable("event_source_health", {
  id: int("id").autoincrement().primaryKey(),
  sourceKey: varchar("sourceKey", { length: 100 }).notNull().unique(),
  sourceLabel: varchar("sourceLabel", { length: 160 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  status: mysqlEnum("status", ["healthy", "empty", "failed"]).notNull().default("empty"),
  eventsFound: int("eventsFound").notNull().default(0),
  errorMessage: text("errorMessage"),
  lastAttemptedAt: timestamp("lastAttemptedAt").defaultNow().notNull(),
  lastSucceededAt: timestamp("lastSucceededAt"),
});
export type EventSourceHealth = typeof eventSourceHealth.$inferSelect;

// ─── Event RSVPs ──────────────────────────────────────────────────────────────
export const eventRsvps = mysqlTable("event_rsvps", {
  id: int("id").autoincrement().primaryKey(),
  eventId: int("eventId").notNull(),
  userId: int("userId").notNull(),
  openToSallyIntroduction: boolean("openToSallyIntroduction").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type EventRsvp = typeof eventRsvps.$inferSelect;

// ─── Mutual Event Introductions ──────────────────────────────────────────────
// A normalized attendee pair creates a durable uniqueness boundary, preventing
// concurrent mutual RSVP requests from creating duplicate private matches.
export const eventIntroductions = mysqlTable("event_introductions", {
  id: int("id").autoincrement().primaryKey(),
  eventId: int("eventId").notNull(),
  lowerUserId: int("lowerUserId").notNull(),
  higherUserId: int("higherUserId").notNull(),
  matchId: int("matchId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("event_introductions_pair_unique").on(table.eventId, table.lowerUserId, table.higherUserId),
]);
export type EventIntroduction = typeof eventIntroductions.$inferSelect;

// ─── Event Bookmarks ─────────────────────────────────────────────────────────
export const eventBookmarks = mysqlTable("event_bookmarks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  eventId: int("eventId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type EventBookmark = typeof eventBookmarks.$inferSelect;

// ─── WebAuthn Passkey Credentials ────────────────────────────────────────────
export const passkeyCredentials = mysqlTable("passkey_credentials", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  credentialId: varchar("credentialId", { length: 512 }).notNull().unique(),
  publicKey: text("publicKey").notNull(),
  counter: int("counter").notNull().default(0),
  deviceType: varchar("deviceType", { length: 64 }),
  transports: text("transports"), // JSON array string
  aaguid: varchar("aaguid", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastUsedAt: timestamp("lastUsedAt"),
});
export type PasskeyCredential = typeof passkeyCredentials.$inferSelect;
export type InsertPasskeyCredential = typeof passkeyCredentials.$inferInsert;

// ─── One-time WebAuthn Challenges ────────────────────────────────────────────
export const webauthnChallenges = mysqlTable("webauthn_challenges", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  purpose: mysqlEnum("purpose", ["registration", "authentication"]).notNull(),
  challenge: varchar("challenge", { length: 512 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  consumedAt: timestamp("consumedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("webauthn_challenges_user_purpose_unique").on(table.userId, table.purpose),
]);
export type WebauthnChallenge = typeof webauthnChallenges.$inferSelect;

// ─── Login Ads ────────────────────────────────────────────────────────────────
export const loginAds = mysqlTable("login_ads", {
  id: int("id").autoincrement().primaryKey(),
  vendorId: int("vendorId").notNull(), // references venue_partners.id
  title: varchar("title", { length: 255 }).notNull(),
  videoUrl: text("videoUrl").notNull(),
  ctaText: varchar("ctaText", { length: 128 }),
  ctaUrl: text("ctaUrl"),
  durationSeconds: int("durationSeconds").notNull().default(10),
  budgetCents: int("budgetCents").notNull().default(0),
  spentCents: int("spentCents").notNull().default(0),
  cpmCents: int("cpmCents").notNull().default(5), // cost per 1000 impressions in cents
  impressions: int("impressions").notNull().default(0),
  isActive: boolean("isActive").notNull().default(true),
  startsAt: timestamp("startsAt"),
  endsAt: timestamp("endsAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type LoginAd = typeof loginAds.$inferSelect;
export type InsertLoginAd = typeof loginAds.$inferInsert;

// ─── Venue Outreach Emails ────────────────────────────────────────────────────
export const venueOutreach = mysqlTable("venue_outreach", {
  id: int("id").autoincrement().primaryKey(),
  venueId: int("venueId").notNull(),
  sentByUserId: int("sentByUserId").notNull(),
  toEmail: varchar("toEmail", { length: 320 }).notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  body: text("body").notNull(),
  status: mysqlEnum("status", ["sent", "failed", "draft"]).notNull().default("sent"),
  fromEmail: varchar("fromEmail", { length: 320 }),
  providerMessageId: varchar("providerMessageId", { length: 255 }),
  errorMessage: text("errorMessage"),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
});
export type VenueOutreach = typeof venueOutreach.$inferSelect;
export type InsertVenueOutreach = typeof venueOutreach.$inferInsert;

// ─── Public Game Lobby ────────────────────────────────────────────────────────
export const gameRooms = mysqlTable("game_rooms", {
  id: int("id").autoincrement().primaryKey(),
  hostUserId: int("hostUserId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  gameType: mysqlEnum("gameType", ["would_you_rather", "trivia", "icebreaker", "two_truths", "finish_sentence", "bullgerdash", "team_builder"]).notNull().default("would_you_rather"),
  city: varchar("city", { length: 120 }),
  maxPlayers: int("maxPlayers").notNull().default(6),
  status: mysqlEnum("status", ["waiting", "in_progress", "finished"]).notNull().default("waiting"),
  currentQuestionIndex: int("currentQuestionIndex").notNull().default(0),
  questions: json("questions").$type<{ id: number; text: string; optionA?: string; optionB?: string }[]>(),
  answers: json("answers").$type<{ userId: number; questionIndex: number; answer: string; timestamp: number }[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type GameRoom = typeof gameRooms.$inferSelect;
export type InsertGameRoom = typeof gameRooms.$inferInsert;

export const gameRoomPlayers = mysqlTable("game_room_players", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  userId: int("userId").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  isActive: boolean("isActive").notNull().default(true),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
});
export type GameRoomPlayer = typeof gameRoomPlayers.$inferSelect;

// ─── Durable competitive game results ─────────────────────────────────────────
export const gameResults = mysqlTable("game_results", {
  id: int("id").autoincrement().primaryKey(),
  gameType: mysqlEnum("gameType", ["jeopardy", "trivia_pursuit"]).notNull(),
  roomId: int("roomId").notNull(),
  userId: int("userId").notNull(),
  score: int("score").notNull().default(0),
  rank: int("rank").notNull(),
  isWinner: boolean("isWinner").notNull().default(false),
  completedAt: timestamp("completedAt").defaultNow().notNull(),
}, (table) => ({
  gameResultRoomPlayerUnique: uniqueIndex("game_results_room_player_unique").on(table.gameType, table.roomId, table.userId),
}));
export type GameResult = typeof gameResults.$inferSelect;

// ─── Movie booking clicks (affiliate revenue tracking) ────────────────────────
export const movieBookingClicks = mysqlTable("movie_booking_clicks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  movieId: varchar("movieId", { length: 32 }).notNull(),
  movieTitle: varchar("movieTitle", { length: 255 }).notNull(),
  theaterId: varchar("theaterId", { length: 64 }).notNull().default("marcus-majestic-brookfield"),
  theaterName: varchar("theaterName", { length: 255 }).notNull().default("Marcus Majestic Cinema"),
  affiliateNetwork: varchar("affiliateNetwork", { length: 64 }).notNull().default("fandango-cj"),
  clickedAt: timestamp("clickedAt").defaultNow().notNull(),
  userCity: varchar("userCity", { length: 128 }),
  estimatedCommissionCents: int("estimatedCommissionCents").notNull().default(10),
});
export type MovieBookingClick = typeof movieBookingClicks.$inferSelect;
export type InsertMovieBookingClick = typeof movieBookingClicks.$inferInsert;

// ─── Entertainment clicks (concerts, theme parks, adventures) ─────────────────
export const entertainmentClicks = mysqlTable("entertainment_clicks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  category: mysqlEnum("category", ["concert", "theme_park", "adventure", "sports", "comedy", "other"]).notNull().default("other"),
  eventId: varchar("eventId", { length: 128 }).notNull(),
  eventTitle: varchar("eventTitle", { length: 255 }).notNull(),
  venueName: varchar("venueName", { length: 255 }),
  venueCity: varchar("venueCity", { length: 128 }),
  affiliateNetwork: varchar("affiliateNetwork", { length: 64 }).notNull(),
  affiliateUrl: text("affiliateUrl").notNull(),
  estimatedCommissionCents: int("estimatedCommissionCents").notNull().default(0),
  estimatedCommissionPct: int("estimatedCommissionPct").notNull().default(0),
  clickedAt: timestamp("clickedAt").defaultNow().notNull(),
  userCity: varchar("userCity", { length: 128 }),
});
export type EntertainmentClick = typeof entertainmentClicks.$inferSelect;
export type InsertEntertainmentClick = typeof entertainmentClicks.$inferInsert;

// ─── Friend Invites / Shout-Out ───────────────────────────────────────────────
export const friendInvites = mysqlTable("friend_invites", {
  id: int("id").autoincrement().primaryKey(),
  inviterId: int("inviterId").notNull(),
  contactName: varchar("contactName", { length: 128 }).notNull(),
  contactPhone: varchar("contactPhone", { length: 32 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  inviteCode: varchar("inviteCode", { length: 32 }).notNull().unique(),
  status: mysqlEnum("status", ["sent", "opened", "joined"]).default("sent").notNull(),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
  openedAt: timestamp("openedAt"),
  joinedAt: timestamp("joinedAt"),
  joinedUserId: int("joinedUserId"),
});
export type FriendInvite = typeof friendInvites.$inferSelect;
export type InsertFriendInvite = typeof friendInvites.$inferInsert;

// ─── Campus Members (self-serve campus dating pool) ──────────────────────────
export const campusMembers = mysqlTable("campus_members", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  campusId: int("campusId").notNull(),
  verifiedEmail: varchar("verifiedEmail", { length: 200 }),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
});
export type CampusMember = typeof campusMembers.$inferSelect;
export type InsertCampusMember = typeof campusMembers.$inferInsert;

// ─── Family Network ───────────────────────────────────────────────────────────
export const familyProfiles = mysqlTable("family_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  familyName: varchar("familyName", { length: 128 }).notNull(),
  bio: text("bio"),
  neighborhoodCity: varchar("neighborhoodCity", { length: 128 }),
  interests: json("interests").$type<string[]>().default([]),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type FamilyProfile = typeof familyProfiles.$inferSelect;
export type InsertFamilyProfile = typeof familyProfiles.$inferInsert;

export const familyChildren = mysqlTable("family_children", {
  id: int("id").autoincrement().primaryKey(),
  familyProfileId: int("familyProfileId").notNull(),
  ageYears: int("ageYears").notNull(),
  gender: mysqlEnum("gender", ["boy", "girl", "nonbinary", "prefer_not_to_say"]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type FamilyChild = typeof familyChildren.$inferSelect;
export type InsertFamilyChild = typeof familyChildren.$inferInsert;

export const familyMatches = mysqlTable("family_matches", {
  id: int("id").autoincrement().primaryKey(),
  family1Id: int("family1Id").notNull(),
  family2Id: int("family2Id").notNull(),
  compatibilityScore: int("compatibilityScore").default(0).notNull(),
  status: mysqlEnum("status", ["pending", "connected", "declined"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type FamilyMatch = typeof familyMatches.$inferSelect;
export type InsertFamilyMatch = typeof familyMatches.$inferInsert;

// ─── Trip Plans ───────────────────────────────────────────────────────────────
export type TripItem = {
  id: string;
  title: string;
  type: "activity" | "event" | "venue" | "custom";
  time?: string;
  location?: string;
  url?: string;
  notes?: string;
};

export const tripPlans = mysqlTable("trip_plans", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  tripDate: varchar("tripDate", { length: 10 }).notNull(), // YYYY-MM-DD stored as string
  city: varchar("city", { length: 128 }),
  notes: text("notes"),
  items: json("items").$type<TripItem[]>().default([]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type TripPlan = typeof tripPlans.$inferSelect;
export type InsertTripPlan = typeof tripPlans.$inferInsert;

// ─── Trivia Game ──────────────────────────────────────────────────────────────
export const triviaQuestions = mysqlTable("trivia_questions", {
  id: int("id").autoincrement().primaryKey(),
  question: text("question").notNull(),
  optionA: varchar("optionA", { length: 300 }).notNull(),
  optionB: varchar("optionB", { length: 300 }).notNull(),
  optionC: varchar("optionC", { length: 300 }).notNull(),
  optionD: varchar("optionD", { length: 300 }).notNull(),
  correctAnswer: mysqlEnum("correctAnswer", ["A", "B", "C", "D"]).notNull(),
  category: mysqlEnum("category", ["relationships", "pop_culture", "local_knowledge", "food_drinks", "sports_outdoors", "wild_card"]).notNull(),
  difficulty: mysqlEnum("difficulty", ["easy", "medium", "hard"]).notNull().default("medium"),
  profileTraitKey: varchar("profileTraitKey", { length: 64 }), // optional: which trait this answer reveals
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type TriviaQuestion = typeof triviaQuestions.$inferSelect;

export const triviaRooms = mysqlTable("trivia_rooms", {
  id: int("id").autoincrement().primaryKey(),
  gameCode: varchar("gameCode", { length: 8 }).notNull().unique(),
  hostUserId: int("hostUserId").notNull(),
  status: mysqlEnum("status", ["waiting", "in_progress", "completed"]).notNull().default("waiting"),
  maxPlayers: int("maxPlayers").notNull().default(8),
  currentQuestionIndex: int("currentQuestionIndex").notNull().default(0),
  questionIds: json("questionIds").$type<number[]>().default([]),
  questionTimerSeconds: int("questionTimerSeconds").notNull().default(15),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
});
export type TriviaRoom = typeof triviaRooms.$inferSelect;

export const triviaRoomPlayers = mysqlTable("trivia_room_players", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  userId: int("userId").notNull(),
  score: int("score").notNull().default(0),
  streak: int("streak").notNull().default(0),
  isReady: boolean("isReady").notNull().default(false),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
});
export type TriviaRoomPlayer = typeof triviaRoomPlayers.$inferSelect;

export const triviaAnswers = mysqlTable("trivia_answers", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  userId: int("userId").notNull(),
  questionId: int("questionId").notNull(),
  answer: mysqlEnum("answer", ["A", "B", "C", "D"]).notNull(),
  isCorrect: boolean("isCorrect").notNull().default(false),
  answeredAtMs: int("answeredAtMs").notNull().default(0), // ms since question shown (for speed bonus)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type TriviaAnswer = typeof triviaAnswers.$inferSelect;

// ─── Game Chat Messages ───────────────────────────────────────────────────────
export const gameChatMessages = mysqlTable("game_chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  roomType: mysqlEnum("roomType", ["trivia", "match_game"]).notNull().default("trivia"),
  userId: int("userId").notNull(),
  content: varchar("content", { length: 500 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type GameChatMessage = typeof gameChatMessages.$inferSelect;


// ─── Jeopardy Game Tables ─────────────────────────────────────────────────────
export const jeopardyCategories = mysqlTable("jeopardy_categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  emoji: varchar("emoji", { length: 10 }),
  color: varchar("color", { length: 20 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type JeopardyCategory = typeof jeopardyCategories.$inferSelect;

// Unified question pool — shared by both Jeopardy and Trivia Pursuit
export const gameQuestions = mysqlTable("game_questions", {
  id: int("id").autoincrement().primaryKey(),
  categoryId: int("categoryId").notNull(),
  // Jeopardy fields
  clue: text("clue"),                                        // Jeopardy clue text (also used as question text)
  answer: varchar("answer", { length: 300 }),                // Jeopardy free-text answer
  value: int("value").default(400),                         // Jeopardy point value (200/400/600/800/1000)
  // Trivia Pursuit fields
  optionA: varchar("optionA", { length: 300 }),
  optionB: varchar("optionB", { length: 300 }),
  optionC: varchar("optionC", { length: 300 }),
  optionD: varchar("optionD", { length: 300 }),
  correctAnswer: mysqlEnum("correctAnswer", ["A", "B", "C", "D"]),
  // Shared fields
  difficulty: mysqlEnum("difficulty", ["easy", "medium", "hard"]).notNull().default("medium"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type GameQuestion = typeof gameQuestions.$inferSelect;
// Legacy aliases so existing code keeps compiling while we migrate
export const jeopardyQuestions = gameQuestions;
export type JeopardyQuestion = GameQuestion;

// ─── Governed shared question library ─────────────────────────────────────────
// This is intentionally additive. Existing game-specific question tables remain
// active until each adapter is migrated and independently verified.
export const sharedQuestionLibrary = mysqlTable("shared_question_library", {
  id: int("id").autoincrement().primaryKey(),
  prompt: text("prompt").notNull(),
  format: mysqlEnum("format", ["would_you_rather", "multiple_choice", "free_response", "visual"]).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  difficulty: mysqlEnum("difficulty", ["easy", "medium", "hard"]).notNull().default("medium"),
  optionA: varchar("optionA", { length: 300 }),
  optionB: varchar("optionB", { length: 300 }),
  optionC: varchar("optionC", { length: 300 }),
  optionD: varchar("optionD", { length: 300 }),
  canonicalAnswer: varchar("canonicalAnswer", { length: 500 }),
  acceptedAnswers: json("acceptedAnswers").$type<string[]>().notNull().$default(() => []),
  imageUrl: varchar("imageUrl", { length: 1000 }),
  sourceUrl: varchar("sourceUrl", { length: 1000 }),
  license: varchar("license", { length: 255 }),
  attribution: text("attribution"),
  contentStatus: mysqlEnum("contentStatus", ["draft", "approved", "published", "retired"]).notNull().default("draft"),
  revision: int("revision").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  publishedAt: timestamp("publishedAt"),
});
export type SharedQuestionLibraryItem = typeof sharedQuestionLibrary.$inferSelect;

export const sharedQuestionGameTargets = mysqlTable("shared_question_game_targets", {
  id: int("id").autoincrement().primaryKey(),
  questionId: int("questionId").notNull(),
  gameType: mysqlEnum("gameType", ["would_you_rather", "trivia", "jeopardy", "trivia_pursuit", "bullgerdash", "pick_a_plan"]).notNull(),
  enabled: boolean("enabled").notNull().default(true),
  gameConfig: json("gameConfig").$type<Record<string, unknown>>().notNull().$default(() => ({})),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  sharedQuestionGameTargetUnique: uniqueIndex("shared_question_game_target_unique").on(table.questionId, table.gameType),
}));
export type SharedQuestionGameTarget = typeof sharedQuestionGameTargets.$inferSelect;

export const jeopardyRooms = mysqlTable("jeopardy_rooms", {
  id: int("id").autoincrement().primaryKey(),
  gameCode: varchar("gameCode", { length: 8 }).notNull().unique(),
  hostUserId: int("hostUserId").notNull(),
  status: mysqlEnum("status", ["waiting", "in_progress", "completed"]).notNull().default("waiting"),
  maxPlayers: int("maxPlayers").notNull().default(10),
  categoryIds: json("categoryIds").$type<number[]>().notNull(), // selected categories
  currentClueIndex: int("currentClueIndex").notNull().default(0),
  clueOrder: json("clueOrder").$type<number[]>().default([]), // shuffled clue IDs
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
});
export type JeopardyRoom = typeof jeopardyRooms.$inferSelect;

export const jeopardyRoomPlayers = mysqlTable("jeopardy_room_players", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  userId: int("userId").notNull(),
  score: int("score").notNull().default(0),
  isReady: boolean("isReady").notNull().default(false),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
});
export type JeopardyRoomPlayer = typeof jeopardyRoomPlayers.$inferSelect;

export const jeopardyAnswers = mysqlTable("jeopardy_answers", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  userId: int("userId").notNull(),
  questionId: int("questionId").notNull(),
  answer: varchar("answer", { length: 300 }).notNull(),
  isCorrect: boolean("isCorrect").notNull().default(false),
  pointsAwarded: int("pointsAwarded").notNull().default(0),
  answeredAtMs: bigint("answeredAtMs", { mode: "number" }).notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type JeopardyAnswer = typeof jeopardyAnswers.$inferSelect;

// ─── Trivia Pursuit Game Tables ───────────────────────────────────────────────
export const triviaPursuitCategories = mysqlTable("trivia_pursuit_categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  emoji: varchar("emoji", { length: 10 }),
  color: varchar("color", { length: 20 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type TriviaPursuitCategory = typeof triviaPursuitCategories.$inferSelect;

// Legacy alias — Trivia Pursuit now queries game_questions
export const triviaPursuitQuestions = gameQuestions;
export type TriviaPursuitQuestion = GameQuestion;

export const triviaPursuitRooms = mysqlTable("trivia_pursuit_rooms", {
  id: int("id").autoincrement().primaryKey(),
  gameCode: varchar("gameCode", { length: 8 }).notNull().unique(),
  hostUserId: int("hostUserId").notNull(),
  status: mysqlEnum("status", ["waiting", "in_progress", "completed"]).notNull().default("waiting"),
  maxPlayers: int("maxPlayers").notNull().default(10),
  categoryIds: json("categoryIds").$type<number[]>().notNull(),
  currentQuestionIndex: int("currentQuestionIndex").notNull().default(0),
  questionIds: json("questionIds").$type<number[]>().default([]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
});
export type TriviaPursuitRoom = typeof triviaPursuitRooms.$inferSelect;

export const triviaPursuitRoomPlayers = mysqlTable("trivia_pursuit_room_players", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  userId: int("userId").notNull(),
  score: int("score").notNull().default(0),
  correctAnswers: int("correctAnswers").notNull().default(0),
  isReady: boolean("isReady").notNull().default(false),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
});
export type TriviaPursuitRoomPlayer = typeof triviaPursuitRoomPlayers.$inferSelect;

export const triviaPursuitAnswers = mysqlTable("trivia_pursuit_answers", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  userId: int("userId").notNull(),
  questionId: int("questionId").notNull(),
  answer: mysqlEnum("answer", ["A", "B", "C", "D"]).notNull(),
  isCorrect: boolean("isCorrect").notNull().default(false),
  answeredAtMs: int("answeredAtMs").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type TriviaPursuitAnswer = typeof triviaPursuitAnswers.$inferSelect;

// Update gameChatMessages to support new game types
export const gameChatMessagesUpdated = mysqlTable("game_chat_messages_v2", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  roomType: mysqlEnum("roomType", ["trivia", "jeopardy", "trivia_pursuit", "match_game"]).notNull().default("trivia"),
  userId: int("userId").notNull(),
  content: varchar("content", { length: 500 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type GameChatMessageV2 = typeof gameChatMessagesUpdated.$inferSelect;

// ─── Seeded Cities (tracks which cities have had events auto-generated) ──────────
export const seededCities = mysqlTable("seeded_cities", {
  id: int("id").autoincrement().primaryKey(),
  city: varchar("city", { length: 100 }).notNull().unique(),
  state: varchar("state", { length: 50 }).notNull().default("WI"),
  eventCount: int("eventCount").notNull().default(0),
  lat: double("lat"),
  lng: double("lng"),
  seededAt: timestamp("seededAt").defaultNow().notNull(),
  lastRefreshedAt: timestamp("lastRefreshedAt").defaultNow().notNull(),
});
export type SeededCity = typeof seededCities.$inferSelect;

// ─── Advertising Partners ─────────────────────────────────────────────────────
export const adPartners = mysqlTable("ad_partners", {
  id: int("id").autoincrement().primaryKey(),
  // Business info
  businessName: varchar("businessName", { length: 200 }).notNull(),
  contactName: varchar("contactName", { length: 200 }).notNull(),
  contactEmail: varchar("contactEmail", { length: 320 }).notNull(),
  contactPhone: varchar("contactPhone", { length: 30 }),
  website: varchar("website", { length: 500 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  // Ad tier
  tier: mysqlEnum("tier", ["basic", "featured", "sponsored_event", "premium"]).notNull().default("basic"),
  // Status
  status: mysqlEnum("status", ["inquiry", "active", "paused", "cancelled"]).notNull().default("inquiry"),
  // Billing
  monthlyRate: int("monthlyRate"), // in cents
  billingStartDate: date("billingStartDate"),
  billingNotes: text("billingNotes"),
  // Ad content
  tagline: varchar("tagline", { length: 300 }),
  logoUrl: varchar("logoUrl", { length: 500 }),
  promoText: text("promoText"),
  // Banner ad fields
  bannerImageUrl: text("banner_image_url"),
  bannerLinkUrl: text("banner_link_url"),
  bannerHeadline: varchar("banner_headline", { length: 100 }),
  bannerCta: varchar("banner_cta", { length: 50 }),
  bannerPages: varchar("banner_pages", { length: 255 }), // comma-separated: home,activities,community
  // Venue location for geofenced banner reach
  venueLat: double("venue_lat"),
  venueLng: double("venue_lng"),
  bannerReachMiles: int("banner_reach_miles").default(15), // 15=Local, 50=Regional, 999=Statewide
  // Admin notes
  adminNotes: text("adminNotes"),
  // Timestamps
  inquiredAt: timestamp("inquiredAt").defaultNow().notNull(),
  activatedAt: timestamp("activatedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type AdPartner = typeof adPartners.$inferSelect;
export type NewAdPartner = typeof adPartners.$inferInsert;

// ─── Bullgerdash Photo Pool ───────────────────────────────────────────────────
export const bullgerdashPhotos = mysqlTable("bullgerdash_photos", {
  id: int("id").autoincrement().primaryKey(),
  imageUrl: text("image_url").notNull(),
  truthCaption: text("truth_caption").notNull(), // The real story behind the photo
  category: varchar("category", { length: 50 }).default("obscure"),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});
export type BullgerdashPhoto = typeof bullgerdashPhotos.$inferSelect;

// ─── Bullgerdash Games ────────────────────────────────────────────────────────
export const bullgerdashGames = mysqlTable("bullgerdash_games", {
  id: int("id").autoincrement().primaryKey(),
  matchId: int("match_id").notNull(), // references matches.id
  player1Id: int("player1_id").notNull(),
  player2Id: int("player2_id").notNull(),
  player1Score: int("player1_score").notNull().default(0),
  player2Score: int("player2_score").notNull().default(0),
  currentRound: int("current_round").notNull().default(1),
  status: mysqlEnum("status", ["active", "finished"]).notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type BullgerdashGame = typeof bullgerdashGames.$inferSelect;

// ─── Bullgerdash Rounds ───────────────────────────────────────────────────────
export const bullgerdashRounds = mysqlTable("bullgerdash_rounds", {
  id: int("id").autoincrement().primaryKey(),
  gameId: int("game_id").notNull(),
  roundNumber: int("round_number").notNull(),
  storytellerId: int("storyteller_id").notNull(), // which player is telling the story this round
  photoId: int("photo_id").notNull(),
  caption: text("caption"),           // The storyteller's submitted caption
  isLie: boolean("is_lie"),           // true = caption is a lie, false = truth
  // Voter's guess
  voterId: int("voter_id"),
  voterGuess: mysqlEnum("voter_guess", ["truth", "lie"]),
  // Scoring
  storytellerPoints: int("storyteller_points").default(0),
  voterPoints: int("voter_points").default(0),
  // Phase tracking
  phase: mysqlEnum("phase", ["storyteller_writing", "voter_guessing", "reveal"]).notNull().default("storyteller_writing"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type BullgerdashRound = typeof bullgerdashRounds.$inferSelect;

// ─── Bullgerdash Group Games (Game Lobby rooms) ────────────────────────────────
// These records are intentionally separate from the private two-player match game.
// A group snapshot freezes the eligible players for a round, preventing late joins
// from changing an in-progress vote requirement.
export const bullgerdashGroupGames = mysqlTable("bullgerdash_group_games", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("room_id").notNull().unique(),
  hostUserId: int("host_user_id").notNull(),
  playerIds: json("player_ids").$type<number[]>().notNull(),
  scores: json("scores").$type<Record<string, number>>().notNull(),
  currentRound: int("current_round").notNull().default(1),
  status: mysqlEnum("status", ["waiting", "active", "finished"]).notNull().default("waiting"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type BullgerdashGroupGame = typeof bullgerdashGroupGames.$inferSelect;

export const bullgerdashGroupRounds = mysqlTable("bullgerdash_group_rounds", {
  id: int("id").autoincrement().primaryKey(),
  groupGameId: int("group_game_id").notNull(),
  roundNumber: int("round_number").notNull(),
  storytellerId: int("storyteller_id").notNull(),
  participantIds: json("participant_ids").$type<number[]>().notNull(),
  photoId: int("photo_id").notNull(),
  caption: text("caption"),
  isLie: boolean("is_lie"),
  phase: mysqlEnum("phase", ["storyteller_writing", "group_voting", "reveal"]).notNull().default("storyteller_writing"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  groupRoundUnique: uniqueIndex("bullgerdash_group_round_unique").on(table.groupGameId, table.roundNumber),
}));
export type BullgerdashGroupRound = typeof bullgerdashGroupRounds.$inferSelect;

export const bullgerdashGroupVotes = mysqlTable("bullgerdash_group_votes", {
  id: int("id").autoincrement().primaryKey(),
  roundId: int("round_id").notNull(),
  voterId: int("voter_id").notNull(),
  guess: mysqlEnum("guess", ["truth", "lie"]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  groupVoteUnique: uniqueIndex("bullgerdash_group_vote_unique").on(table.roundId, table.voterId),
}));
export type BullgerdashGroupVote = typeof bullgerdashGroupVotes.$inferSelect;

// ─── Voice Messages ───────────────────────────────────────────────────────────
export const voiceMessages = mysqlTable("voice_messages", {
  id: int("id").autoincrement().primaryKey(),
  matchId: int("match_id").notNull(),
  senderId: int("sender_id").notNull(),
  s3Key: varchar("s3_key", { length: 512 }).notNull(),
  s3Url: text("s3_url").notNull(),
  durationSeconds: double("duration_seconds").notNull().default(0),
  playedAt: timestamp("played_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type VoiceMessage = typeof voiceMessages.$inferSelect;

// ─── Sports Watch Party ───────────────────────────────────────────────────────
export const watchPartyRooms = mysqlTable("watch_party_rooms", {
  id: int("id").autoincrement().primaryKey(),
  hostId: int("host_id").notNull(),
  gameCode: varchar("game_code", { length: 10 }).notNull().unique(),
  title: varchar("title", { length: 200 }).notNull(),
  teamHome: varchar("team_home", { length: 100 }).notNull(),
  teamAway: varchar("team_away", { length: 100 }).notNull(),
  sport: varchar("sport", { length: 50 }).notNull().default("nfl"), // nfl, nba, mlb, local
  gameTime: timestamp("game_time"),
  status: mysqlEnum("status", ["waiting", "live", "ended"]).notNull().default("waiting"),
  maxPlayers: int("max_players").notNull().default(50),
  isLocal: boolean("is_local").notNull().default(false), // user-submitted local game
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type WatchPartyRoom = typeof watchPartyRooms.$inferSelect;

export const watchPartyPlayers = mysqlTable("watch_party_players", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("room_id").notNull(),
  userId: int("user_id").notNull(),
  score: int("score").notNull().default(0),
  correctAnswers: int("correct_answers").notNull().default(0),
  isMvp: boolean("is_mvp").notNull().default(false),
  teamFlair: varchar("team_flair", { length: 20 }),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});
export type WatchPartyPlayer = typeof watchPartyPlayers.$inferSelect;

export const watchPartyChat = mysqlTable("watch_party_chat", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("room_id").notNull(),
  userId: int("user_id").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type WatchPartyChat = typeof watchPartyChat.$inferSelect;

export const watchPartyTrivia = mysqlTable("watch_party_trivia", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("room_id").notNull(),
  questionText: text("question_text").notNull(),
  optionA: varchar("option_a", { length: 300 }).notNull(),
  optionB: varchar("option_b", { length: 300 }).notNull(),
  optionC: varchar("option_c", { length: 300 }).notNull(),
  optionD: varchar("option_d", { length: 300 }).notNull(),
  correctAnswer: mysqlEnum("correct_answer", ["A", "B", "C", "D"]).notNull(),
  launchedAt: timestamp("launched_at").defaultNow().notNull(),
  isActive: boolean("is_active").notNull().default(true),
});
export type WatchPartyTrivia = typeof watchPartyTrivia.$inferSelect;

export const watchPartyTriviaAnswers = mysqlTable("watch_party_trivia_answers", {
  id: int("id").autoincrement().primaryKey(),
  triviaId: int("trivia_id").notNull(),
  roomId: int("room_id").notNull(),
  userId: int("user_id").notNull(),
  answer: mysqlEnum("answer", ["A", "B", "C", "D"]).notNull(),
  isCorrect: boolean("is_correct").notNull().default(false),
  answeredAt: timestamp("answered_at").defaultNow().notNull(),
});
export type WatchPartyTriviaAnswer = typeof watchPartyTriviaAnswers.$inferSelect;

// ─── Sports Team Trivia Pool ──────────────────────────────────────────────────
export const sportsTriviaPool = mysqlTable("sports_trivia_pool", {
  id: int("id").autoincrement().primaryKey(),
  team: varchar("team", { length: 100 }).notNull(), // "packers", "bears", "bucks", etc.
  sport: varchar("sport", { length: 50 }).notNull(),
  questionText: text("question_text").notNull(),
  optionA: varchar("option_a", { length: 300 }).notNull(),
  optionB: varchar("option_b", { length: 300 }).notNull(),
  optionC: varchar("option_c", { length: 300 }).notNull(),
  optionD: varchar("option_d", { length: 300 }).notNull(),
  correctAnswer: mysqlEnum("correct_answer", ["A", "B", "C", "D"]).notNull(),
  difficulty: mysqlEnum("difficulty", ["easy", "medium", "hard"]).notNull().default("medium"),
});
export type SportsTriviaPool = typeof sportsTriviaPool.$inferSelect;

// ─── Sport Team Alerts ────────────────────────────────────────────────────────
export const sportTeamAlerts = mysqlTable("sport_team_alerts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  teamAbbreviation: varchar("team_abbreviation", { length: 10 }).notNull(),
  teamName: varchar("team_name", { length: 100 }).notNull(),
  sport: mysqlEnum("sport", ["nfl", "nba", "mlb"]).notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type SportTeamAlert = typeof sportTeamAlerts.$inferSelect;

// ─── User Homepage Layout ─────────────────────────────────────────────────────
// Stores each user's pinned modules and their display order.
// moduleId is one of the well-known module keys (see shared/const.ts).
export const userHomepageLayout = mysqlTable("user_homepage_layout", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  moduleId: varchar("module_id", { length: 64 }).notNull(),
  position: int("position").notNull().default(0),
  pinned: boolean("pinned").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type UserHomepageLayout = typeof userHomepageLayout.$inferSelect;

// ─── Gym Buddy Feature ────────────────────────────────────────────────────────
export const gyms = mysqlTable("gyms", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  address: varchar("address", { length: 200 }),
  city: varchar("city", { length: 100 }).notNull().default("Milwaukee"),
  state: varchar("state", { length: 50 }).default("WI"),
  lat: varchar("lat", { length: 20 }),
  lng: varchar("lng", { length: 20 }),
  amenities: text("amenities"), // JSON array of strings
  logoUrl: varchar("logo_url", { length: 500 }),
  websiteUrl: varchar("website_url", { length: 500 }),
  membershipUrl: varchar("membership_url", { length: 500 }),
  phone: varchar("phone", { length: 30 }),
  isPartner: boolean("is_partner").notNull().default(false),
  partnerTier: varchar("partner_tier", { length: 20 }).default("basic"), // basic | featured | premium
  claimedByUserId: int("claimed_by_user_id"),
  referralCode: varchar("referral_code", { length: 50 }),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type Gym = typeof gyms.$inferSelect;

export const gymBuddyProfiles = mysqlTable("gym_buddy_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  gymId: int("gym_id").notNull(),
  workoutStyles: text("workout_styles").notNull().default("[]"), // JSON: ["cardio","lifting","yoga",...]
  schedule: text("schedule").notNull().default("[]"), // JSON: ["Mon morning","Wed evening",...]
  fitnessLevel: varchar("fitness_level", { length: 30 }).default("intermediate"),
  goals: text("goals"),
  bio: text("bio"),
  isVerified: boolean("is_verified").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type GymBuddyProfile = typeof gymBuddyProfiles.$inferSelect;

export const gymSessions = mysqlTable("gym_sessions", {
  id: int("id").autoincrement().primaryKey(),
  gymId: int("gym_id").notNull(),
  hostUserId: int("host_user_id").notNull(),
  title: varchar("title", { length: 150 }).notNull(),
  workoutType: varchar("workout_type", { length: 80 }),
  scheduledAt: bigint("scheduled_at", { mode: "number" }).notNull(),
  durationMinutes: int("duration_minutes").default(60),
  maxParticipants: int("max_participants").default(6),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type GymSession = typeof gymSessions.$inferSelect;

export const gymSessionRsvps = mysqlTable("gym_session_rsvps", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("session_id").notNull(),
  userId: int("user_id").notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});
export type GymSessionRsvp = typeof gymSessionRsvps.$inferSelect;

// ─── Workout Program ──────────────────────────────────────────────────────────
// User's personal exercise library (built-in starters + custom entries)
export const workoutExercises = mysqlTable("workout_exercises", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  muscleGroup: varchar("muscle_group", { length: 80 }).notNull().default("Full Body"),
  sets: int("sets").notNull().default(3),
  reps: varchar("reps", { length: 30 }).notNull().default("10"),  // e.g. "10", "8-12", "60s"
  notes: text("notes"),
  isCustom: boolean("is_custom").notNull().default(false),
  dayOfWeek: mysqlEnum("day_of_week", ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type WorkoutExercise = typeof workoutExercises.$inferSelect;
export type InsertWorkoutExercise = typeof workoutExercises.$inferInsert;

// Log of completed sets per exercise
export const workoutLogs = mysqlTable("workout_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  exerciseId: int("exercise_id").notNull(),
  setsCompleted: int("sets_completed").notNull().default(0),
  repsActual: varchar("reps_actual", { length: 30 }),
  weightLbs: double("weight_lbs"),
  notes: text("notes"),
  loggedAt: timestamp("logged_at").defaultNow().notNull(),
});
export type WorkoutLog = typeof workoutLogs.$inferSelect;
export type InsertWorkoutLog = typeof workoutLogs.$inferInsert;

// ─── City Event Sources Configuration ──────────────────────────────────────────
// Allows admins to enable/disable event sources per city
export const cityEventSources = mysqlTable("city_event_sources", {
  id: bigint({ mode: "number" }).primaryKey().autoincrement(),
  city: varchar("city", { length: 100 }).notNull(),
  state: varchar("state", { length: 2 }).notNull(),
  sourceType: mysqlEnum("source_type", [
    "chicago_library", "chicago_museum", "milwaukee_library", 
    "madison_library", "lincoln_library", "eventbrite", "meetup", "google_places"
  ]).notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  lastCrawlTime: timestamp("last_crawl_time").defaultNow(),
  eventCount: int("event_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type CityEventSource = typeof cityEventSources.$inferSelect;
export type InsertCityEventSource = typeof cityEventSources.$inferInsert;

// ─── Event Interests ──────────────────────────────────────────────────────────
// Track which users are interested in attending events
export const eventInterests = mysqlTable("event_interests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  eventId: int("event_id").notNull(),
  status: mysqlEnum("status", ["interested", "going", "attended"]).notNull().default("interested"),
  interestedAt: timestamp("interested_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type EventInterest = typeof eventInterests.$inferSelect;
export type InsertEventInterest = typeof eventInterests.$inferInsert;

// ─── Sally Event Recommendation Feedback ──────────────────────────────────────
export const eventRecommendationFeedback = mysqlTable("event_recommendation_feedback", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  eventId: int("event_id").notNull(),
  interviewSessionId: int("interview_session_id"),
  response: mysqlEnum("response", ["interested", "not_for_me"]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type EventRecommendationFeedback = typeof eventRecommendationFeedback.$inferSelect;

// ─── Personalized pickup coordination ─────────────────────────────────────────
// Members opt in before receiving nearby public pickup alerts. Categories are a
// lightweight local preference signal and never expose a member list to others.
export const pickupAlertPreferences = mysqlTable("pickup_alert_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().unique(),
  enabled: boolean("enabled").notNull().default(false),
  city: varchar("city", { length: 100 }),
  categories: json("categories").$type<string[]>().notNull().$default(() => []),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type PickupAlertPreference = typeof pickupAlertPreferences.$inferSelect;

// Pickup sessions are public-venue coordination posts; never use them for private
// addresses or member-to-member location sharing.
export const pickupSessions = mysqlTable("pickup_sessions", {
  id: int("id").autoincrement().primaryKey(),
  hostUserId: int("host_user_id").notNull(),
  activityType: varchar("activity_type", { length: 40 }).notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  description: text("description"),
  city: varchar("city", { length: 100 }).notNull(),
  state: varchar("state", { length: 32 }).notNull(),
  venueName: varchar("venue_name", { length: 200 }).notNull(),
  venueAddress: varchar("venue_address", { length: 300 }),
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at"),
  capacity: int("capacity").notNull().default(10),
  status: mysqlEnum("status", ["open", "full", "cancelled", "completed"]).notNull().default("open"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type PickupSession = typeof pickupSessions.$inferSelect;

export const pickupParticipants = mysqlTable("pickup_participants", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("session_id").notNull(),
  userId: int("user_id").notNull(),
  status: mysqlEnum("status", ["joined", "maybe", "declined"]).notNull().default("joined"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type PickupParticipant = typeof pickupParticipants.$inferSelect;

// ─── Saved travel locations ───────────────────────────────────────────────────
export const savedLocations = mysqlTable("saved_locations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  label: varchar("label", { length: 80 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  state: varchar("state", { length: 32 }).notNull(),
  postalCode: varchar("postalCode", { length: 16 }),
  latitude: varchar("latitude", { length: 20 }).notNull(),
  longitude: varchar("longitude", { length: 20 }).notNull(),
  isHome: boolean("isHome").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SavedLocation = typeof savedLocations.$inferSelect;
export type InsertSavedLocation = typeof savedLocations.$inferInsert;

// ─── Today’s Plan ──────────────────────────────────────────────────────────────
export const todaysPlans = mysqlTable("todays_plans", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  eventId: int("eventId"),
  activityId: int("activityId"),
  note: varchar("note", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TodaysPlan = typeof todaysPlans.$inferSelect;
export type InsertTodaysPlan = typeof todaysPlans.$inferInsert;
