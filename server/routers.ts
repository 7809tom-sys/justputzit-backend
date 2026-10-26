import { ENV } from "./_core/env";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getSupabaseAdmin } from "./_core/supabaseAuth";
import { invokeLLM } from "./_core/llm";
import { z } from "zod";
import { jeopardyRouter } from "./routers/jeopardy";
import { triviaPursuitRouter } from "./routers/trivia-pursuit";
import { bullgerdashRouter } from "./routers/bullgerdash";
import { watchPartyRouter } from "./routers/watchParty";
import { sportsScoresRouter } from "./routers/sportsScores";
import { gymRouter } from "./routers/gym";
import { workoutRouter } from "./routers/workout";
import { autoSeedCityEvents } from "./cityEventSeeder";
import { crawlAllCities } from "./museumLibraryCrawler";
import { getLatestInterviewLearnings } from "./profileLearning";
import { mergeProfileTraits } from "../shared/profileTraitMerge";
import { buildProfileSummaryEvidence, isEvidenceGroundedProfileSummary } from "../shared/profileSummaryEvidence";
import { getWyrDirectPreferenceInsights, sanitizeWyrProfileInsights } from "../shared/wyrProfileInsightPolicy";
import { formatCompetitiveGameContext } from "../shared/competitiveGameContext";
import { refreshPublicActivitiesForCity } from "./publicVenueDiscovery";
import { getAdminRoleChangeBlock } from "./adminRolePolicy";
import { isValidLocationQuery, resolveLocationQuery } from "./locationResolver";
import { getCommunityDirectory, isCommunityDirectoryCity } from "./communityDirectory";
import { createMarketplaceCheckoutSession, createSponsoredPlacementCheckoutSession, getMarketplacePaymentConfirmation } from "./stripeCheckout";
import { deriveGameAchievements } from "./memberDashboard";
import { getRescheduleRequestError } from "./bookingManagement";
import { getBookingCheckInError } from "../shared/attendanceProof";
import { getPartnerTrendRangeError, parsePartnerTrendDate } from "./partnerImpact";
import { getPickupSafetyError, PICKUP_ACTIVITY_TYPES, pickupTemplate, selectSimilarActivities } from "../shared/pickupActivityPolicy";
import { getSponsoredPlacementEligibility, getSponsoredPlacementPackage, type SponsoredPlacementPackage } from "../shared/sponsoredPlacementPolicy";
import { selectSimilarEventDetails } from "../shared/similarEventDetails";
import { isEligiblePublicEventProposal } from "../shared/eventProposalPolicy";
import { hasSharedConnectionIntent, normalizeConnectionPreferences } from "../shared/connectionPreferences";
import { BLOCKED_CONVERSATION_MESSAGE, isValidMemberSafetyTarget } from "../shared/memberSafetyPolicy";
import { parseProfileBirthDate } from "../shared/profileBirthDate";
import { isSharedQuestionFormatEligible, SHARED_GAME_TYPES } from "../shared/sharedQuestionLibrary";
import { sendVerifiedOutreachEmail } from "./resendOutreach";
const ACTIVITY_CATEGORY_VALUES = [
  "bowling", "mini_golf", "kayaking", "movies", "dining", "coffee",
  "cooking_class", "escape_room", "wine_tasting", "hiking", "park",
  "library", "church", "community_center", "sports", "arts", "swimming_pool",
  "beach", "basketball", "dirt_track", "ymca", "public_gym", "golf",
  "disc_golf", "volleyball", "tennis", "other",
] as const;
import {
  getOrCreateProfile,
  updateProfile,
  getProfileByUserId,
  getAllProfiles,
  createInterviewSession,
  getInterviewSession,
  updateInterviewSession,
  getLatestInterviewSession,
  getLatestCompletedInterviewSessions,
  createMatch,
  getMatchesForUser,
  getMatchById,
  existingMatch,
  sendChatMessage,
  getChatMessages,
  isMatchParticipant,
  getEventProposalsForMatch,
  createEventProposal,
  respondToEventProposal,
  createGameSession,
  updateGameSession,
  getGameSession,
  getGameSessionsForMatch,
  createNotification,
  getNotificationsForUser,
  markNotificationRead,
  markAllNotificationsRead,
  getAllUsers,
  setMemberAdministratorRole,
  getUserByOpenId,
  createReport,
  getReportsForAdmin,
  updateReportStatus,
  blockUser,
  getBlockedUserIds,
  isBlockInEffect,
  getAdminFlags,
  resolveAdminFlag,
  suspendUser,
  getVenuePartners,
  getVenueById,
  createVenuePartner,
  getActivityListings,
  getActivityMarketplaceCategoryCounts,
  getActivityById,
  getSponsoredPlacementEligibleListing,
  getSponsoredPlacementsForActivities,
  getSponsoredPlacementPerformanceForOwner,
  getSponsoredAudienceSummaryForOwner,
  createSponsoredPlacement,
  recordSponsoredPlacementMetric,
  createActivityListing,
  rsvpToActivity,
  getActivityBookmarksForUser,
  getSavedActivityEventsForUser,
  toggleActivityBookmark,
  getRsvpsForActivity,
  checkInToActivity,
  recordReferralVisit,
  getCommunityGroups,
  createCommunityGroup,
  joinCommunityGroup,
  getGroupMembers,
  createBooking,
  getBookingsForUser,
  getBookingById,
  cancelBooking,
  requestBookingReschedule,
  checkInBooking,
  getBookingsForVenue,
  getPartnerImpactForOwner,
  getPartnerImpactTrendForOwner,
  genCode,
  createConciergeRequest,
  updateConciergeRequest,
  getConciergeRequestById,
  getConciergeRequestsForUser,
  getVenuesByOwner,
  updateVenuePartner,
  getListingsByVenue,
  getListingsForOwner,
  updateActivityListing,
  getCoupleLinkForUser,
  upsertCoupleLink,
  getAllCoupleLinks,
  existingCoupleMatch,
  createCoupleMatch,
  getCoupleMatchesForUser,
  getWyrQuestions,
  getWyrQuestionById,
  getWyrAnsweredQuestionIds,
  getWyrChallengeAnswerProgress,
  recordWyrAnswer,
  getWyrSplit,
  getWyrAnswerCount,
  getAdminStats,
  searchUsers,
  getUserWithProfile,
  createWyrChallenge,
  getWyrChallenge,
  getWyrChallengesForUser,
  getCompetitiveGameStatsForUser,
  updateWyrChallengeStatus,
  computeWyrCompatibility,
  getCampusStats,
  getCampusLeaderboard,
  getAllCampuses,
  joinCampus,
  leaveCampus,
  getUserCampuses,
  getCampusMemberCount,
  getCampusMemberProfiles,
  generateInviteCode,
  recordReferral,
  getCampusBySlug,
  getCommunityEvents,
  getSallyEventSuggestions,
  recordSallyEventFeedback,
  getAdminSallyEventFeedback,
  createCommunityEvent,
  rsvpToEvent,
  setEventIntroductionOptIn,
  createMutualEventIntroduction,
  getUserEventRsvps,
  getEventbriteEvents,
  getPasskeysForUser,
  getPasskeyByCredentialId,
  savePasskeyCredential,
  updatePasskeyCounter,
  deletePasskey,
  getActiveLoginAd,
  createLoginAd,
  recordAdImpression,
  getLoginAdsForVendor,
  updateLoginAdStatus,
  toggleSponsoredEvent,
  setThirdWheelHostForEvent,
  getEventSourceHealth,
  toggleSponsoredActivity,
  getRevenueSummary,
  getProfilePhotos,
  insertProfilePhoto,
  setPrimaryPhoto,
  deleteProfilePhoto,
  updateProfileIdentity,
  getAllProfilePhotosAdmin,
  adminDeletePhoto,
  banUser,
  unbanUser,
  approveSuspendedUser,
  getAdminStatsEnhanced,
  listGameRooms,
  getGameRoom,
  createGameRoom,
  joinGameRoom,
  leaveGameRoom,
  getGameRoomPlayers,
  submitGameAnswer,
  advanceGameQuestion,
  startGameRoom,
  recordMovieBookingClick,
  recordEntertainmentClick,
  getEntertainmentRevenueSummary,
  createFriendInvite,
  getMyInvites,
  markInviteOpened,
  // Trivia
  getTriviaQuestions,
  getTriviaQuestionById,
  createTriviaRoom,
  getTriviaRoomByCode,
  getTriviaRoomById,
  getOpenTriviaRooms,
  updateTriviaRoom,
  joinTriviaRoom,
  getTriviaRoomPlayers,
  setPlayerReady,
  submitTriviaAnswer,
  getTriviaAnswersForRoom,
  sendGameChatMessage,
  getGameChatMessages,
  getOrCreateFamilyProfile,
  getFamilyProfileByUserId,
  updateFamilyProfile,
  getFamilyChildren,
  addFamilyChild,
  removeFamilyChild,
  findNearbyFamilies,
  connectFamilies,
  getTripPlans,
  createTripPlan,
  updateTripPlan,
  deleteTripPlan,
  addTripItem,
  removeTripItem,
  getUsersWithGpsLocations,
  getHomepageLayout,
  saveHomepageLayout,
  markEventInterest,
  removeEventInterest,
  getEventInterests,
  getInterestedCount,
  getUserEventInterests,
  getMatchesInterestedInSameEvents,
  listSavedLocations,
  createSavedLocation,
  updateSavedLocation,
  deleteSavedLocation,
  getTodaysPlan,
  saveTodaysPlan,
  clearTodaysPlan,
  getPickupAlertPreference,
  savePickupAlertPreference,
  getPickupSessionsForMember,
  createPickupSession,
  joinPickupSession,
  notifyNearbyPickupMembers,
  getMemberPreferredPickupCategories,
  getPublishedSharedQuestionsForGame,
  createSharedQuestionDraft,
  getSharedQuestionForEditorialReview,
  getSharedQuestionsForEditorialReview,
  setSharedQuestionStatus,
  createVenueOutreachRecord,
  getVenueOutreachHistory,
  createPickPlanRound,
  getActivePickPlanRoundForMatch,
  getPickPlanRound,
  recordPickPlanVote,
  revealPickPlanMatch,
} from "./db";
import type { ProfileTraits, InterviewMessage, MatchGameQuestion as GameQuestion, ConciergePlanItem } from "../drizzle/schema";
import { familyProfiles, communityEvents } from "../drizzle/schema";
import { and, eq, ne, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getUserByEmail, getUserById, createEmailUser, verifyUserEmail, checkGpsMatchesCity, saveLocationVerification, getDb } from "./db";
import type { AuthenticatorTransport } from "@simplewebauthn/server";
import { getSallyBehaviorReviewCue } from "../shared/sallyBehaviorReviewPolicy";

export const appRouter = router({
  system: systemRouter,

  cinchSeed: router({
    getEmbedConfig: publicProcedure.query(() => {
      const seedId = process.env.CINCH_SEED_ID;
      const connectKey = process.env.CINCH_CONNECT_KEY;

      if (!seedId || !connectKey) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cinch Community is not configured.",
        });
      }

      return {
        seedId,
        connectKey,
        scriptUrl: "https://cinchseed.com/v1/watch.js",
      };
    }),
  }),

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    // Sessions are Supabase tokens held by the client; signing out happens there.
    logout: publicProcedure.mutation(() => ({ success: true } as const)),
  }),

  // ─── Manual Location Search ────────────────────────────────────────────────
  location: router({
    resolve: protectedProcedure
      .input(z.object({ query: z.string().trim().min(2).max(120) }))
      .query(async ({ input }) => {
        if (!isValidLocationQuery(input.query)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Enter a city or ZIP code." });
        }
        const resolved = await resolveLocationQuery(input.query);
        if (!resolved) {
          throw new TRPCError({ code: "NOT_FOUND", message: "We could not find that city or ZIP code." });
        }
        return resolved;
      }),
    saved: protectedProcedure.query(async ({ ctx }) => {
      return listSavedLocations(ctx.user.id);
    }),
    save: protectedProcedure
      .input(z.object({
        label: z.string().trim().min(1).max(80),
        city: z.string().trim().min(1).max(100),
        state: z.string().trim().min(1).max(32),
        postalCode: z.string().trim().max(16).optional(),
        latitude: z.string().trim().min(1).max(20),
        longitude: z.string().trim().min(1).max(20),
        isHome: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return createSavedLocation(ctx.user.id, input);
      }),
    rename: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), label: z.string().trim().min(1).max(80) }))
      .mutation(async ({ ctx, input }) => {
        const updated = await updateSavedLocation(ctx.user.id, input.id, { label: input.label });
        if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Saved location not found." });
        return updated;
      }),
    setHome: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const updated = await updateSavedLocation(ctx.user.id, input.id, { isHome: true });
        if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Saved location not found." });
        return updated;
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await deleteSavedLocation(ctx.user.id, input.id);
        return { success: true };
      }),
  }),

  // ─── Location Verification ────────────────────────────────────────────────
  verification: router({
    checkGps: protectedProcedure
      .input(z.object({
        lat: z.number(),
        lng: z.number(),
        claimedCity: z.string(),
        photoTimestamp: z.number().optional(), // ms since epoch from EXIF
      }))
      .mutation(async ({ input, ctx }) => {
        const { match, distanceKm, cityLabel } = checkGpsMatchesCity(input.lat, input.lng, input.claimedCity);
        // Check photo recency if timestamp provided (must be within last 10 minutes)
        let recentPhoto = true;
        if (input.photoTimestamp) {
          const ageMs = Date.now() - input.photoTimestamp;
          recentPhoto = ageMs < 10 * 60 * 1000;
        }
        const verified = match && recentPhoto;
        await saveLocationVerification(ctx.user.id, {
          lat: input.lat,
          lng: input.lng,
          city: cityLabel,
          verified,
        });
        // Fire-and-forget: auto-seed events for the verified city
        if (cityLabel) {
          autoSeedCityEvents(cityLabel).catch(() => {});
        }
        return { verified, distanceKm: Math.round(distanceKm), cityLabel, recentPhoto };
      }),

    getStatus: protectedProcedure.query(async ({ ctx }) => {
      const profile = await getOrCreateProfile(ctx.user.id);
      return {
        locationVerified: profile?.locationVerified ?? false,
        gpsVerifiedCity: profile?.gpsVerifiedCity ?? null,
        gpsVerifiedAt: profile?.gpsVerifiedAt ?? null,
      };
    }),
  }),

  // ─── Profile ──────────────────────────────────────────────────────────────
  profile: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const profile = await getOrCreateProfile(ctx.user.id);
      // Regenerate profile summary if stale (fire-and-forget)
      if (profile?.traits) {
        const traits = profile.traits as ProfileTraits;
        const lastUpdated = (profile.updatedAt as Date)?.getTime() || 0;
        const now = Date.now();
        const isStale = now - lastUpdated > 30 * 60 * 1000;
        if (!traits.aiSummary || isStale) {
          const userName = profile.displayName || ctx.user.name || "friend";
          generateProfileSummary(traits, userName)
            .then((newSummary) => {
              if (newSummary && newSummary !== traits.aiSummary) {
                updateProfile(ctx.user.id, {
                  traits: { ...traits, aiSummary: newSummary },
                }).catch(() => {});
              }
            })
            .catch(() => {});
        }
      }
      return profile;
    }),

    getById: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return getProfileByUserId(input.userId);
      }),

    latestLearning: protectedProcedure.query(async ({ ctx }) => {
      const sessions = await getLatestCompletedInterviewSessions(ctx.user.id);
      const latestSession = sessions[0];
      if (!latestSession) {
        return { latestInterviewAt: null, learnedTraits: [] };
      }

      return {
        latestInterviewAt: latestSession.completedAt ?? latestSession.createdAt,
        learnedTraits: getLatestInterviewLearnings(
          latestSession.extractedTraits,
          sessions[1]?.extractedTraits,
        ),
      };
    }),

    update: protectedProcedure
      .input(
        z.object({
          avatarEmoji: z.string().optional(),
          avatarColor: z.string().optional(),
          displayName: z.string().optional(),
          bio: z.string().optional(),
          networkType: z.enum(["singles", "couples", "community"]).optional(),
          onboardingComplete: z.boolean().optional(),
          latitude: z.string().optional(),
          longitude: z.string().optional(),
          city: z.string().optional(),
          state: z.string().max(32).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await getOrCreateProfile(ctx.user.id);
        await updateProfile(ctx.user.id, input);
        // Fire-and-forget: refresh city-specific events and public recreation after a location change.
        if (input.city) {
          autoSeedCityEvents(input.city, input.state ?? "WI").catch(() => {});
          refreshPublicActivitiesForCity(input.city, input.state).catch(() => {});
        }
        return getProfileByUserId(ctx.user.id);
      }),

    getMyProfile: protectedProcedure.query(async ({ ctx }) => {
      const profile = await getOrCreateProfile(ctx.user.id);
      if (profile?.city) {
        // Keeps the local feed warm on login without delaying profile rendering.
        autoSeedCityEvents(profile.city, profile.state ?? "WI").catch(() => {});
        refreshPublicActivitiesForCity(profile.city, profile.state ?? undefined).catch(() => {});
      }
      // Regenerate profile summary if stale (fire-and-forget)
      if (profile?.traits) {
        const traits = profile.traits as ProfileTraits;
        const lastUpdated = (profile.updatedAt as Date)?.getTime() || 0;
        const now = Date.now();
        const isStale = now - lastUpdated > 30 * 60 * 1000;
        if (!traits.aiSummary || isStale) {
          const userName = profile.displayName || ctx.user.name || "friend";
          generateProfileSummary(traits, userName)
            .then((newSummary) => {
              if (newSummary && newSummary !== traits.aiSummary) {
                updateProfile(ctx.user.id, {
                  traits: { ...traits, aiSummary: newSummary },
                }).catch(() => {});
              }
            })
            .catch(() => {});
        }
      }
      return profile;
    }),

    updateCity: protectedProcedure
      .input(z.object({
        city: z.string().min(1).max(100),
        state: z.string().max(32).optional(),
        lat: z.string().optional(),
        lng: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await getOrCreateProfile(ctx.user.id);
        await updateProfile(ctx.user.id, {
          city: input.city,
          ...(input.state ? { state: input.state } : {}),
          ...(input.lat ? { latitude: input.lat } : {}),
          ...(input.lng ? { longitude: input.lng } : {}),
        });
        autoSeedCityEvents(input.city, input.state ?? "WI").catch(() => {});
        refreshPublicActivitiesForCity(input.city, input.state).catch(() => {});
        return { success: true, city: input.city };
      }),

    completeOnboarding: protectedProcedure
      .input(
        z.object({
          avatarEmoji: z.string(),
          avatarColor: z.string(),
          displayName: z.string(),
          networkType: z.enum(["singles", "couples", "community"]),
          connectionPreferences: z.object({ friendship: z.boolean(), dating: z.boolean(), gymBuddy: z.boolean() }),
          meetupSafetyPreference: z.enum(["public_daytime", "public_anytime", "group_first"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const profile = await getOrCreateProfile(ctx.user.id);
        const { connectionPreferences, meetupSafetyPreference, ...profileInput } = input;
        await updateProfile(ctx.user.id, {
          ...profileInput,
          traits: {
            ...(profile?.traits ?? {}),
            connectionPreferences: normalizeConnectionPreferences(connectionPreferences),
            meetupSafetyPreference,
          },
          onboardingComplete: true,
        });
        return getProfileByUserId(ctx.user.id);
      }),

    updateConnectionPreferences: protectedProcedure
      .input(z.object({
        friendship: z.boolean(),
        dating: z.boolean(),
        gymBuddy: z.boolean(),
        meetupSafetyPreference: z.enum(["public_daytime", "public_anytime", "group_first"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const profile = await getOrCreateProfile(ctx.user.id);
        await updateProfile(ctx.user.id, {
          traits: {
            ...(profile?.traits ?? {}),
            connectionPreferences: normalizeConnectionPreferences(input),
            meetupSafetyPreference: input.meetupSafetyPreference ?? profile?.traits?.meetupSafetyPreference ?? "public_daytime",
          },
        });
        return getProfileByUserId(ctx.user.id);
      }),

    updateIdentity: protectedProcedure
      .input(
        z.object({
          gender: z.enum(["man", "woman", "non_binary", "other", "prefer_not_to_say"]).optional(),
          sexualOrientation: z.enum(["straight", "gay", "lesbian", "bisexual", "pansexual", "asexual", "queer", "other", "prefer_not_to_say"]).optional(),
          birthDate: z.string().optional(), // YYYY-MM-DD date string
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (input.birthDate && !parseProfileBirthDate(input.birthDate)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Please enter a valid birth date." });
        }
        await getOrCreateProfile(ctx.user.id);
        await updateProfileIdentity(ctx.user.id, {
          gender: input.gender,
          sexualOrientation: input.sexualOrientation,
          birthDate: input.birthDate,
        });
        return getProfileByUserId(ctx.user.id);
      }),

    getPhotos: protectedProcedure.query(async ({ ctx }) => {
      return getProfilePhotos(ctx.user.id);
    }),

    uploadPhoto: protectedProcedure
      .input(
        z.object({
          base64: z.string(), // data:image/jpeg;base64,...
          filename: z.string().default("photo.jpg"),
        })
      )
      .mutation(async ({ ctx }) => {
        // Photo upload is handled via multipart in a separate REST endpoint
        // This stub returns instructions for the client
        throw new TRPCError({ code: "METHOD_NOT_SUPPORTED", message: "Use POST /api/photos/upload" });
      }),

    setPrimaryPhoto: protectedProcedure
      .input(z.object({ photoId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await setPrimaryPhoto(input.photoId, ctx.user.id);
        return { success: true };
      }),

    deletePhoto: protectedProcedure
      .input(z.object({ photoId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteProfilePhoto(input.photoId, ctx.user.id);
        return { success: true };
      }),
  }),

  // ─── Interview ────────────────────────────────────────────────────────────
  interview: router({
    start: protectedProcedure.mutation(async ({ ctx }) => {
      const profile = await getOrCreateProfile(ctx.user.id);
      const session = await createInterviewSession(ctx.user.id);
      if (!session) throw new Error("Failed to create session");

      if (profile?.city) {
        autoSeedCityEvents(profile.city, profile.state ?? "WI").catch(() => {});
      }
      const eventSuggestions = await getSallyEventSuggestions(ctx.user.id, profile?.city ?? undefined, 3);

      const existingTraits = profile?.traits as ProfileTraits ?? {};
      const interviewCount = profile?.interviewCount ?? 0;
      const userName = profile?.displayName || ctx.user.name || "friend";

      // Generate opening question from Sally
      const systemPrompt = `You are Sally, a warm, friendly, and enthusiastic AI host for Just Putzit — a social platform that connects people for real-life activities and relationships. You conduct short 90-second profile-building interviews.

Your personality: cheerful, curious, empathetic, and encouraging. You feel like a best friend who genuinely wants to know someone better.

Current user profile data: ${JSON.stringify(existingTraits)}
Interview count: ${interviewCount}

Rules:
- Ask ONE engaging question at a time
- Questions should be fun, open-ended, and personality-revealing
- Each session should explore NEW aspects not already in the profile
- Keep questions warm and conversational, not clinical
- For first interview: ask about passions, ideal weekend, or what makes them laugh
- For return users: dive deeper or explore new areas (travel dreams, quirky habits, values)
- Never repeat questions from previous sessions
- Always address the user by name warmly`;

      // Check if we're missing identity fields
      const missingGender = !profile?.gender;
      const missingOrientation = !profile?.sexualOrientation;
      const missingBirthdate = !profile?.birthDate;

      let greeting: string;
      if (interviewCount === 0) {
        greeting = `Hi ${userName}! I'm Sally, and I'm SO excited to meet you! 🎉 Before we dive into the fun stuff, I'd love to learn a little about you. First — **how do you identify?** You can share your gender (e.g. man, woman, non-binary, or whatever feels right) and your sexual orientation (e.g. straight, gay, bisexual, etc.). And what year were you born? No pressure — you can always say "prefer not to say"! 😊`;
      } else if (missingGender || missingOrientation || missingBirthdate) {
        const missing = [missingGender && "gender", missingOrientation && "sexual orientation", missingBirthdate && "age"].filter(Boolean).join(", ");
        greeting = `Welcome back, ${userName}! 🌟 I noticed I'm still missing a few details — your ${missing}. Could you share those with me? It helps me find you much better matches! 💕`;
      } else {
        greeting = `Welcome back, ${userName}! 🌟 I've missed you! I already know a few things about you, but there's always more to discover. Today I want to ask you something a little different: **${await generateFollowUpQuestion(existingTraits, interviewCount)}**`;
      }

      if (eventSuggestions.length > 0) {
        greeting += " I also pulled a few verified upcoming events from your community below—tell me which ones feel like you, and I’ll use that to make future picks smarter.";
      }

      const messages: InterviewMessage[] = [
        { role: "assistant", content: greeting, timestamp: Date.now() },
      ];

      await updateInterviewSession(session.id, { messages });
      return { sessionId: session.id, message: greeting, eventSuggestions };
    }),

    eventFeedback: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        eventId: z.number(),
        response: z.enum(["interested", "not_for_me"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const session = await getInterviewSession(input.sessionId);
        if (!session || session.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
        return recordSallyEventFeedback(ctx.user.id, input.eventId, input.response, input.sessionId);
      }),

    chat: protectedProcedure
      .input(
        z.object({
          sessionId: z.number(),
          userMessage: z.string().max(500),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const session = await getInterviewSession(input.sessionId);
        if (!session) throw new Error("Session not found");

        const profile = await getProfileByUserId(ctx.user.id);
        const existingTraits = profile?.traits as ProfileTraits ?? {};
        const competitiveGameStats = await getCompetitiveGameStatsForUser(ctx.user.id);
        const userName = profile?.displayName || ctx.user.name || "friend";

        const messages = (session.messages as InterviewMessage[]) || [];
        messages.push({ role: "user", content: input.userMessage, timestamp: Date.now() });

        const profileIdentity = {
          gender: (profile as any)?.gender,
          sexualOrientation: (profile as any)?.sexualOrientation,
          birthDate: (profile as any)?.birthDate,
        };

        // Determine what profile fields are still missing to guide Sally's questions
        const missingFields: string[] = [];
        if (!profileIdentity.gender) missingFields.push("gender identity");
        if (!profileIdentity.sexualOrientation) missingFields.push("sexual orientation");
        if (!profileIdentity.birthDate) missingFields.push("age or birth year");
        const traitFields = ["hobbies", "favoriteActivities", "personalityKeywords", "dreamVacation", "favoriteFood", "morningOrNight", "idealWeekend", "lookingFor", "idealDate"];
        const missingTraits = traitFields.filter(f => !(existingTraits as any)[f]);
        if (missingTraits.length > 0) missingFields.push(...missingTraits.slice(0, 3).map(f => f.replace(/([A-Z])/g, ' $1').toLowerCase()));

        const profileCompleteness = Math.round(
          ((traitFields.filter(f => !!(existingTraits as any)[f]).length + (profileIdentity.gender ? 1 : 0) + (profileIdentity.sexualOrientation ? 1 : 0) + (profileIdentity.birthDate ? 1 : 0)) /
          (traitFields.length + 3)) * 100
        );

        const llmMessages = [
          {
            role: "system" as const,
            content: `You are Sally, a warm and enthusiastic AI host for Just Putzit. You have an ongoing relationship with ${userName} and your job is to make their profile as rich and detailed as possible through natural conversation.

Current profile traits already known: ${JSON.stringify(existingTraits)}
Identity on file: ${JSON.stringify(profileIdentity)}
Profile completeness: ${profileCompleteness}%
Fields still missing or incomplete: ${missingFields.length > 0 ? missingFields.join(", ") : "none — profile is looking great!"}
Private competitive-game participation summary: ${formatCompetitiveGameContext(competitiveGameStats)}

Rules:
- Respond warmly to their answer (1-2 sentences genuinely acknowledging what they shared)
- Then naturally weave in a question about one of the MISSING fields above — make it feel organic, not like a form
- The more they share, the richer their profile becomes — celebrate this! ("Ooh I'm learning so much about you!")
- NEVER ask about something already in their profile — always explore new territory
- If all fields are filled, go deeper: ask about their most memorable experience, what they want in a partner, or their 5-year dream
- Keep it conversational, warm, and fun — like a best friend who's genuinely curious
- Use emojis sparingly but naturally
- After 5+ exchanges, occasionally say "I'm updating your profile with all this amazing info!" to signal progress
- Game participation is optional context only: never expose answers or individual scores, never turn wins or losses into personality claims, and only mention a game if it fits naturally into the conversation
- Never be clinical, robotic, or repeat questions`,
          },
          ...messages.map(m => ({ role: m.role as "assistant" | "user", content: m.content })),
        ];

        const response = await invokeLLM({ messages: llmMessages });
        const sallyReply = (response.choices[0]?.message?.content as string) || "That's so interesting! Tell me more!";

        messages.push({ role: "assistant", content: sallyReply, timestamp: Date.now() });

        // Check if interview should end (after ~5 exchanges or Sally says wrap-up)
        const userTurns = messages.filter(m => m.role === "user").length;
        const isComplete = userTurns >= 5 || (typeof sallyReply === 'string' && sallyReply.toLowerCase().includes("update your profile"));

        await updateInterviewSession(input.sessionId, {
          messages,
          ...(isComplete ? { completedAt: new Date() } : {}),
        });

        const behaviorReviewCue = getSallyBehaviorReviewCue(messages);
        if (behaviorReviewCue) {
          const { createSallyBehaviorReviewFlag } = await import("./db");
          await createSallyBehaviorReviewFlag(ctx.user.id, behaviorReviewCue);
        }

        // ── Continuous profile enrichment: run after EVERY user message ──────────
        // Extract whatever new info was shared in this exchange and MERGE into profile
        // This means the profile gets richer with every single message sent to Sally
        try {
          const [newTraits, identityExtracted] = await Promise.all([
            extractTraitsFromInterview(messages, existingTraits),
            extractIdentityFromInterview(messages),
          ]);

          const mergedTraits = mergeProfileTraits(existingTraits, newTraits) as ProfileTraits;

          // Regenerate AI summary if we have enough data
          if (Object.keys(mergedTraits).length > 2) {
            mergedTraits.aiSummary = await generateProfileSummary(
              mergedTraits,
              userName,
              messages,
              existingTraits.aiSummary,
            );
          }

          await updateProfile(ctx.user.id, {
            traits: mergedTraits,
            ...(isComplete ? { interviewCount: (profile?.interviewCount ?? 0) + 1 } : {}),
          });

          if (isComplete) {
            await updateInterviewSession(input.sessionId, { extractedTraits: mergedTraits });
          }

          // Save identity fields if newly discovered
          if (identityExtracted.gender || identityExtracted.sexualOrientation || identityExtracted.birthDate) {
            await updateProfileIdentity(ctx.user.id, identityExtracted);
          }
        } catch (err) {
          // Non-fatal: profile update failure should not break the chat
          console.warn("[Sally] Profile enrichment failed:", err);
        }

        return { message: sallyReply, isComplete };
      }),

    complete: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const session = await getInterviewSession(input.sessionId);
        if (!session) throw new Error("Session not found");

        const profile = await getProfileByUserId(ctx.user.id);
        const existingTraits = profile?.traits as ProfileTraits ?? {};
        const messages = session.messages as InterviewMessage[];

        const extractedTraits = await extractTraitsFromInterview(messages, existingTraits);
        const mergedTraits = { ...existingTraits, ...extractedTraits };
        const userName = profile?.displayName || ctx.user.name || "friend";
        mergedTraits.aiSummary = await generateProfileSummary(mergedTraits, userName, messages, existingTraits.aiSummary);

        await updateInterviewSession(input.sessionId, { extractedTraits, completedAt: new Date() });
        await updateProfile(ctx.user.id, {
          traits: mergedTraits,
          interviewCount: (profile?.interviewCount ?? 0) + 1,
        });

        return { success: true, traits: mergedTraits };
      }),
  }),

  // ─── Member dashboard ─────────────────────────────────────────────────────
  dashboard: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const [profile, bookings, wyrAnswerCount, challenges, competitiveGameStats] = await Promise.all([
        getProfileByUserId(ctx.user.id),
        getBookingsForUser(ctx.user.id),
        getWyrAnswerCount(ctx.user.id),
        getWyrChallengesForUser(ctx.user.id),
        getCompetitiveGameStatsForUser(ctx.user.id),
      ]);
      const enrichedBookings = await Promise.all(bookings.map(async (booking) => {
        const [activity, venue] = await Promise.all([getActivityById(booking.activityId), getVenueById(booking.venueId)]);
        return { ...booking, activity, venue };
      }));
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const upcomingBookings = enrichedBookings
        .filter((booking) => {
          if (booking.status !== "confirmed" && booking.status !== "checked_in") return false;
          const scheduledAt = booking.scheduledFor ?? booking.activity?.eventDate;
          return !scheduledAt || scheduledAt >= today;
        })
        .sort((a, b) => {
          const aTime = (a.scheduledFor ?? a.activity?.eventDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          const bTime = (b.scheduledFor ?? b.activity?.eventDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          return aTime - bTime;
        });
      const achievements = deriveGameAchievements(
        profile?.traits as Record<string, unknown> | undefined,
        wyrAnswerCount,
        challenges.filter((challenge) => challenge.status === "completed").length,
      );
      return {
        member: { displayName: profile?.displayName ?? ctx.user.name ?? null, city: profile?.city ?? null },
        upcomingBookings: upcomingBookings.slice(0, 3),
        upcomingBookingCount: upcomingBookings.length,
        achievements,
        competitiveGameStats,
      };
    }),
  }),

  // ─── Matchmaking ──────────────────────────────────────────────────────────
  matchmaking: router({
    getMyMatches: protectedProcedure.query(async ({ ctx }) => {
      const myMatches = await getMatchesForUser(ctx.user.id);
      const enriched = await Promise.all(
        myMatches.map(async match => {
          const otherUserId = match.user1Id === ctx.user.id ? match.user2Id : match.user1Id;
          if (await isBlockInEffect(ctx.user.id, otherUserId)) return null;
          const otherProfile = await getProfileByUserId(otherUserId);
          const otherUser = await getUserByOpenId("").catch(() => null);
          return { ...match, otherProfile, otherUserId };
        })
      );
      return enriched.filter((match): match is NonNullable<typeof match> => match !== null);
    }),

    findMatches: protectedProcedure.mutation(async ({ ctx }) => {
      const myProfile = await getProfileByUserId(ctx.user.id);
      if (!myProfile) throw new Error("Complete your profile first");
      const myPreferences = normalizeConnectionPreferences((myProfile.traits as ProfileTraits | null)?.connectionPreferences);
      if (!myPreferences.friendship && !myPreferences.dating) {
        return { matches: [], preferenceRequired: true };
      }

      const allProfiles = await getAllProfiles();
      const eligibleProfiles = allProfiles.filter(
        p => p.userId !== ctx.user.id && p.onboardingComplete && p.interviewCount > 0 && hasSharedConnectionIntent(myPreferences, (p.traits as ProfileTraits | null)?.connectionPreferences)
      );
      const candidates = (await Promise.all(eligibleProfiles.map(async (profile) => (
        await isBlockInEffect(ctx.user.id, profile.userId) ? null : profile
      )))).filter((profile): profile is typeof eligibleProfiles[number] => profile !== null);

      if (candidates.length === 0) return { matches: [], preferenceRequired: false };

      const newMatches = [];
      for (const candidate of candidates.slice(0, 5)) {
        const already = await existingMatch(ctx.user.id, candidate.userId);
        if (already) continue;

        const result = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a matchmaking AI for Just Putzit. Analyze two user profiles and determine compatibility.`,
            },
            {
              role: "user",
              content: `User A profile: ${JSON.stringify(myProfile.traits)}
User B profile: ${JSON.stringify(candidate.traits)}

Return a JSON object with:
- score: number 0-100 (compatibility percentage)
- reason: string (1-2 warm, encouraging sentences explaining why they'd connect well)`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "match_result",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  score: { type: "number" },
                  reason: { type: "string" },
                },
                required: ["score", "reason"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = result.choices[0]?.message?.content;
        const parsed = JSON.parse(typeof content === "string" ? content : "{}");
        const score = Math.min(100, Math.max(0, Math.round(parsed.score ?? 75)));
        const reason = parsed.reason ?? "You two seem like a great match!";

        if (score >= 60) {
          const match = await createMatch(ctx.user.id, candidate.userId, score, reason);
          if (match) {
            await createNotification(candidate.userId, "new_match", "You have a new match! 🎉", `Sally found someone special for you!`, match.id);
            newMatches.push({ ...match, otherProfile: candidate });
          }
        }
      }

      return { matches: newMatches, preferenceRequired: false };
    }),

    getMatchDetails: protectedProcedure
      .input(z.object({ matchId: z.number() }))
      .query(async ({ ctx, input }) => {
        const match = await getMatchById(input.matchId);
        if (!match) throw new Error("Match not found");
        if (!isMatchParticipant(match, ctx.user.id)) throw new TRPCError({ code: "FORBIDDEN", message: "This match is not available to you" });
        const otherUserId = match.user1Id === ctx.user.id ? match.user2Id : match.user1Id;
        if (await isBlockInEffect(ctx.user.id, otherUserId)) throw new TRPCError({ code: "FORBIDDEN", message: "This match is no longer available" });
        const otherProfile = await getProfileByUserId(otherUserId);
        return { match, otherProfile, otherUserId };
      }),
  }),

  // ─── Chat ─────────────────────────────────────────────────────────────────
  chat: router({
    getMessages: protectedProcedure
      .input(z.object({ matchId: z.number() }))
      .query(async ({ ctx, input }) => {
        const match = await getMatchById(input.matchId);
        if (!isMatchParticipant(match, ctx.user.id)) throw new TRPCError({ code: "FORBIDDEN", message: "This conversation is not available to you" });
        const otherUserId = match!.user1Id === ctx.user.id ? match!.user2Id : match!.user1Id;
        if (await isBlockInEffect(ctx.user.id, otherUserId)) throw new TRPCError({ code: "FORBIDDEN", message: BLOCKED_CONVERSATION_MESSAGE });
        return getChatMessages(input.matchId);
      }),

    send: protectedProcedure
      .input(z.object({ matchId: z.number(), content: z.string().max(1000) }))
      .mutation(async ({ ctx, input }) => {
        const match = await getMatchById(input.matchId);
        if (!isMatchParticipant(match, ctx.user.id)) throw new TRPCError({ code: "FORBIDDEN", message: "This conversation is not available to you" });
        const otherId = match!.user1Id === ctx.user.id ? match!.user2Id : match!.user1Id;
        if (await isBlockInEffect(ctx.user.id, otherId)) throw new TRPCError({ code: "FORBIDDEN", message: BLOCKED_CONVERSATION_MESSAGE });
        const msg = await sendChatMessage(input.matchId, ctx.user.id, input.content);
        await createNotification(otherId, "new_message", "New message! 💬", "Your match sent you a message", input.matchId);
        return msg;
      }),
  }),

  // ─── Public Event Proposals ────────────────────────────────────────────────
  eventProposals: router({
    getForMatch: protectedProcedure
      .input(z.object({ matchId: z.number() }))
      .query(async ({ ctx, input }) => {
        const match = await getMatchById(input.matchId);
        if (!isMatchParticipant(match, ctx.user.id)) throw new TRPCError({ code: "FORBIDDEN", message: "This match is not available to you" });
        const otherUserId = match!.user1Id === ctx.user.id ? match!.user2Id : match!.user1Id;
        if (await isBlockInEffect(ctx.user.id, otherUserId)) throw new TRPCError({ code: "FORBIDDEN", message: "This match is no longer available" });
        return getEventProposalsForMatch(input.matchId);
      }),

    create: protectedProcedure
      .input(z.object({ matchId: z.number(), eventId: z.number(), note: z.string().trim().max(500).optional() }))
      .mutation(async ({ ctx, input }) => {
        const match = await getMatchById(input.matchId);
        if (!isMatchParticipant(match, ctx.user.id)) throw new TRPCError({ code: "FORBIDDEN", message: "This match is not available to you" });
        const potentialRecipientId = match!.user1Id === ctx.user.id ? match!.user2Id : match!.user1Id;
        if (await isBlockInEffect(ctx.user.id, potentialRecipientId)) throw new TRPCError({ code: "FORBIDDEN", message: "This match is no longer available" });

        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Event data is unavailable" });
        const [event] = await db.select().from(communityEvents).where(and(eq(communityEvents.id, input.eventId), eq(communityEvents.isActive, true))).limit(1);
        if (!isEligiblePublicEventProposal(event)) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose an upcoming public event" });

        const recipientId = potentialRecipientId;
        const proposal = await createEventProposal({ ...input, proposerId: ctx.user.id, recipientId });
        await createNotification(recipientId, "event_proposal", "A match invited you to a public event", `${event.title} — choose accept or decline in your chat.`, input.matchId);
        return { proposal, event };
      }),

    respond: protectedProcedure
      .input(z.object({ proposalId: z.number(), status: z.enum(["accepted", "declined"]) }))
      .mutation(async ({ ctx, input }) => {
        const proposal = await respondToEventProposal({ ...input, recipientId: ctx.user.id });
        const [event] = (await getEventProposalsForMatch(proposal.matchId)).filter((entry) => entry.proposal.id === proposal.id);
        const title = event?.event.title ?? "the public event";
        const accepted = input.status === "accepted";
        await createNotification(
          proposal.proposerId,
          "event_proposal",
          accepted ? "You’re going together!" : "Your invitation was declined",
          accepted ? `Your match accepted ${title}. Both of you can add it to your calendars.` : `Your match declined ${title}. No further action is needed.`,
          proposal.matchId,
        );
        return { proposal, event: event?.event ?? null };
      }),
  }),

  // ─── Games ────────────────────────────────────────────────────────────────
  games: router({
    recordGameAnswer: protectedProcedure
      .input(z.object({
        gameType: z.string(),
        questionId: z.number(),
        answer: z.string(),
        traitKey: z.string().optional(),
        traitValue: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Merge trait into profile if provided
        if (input.traitKey && input.traitValue) {
          await mergeGameTraitsIntoProfile(ctx.user.id, { [input.traitKey]: input.traitValue });
        }
        return { ok: true };
      }),

    startNewlywed: protectedProcedure
      .input(z.object({ matchId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const match = await getMatchById(input.matchId);
        if (!match) throw new Error("Match not found");

        const user1Profile = await getProfileByUserId(match.user1Id);
        const user2Profile = await getProfileByUserId(match.user2Id);

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are Sally, the warm and fun AI host of Just Putzit's Newlywed Game. Generate 6 personalized quiz questions based on the two users' profiles. Each question asks one person to guess what the other person answered about themselves.`,
            },
            {
              role: "user",
              content: `User 1 profile: ${JSON.stringify(user1Profile?.traits)}
User 2 profile: ${JSON.stringify(user2Profile?.traits)}

Generate 6 questions in this JSON format. Alternate between asking about User 1 and User 2.`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "newlywed_questions",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        question: { type: "string" },
                        targetUserId: { type: "number" },
                        targetUserName: { type: "string" },
                        correctAnswer: { type: "string" },
                      },
                      required: ["id", "question", "targetUserId", "targetUserName", "correctAnswer"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["questions"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices[0]?.message?.content;
        const parsed = JSON.parse(typeof content === "string" ? content : '{"questions":[]}');
        const questions: GameQuestion[] = parsed.questions || [];

        const session = await createGameSession(input.matchId, "newlywed", questions);
        await createNotification(
          match.user1Id === ctx.user.id ? match.user2Id : match.user1Id,
          "game_ready",
          "Game time! 🎮",
          "Your match wants to play the Newlywed Game with you!",
          session?.id
        );
        return session;
      }),

    startTwoTruths: protectedProcedure
      .input(z.object({ matchId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const match = await getMatchById(input.matchId);
        if (!match) throw new Error("Match not found");

        const user1Profile = await getProfileByUserId(match.user1Id);
        const user2Profile = await getProfileByUserId(match.user2Id);

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are Sally, generating Two Truths and a Lie statements for a fun icebreaker game on Just Putzit. Generate 3 statements per user — 2 truths and 1 lie — based on their profile. Make the lie plausible but subtly off.`,
            },
            {
              role: "user",
              content: `User 1 profile: ${JSON.stringify(user1Profile?.traits)}
User 2 profile: ${JSON.stringify(user2Profile?.traits)}

Return JSON with questions array, each having statements array (3 items) and lieIndex (0, 1, or 2).`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "two_truths",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        question: { type: "string" },
                        targetUserId: { type: "number" },
                        targetUserName: { type: "string" },
                        statements: { type: "array", items: { type: "string" } },
                        lieIndex: { type: "number" },
                        correctAnswer: { type: "string" },
                      },
                      required: ["id", "question", "targetUserId", "targetUserName", "statements", "lieIndex", "correctAnswer"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["questions"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices[0]?.message?.content;
        const parsed = JSON.parse(typeof content === "string" ? content : '{"questions":[]}');
        const session = await createGameSession(input.matchId, "two_truths", parsed.questions || []);
        return session;
      }),

    startThisOrThat: protectedProcedure
      .input(z.object({ matchId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const match = await getMatchById(input.matchId);
        if (!match) throw new Error("Match not found");

        const user1Profile = await getProfileByUserId(match.user1Id);
        const user2Profile = await getProfileByUserId(match.user2Id);

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are Sally, generating This or That rapid-fire questions for Just Putzit. Create 10 fun either/or questions tailored to the two users' shared interests and personalities.`,
            },
            {
              role: "user",
              content: `User 1 profile: ${JSON.stringify(user1Profile?.traits)}
User 2 profile: ${JSON.stringify(user2Profile?.traits)}

Return JSON with questions array, each having optionA and optionB.`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "this_or_that",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        question: { type: "string" },
                        optionA: { type: "string" },
                        optionB: { type: "string" },
                        correctAnswer: { type: "string" },
                        targetUserId: { type: "number" },
                        targetUserName: { type: "string" },
                      },
                      required: ["id", "question", "optionA", "optionB", "correctAnswer", "targetUserId", "targetUserName"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["questions"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices[0]?.message?.content;
        const parsed = JSON.parse(typeof content === "string" ? content : '{"questions":[]}');
        const session = await createGameSession(input.matchId, "this_or_that", parsed.questions || []);
        return session;
      }),

    submitAnswer: protectedProcedure
      .input(
        z.object({
          sessionId: z.number(),
          questionId: z.string(),
          answer: z.string(),
          isUser1: z.boolean(),
        })
      )
      .mutation(async ({ input }) => {
        const session = await getGameSession(input.sessionId);
        if (!session) throw new Error("Session not found");

        const questions = session.questions as GameQuestion[];
        const qIndex = questions.findIndex(q => q.id === input.questionId);
        if (qIndex === -1) throw new Error("Question not found");

        const q = questions[qIndex]!;
        if (input.isUser1) {
          q.user1Answer = input.answer;
          q.user1Correct = input.answer.toLowerCase() === q.correctAnswer?.toLowerCase();
        } else {
          q.user2Answer = input.answer;
          q.user2Correct = input.answer.toLowerCase() === q.correctAnswer?.toLowerCase();
        }
        questions[qIndex] = q;

        const user1Score = questions.filter(q => q.user1Correct).length;
        const user2Score = questions.filter(q => q.user2Correct).length;
        const allAnswered = questions.every(q => q.user1Answer && q.user2Answer);

        // For This or That: match % = how often both picked the same option
        const bothAnswered = questions.filter(q => q.user1Answer && q.user2Answer);
        const sameChoices = bothAnswered.filter(
          q => q.user1Answer?.toLowerCase() === q.user2Answer?.toLowerCase()
        ).length;
        const matchPercent = bothAnswered.length > 0
          ? Math.round((sameChoices / bothAnswered.length) * 100)
          : 0;

        let sallyNarration: string | undefined;
        if (allAnswered) {
          const narrationResponse = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are Sally, the warm and enthusiastic AI host of Just Putzit. Narrate the game results in a fun, game-show style. Be encouraging and highlight funny or sweet moments from the answers.`,
              },
              {
                role: "user",
                content: session.gameType === "this_or_that"
                  ? `This or That results: the pair matched on ${sameChoices}/${bothAnswered.length} questions (${matchPercent}% match). Questions and answers: ${JSON.stringify(questions)}. Write a 2-3 sentence warm, celebratory narration that highlights the match percentage.`
                  : `Game results: User 1 scored ${user1Score}/${questions.length}, User 2 scored ${user2Score}/${questions.length}. Questions and answers: ${JSON.stringify(questions)}. Write a 2-3 sentence warm, celebratory narration.`,
              },
            ],
          });
          sallyNarration = (narrationResponse.choices[0]?.message?.content as string) || "What a fantastic game!";
        }

                await updateGameSession(input.sessionId, {
          questions,
          user1Score,
          user2Score,
          ...(allAnswered ? { status: "completed", completedAt: new Date(), sallyNarration } : {}),
        });
        // Fire-and-forget: when game is complete, extract traits from all Q&A pairs
        if (allAnswered) {
          const qaItems = questions
            .filter(q => q.user1Answer || q.user2Answer)
            .map(q => ({
              // GameQuestion uses 'question' field (not 'text')
              question: q.question || String(q.id) || "game question",
              answer: input.isUser1 ? (q.user1Answer || "") : (q.user2Answer || ""),
            }))
            .filter(qa => qa.answer);
          if (qaItems.length > 0) {
            // Resolve player IDs via the match record (gameSessions has matchId, not user IDs directly)
            const gameSession = await getGameSession(input.sessionId);
            if (gameSession) {
              const matchRecord = await getMatchById(gameSession.matchId);
              extractTraitsFromGameplay({ gameType: "this_or_that", qaItems }).then((traits) => {
                if (matchRecord) {
                  mergeGameTraitsIntoProfile(matchRecord.user1Id, traits).catch(() => {});
                  mergeGameTraitsIntoProfile(matchRecord.user2Id, traits).catch(() => {});
                }
              }).catch(() => {});
            }
          }
        }
        return { questions, user1Score, user2Score, isComplete: allAnswered, sallyNarration, matchPercent };
      }),

    getSession: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        return getGameSession(input.sessionId);
      }),

    getSessionsForMatch: protectedProcedure
      .input(z.object({ matchId: z.number() }))
      .query(async ({ input }) => {
        return getGameSessionsForMatch(input.matchId);
      }),
  }),

  // ─── Public Game Lobby ─────────────────────────────────────────────────────
  gameLobby: router({
    listRooms: protectedProcedure
      .input(z.object({ city: z.string().optional() }))
      .query(async ({ input }) => {
        return listGameRooms(input.city);
      }),

    getRoom: protectedProcedure
      .input(z.object({ roomId: z.number() }))
      .query(async ({ input }) => {
        const room = await getGameRoom(input.roomId);
        const players = await getGameRoomPlayers(input.roomId);
        if (!room) return null;
        if (room.gameType !== "team_builder") return { ...room, players };
        const answers = (room.answers ?? []) as { userId: number; questionIndex: number; answer: string; timestamp: number }[];
        const currentQuestionIndex = room.currentQuestionIndex ?? 0;
        const currentAnswers = answers.filter((answer) => answer.questionIndex === currentQuestionIndex);
        const activePlayerIds = players.map((player) => player.userId);
        const submittedByActivePlayers = currentAnswers.filter((answer) => activePlayerIds.includes(answer.userId));
        const allSubmitted = activePlayerIds.length > 0 && submittedByActivePlayers.length >= activePlayerIds.length;
        const distinctAnswers = Array.from(new Set(submittedByActivePlayers.map((answer) => answer.answer)));
        const consensusAnswer = allSubmitted && distinctAnswers.length === 1 ? distinctAnswers[0] : null;
        const completedQuestionIndexes = Array.from(new Set(answers.map((answer) => answer.questionIndex)));
        const groupScore = completedQuestionIndexes.reduce((score, index) => {
          const roundAnswers = answers.filter((answer) => answer.questionIndex === index && activePlayerIds.includes(answer.userId));
          return roundAnswers.length >= activePlayerIds.length && new Set(roundAnswers.map((answer) => answer.answer)).size === 1 ? score + 10 : score;
        }, 0);
        return {
          ...room,
          players,
          answers: allSubmitted ? answers : answers.map((answer) => ({ ...answer, answer: "" })),
          teamBuilder: { submittedCount: submittedByActivePlayers.length, playerCount: activePlayerIds.length, allSubmitted, consensusAnswer, groupScore },
        };
      }),

    createRoom: protectedProcedure
      .input(z.object({
        name: z.string().min(2).max(80),
        gameType: z.enum(["would_you_rather", "trivia", "icebreaker", "two_truths", "finish_sentence", "bullgerdash", "team_builder"]),
        city: z.string().optional(),
        maxPlayers: z.number().min(2).max(12).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const profile = await getProfileByUserId(ctx.user.id);
        const city = input.city ?? profile?.city ?? undefined;

        // Generate questions via LLM based on game type
        const questionPrompt = input.gameType === "bullgerdash"
          ? null
          : input.gameType === "would_you_rather"
          ? `Generate 8 fun, creative "Would You Rather" questions for a group of adults getting to know each other. Make them light-hearted, interesting, and conversation-starting. Return JSON with a questions array, each having: id (number), text (string), optionA (string), optionB (string).`
          : input.gameType === "icebreaker"
          ? `Generate 8 fun icebreaker questions for adults getting to know each other. Questions should be open-ended and reveal personality. Return JSON with a questions array, each having: id (number), text (string).`
          : input.gameType === "two_truths"
          ? `Generate 8 "Two Truths and a Lie" prompts/topics for adults. Each prompt is a category/topic for players to create their own statements. Return JSON with a questions array, each having: id (number), text (string, the topic/prompt).`
          : input.gameType === "finish_sentence"
          ? `Generate 8 warm, open-ended "Finish My Sentence" prompts for adults getting to know each other. Keep every prompt short, playful, and safe for a community setting. Prompts should invite a personal answer without asking for private contact details, sensitive identity information, or sexual content. Return JSON with a questions array, each having: id (number), text (string, ending with an ellipsis).`
          : input.gameType === "team_builder"
          ? `Generate 8 safe, practical team-building scenarios for a group of adults. Each prompt asks the group to choose one of three positive collaboration approaches. Avoid workplace politics, sensitive identity topics, private information, sexual content, and pressure. Return JSON with a questions array, each having: id (number), text (string), optionA (string), optionB (string), optionC (string).`
          : `Generate 8 fun trivia questions about pop culture, food, travel, or fun facts. Return JSON with a questions array, each having: id (number), text (string), optionA (string), optionB (string), optionC (string), optionD (string), correctAnswer (string).`;

        let roomQuestions: Array<{ id: number; text: string; optionA?: string; optionB?: string; optionC?: string; optionD?: string }> = [];
        if (questionPrompt) {
          const generated = await invokeLLM({
            messages: [
              { role: "system", content: questionPrompt },
              { role: "user", content: "Generate the questions now." },
            ],
            response_format: { type: "json_schema", json_schema: { name: "lobby_questions", strict: false, schema: { type: "object", properties: { questions: { type: "array", items: { type: "object" } } }, required: ["questions"] } } },
          });
          const content = generated.choices[0]?.message?.content;
          roomQuestions = content ? JSON.parse(typeof content === "string" ? content : "{}").questions ?? [] : [];
        }

        const room = await createGameRoom({ hostUserId: ctx.user.id, name: input.name, gameType: input.gameType, city, maxPlayers: input.maxPlayers, questions: roomQuestions });
        if (room) await joinGameRoom(room.id, ctx.user.id);
        return room;
      }),

    joinRoom: protectedProcedure
      .input(z.object({ roomId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const room = await getGameRoom(input.roomId);
        if (!room) throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
        const players = await getGameRoomPlayers(input.roomId);
        if (players.length >= room.maxPlayers) throw new TRPCError({ code: "BAD_REQUEST", message: "Room is full" });
        await joinGameRoom(input.roomId, ctx.user.id);
        return { success: true };
      }),

    leaveRoom: protectedProcedure
      .input(z.object({ roomId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await leaveGameRoom(input.roomId, ctx.user.id);
        return { success: true };
      }),

    startGame: protectedProcedure
      .input(z.object({ roomId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const room = await getGameRoom(input.roomId);
        if (!room) throw new TRPCError({ code: "NOT_FOUND" });
        if (room.hostUserId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only the host can start the game" });
        await startGameRoom(input.roomId);
        return { success: true };
      }),

    submitAnswer: protectedProcedure
      .input(z.object({ roomId: z.number(), questionIndex: z.number(), answer: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const existingRoom = await getGameRoom(input.roomId);
        if (existingRoom?.gameType === "team_builder") {
          const existingAnswers = (existingRoom.answers ?? []) as { userId: number; questionIndex: number }[];
          if (existingAnswers.some((answer) => answer.userId === ctx.user.id && answer.questionIndex === input.questionIndex)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Your Team Builder choice is locked for this round." });
          }
        }
        await submitGameAnswer(input.roomId, ctx.user.id, input.questionIndex, input.answer);
        // Fire-and-forget: extract traits from this game answer
        const room = await getGameRoom(input.roomId);
        if (room && room.gameType !== "team_builder" && room.questions) {
          const questions = room.questions as Array<{ text?: string; id?: number }>;
          const q = questions[input.questionIndex];
          if (q?.text) {
            extractTraitsFromGameplay({
              gameType: "lobby_game",
              qaItems: [{ question: q.text, answer: input.answer }],
            }).then((traits) => mergeGameTraitsIntoProfile(ctx.user.id, traits)).catch(() => {});
          }
        }
        return { success: true };
      }),

    nextQuestion: protectedProcedure
      .input(z.object({ roomId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const room = await getGameRoom(input.roomId);
        if (!room) throw new TRPCError({ code: "NOT_FOUND" });
        if (room.hostUserId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        await advanceGameQuestion(input.roomId);
        return { success: true };
      }),
  }),

  // ─── Safety ─────────────────────────────────────────────────────────────
  safety: router({
    report: protectedProcedure
      .input(z.object({
        reportedUserId: z.number(),
        reason: z.enum(["scammer", "bot", "harassment", "fake_profile", "inappropriate", "other"]),
        details: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isValidMemberSafetyTarget(ctx.user.id, input.reportedUserId)) throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot report yourself" });
        await createReport(ctx.user.id, input.reportedUserId, input.reason, input.details);
        return { success: true };
      }),

    block: protectedProcedure
      .input(z.object({ blockedUserId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!isValidMemberSafetyTarget(ctx.user.id, input.blockedUserId)) throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot block yourself" });
        await blockUser(ctx.user.id, input.blockedUserId);
        return { success: true };
      }),

    getBlockedIds: protectedProcedure.query(async ({ ctx }) => {
      return getBlockedUserIds(ctx.user.id);
    }),

    getReports: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new Error("Forbidden");
      return getReportsForAdmin();
    }),

    getFlags: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new Error("Forbidden");
      return getAdminFlags();
    }),

    resolveFlag: protectedProcedure
      .input(z.object({ flagId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new Error("Forbidden");
        await resolveAdminFlag(input.flagId);
        return { success: true };
      }),

    updateReport: protectedProcedure
      .input(z.object({
        reportId: z.number(),
        status: z.enum(["pending", "reviewed", "actioned", "dismissed"]),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new Error("Forbidden");
        await updateReportStatus(input.reportId, input.status);
        return { success: true };
      }),

    suspendUser: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new Error("Forbidden");
        await suspendUser(input.userId);
        return { success: true };
      }),

    getAllUsers: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new Error("Forbidden");
      return getAllUsers();
    }),

    setAdministratorRole: adminProcedure
      .input(z.object({ userId: z.number().int().positive(), role: z.enum(["user", "admin"]) }))
      .mutation(async ({ ctx, input }) => {
        const target = await getUserById(input.userId);
        if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });

        const blockReason = getAdminRoleChangeBlock(
          ctx.user.id,
          { id: target.id, openId: target.openId, email: target.email, role: target.role },
          input.role,
          ENV.adminEmails,
        );
        if (blockReason) throw new TRPCError({ code: "FORBIDDEN", message: blockReason });

        const member = await setMemberAdministratorRole(input.userId, input.role);
        return { success: true, member };
      }),

    getStats: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new Error("Forbidden");
      return getAdminStats();
    }),

    searchUsers: protectedProcedure
      .input(z.object({ query: z.string().default(""), limit: z.number().max(100).default(50), offset: z.number().default(0) }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new Error("Forbidden");
        return searchUsers(input.query, input.limit, input.offset);
      }),

    getUserDetail: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new Error("Forbidden");
        return getUserWithProfile(input.userId);
      }),

    banUser: protectedProcedure
      .input(z.object({ userId: z.number(), reason: z.string().default("Violated community guidelines") }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new Error("Forbidden");
        await banUser(input.userId, input.reason);
        return { success: true };
      }),

    unbanUser: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        await unbanUser(input.userId);
        return { success: true };
      }),

    approveUser: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        await approveSuspendedUser(input.userId);
        return { success: true };
      }),

    getStatsEnhanced: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new Error("Forbidden");
      return getAdminStatsEnhanced();
    }),

    getAllPhotos: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new Error("Forbidden");
      return getAllProfilePhotosAdmin(200);
    }),

    deletePhoto: protectedProcedure
      .input(z.object({ photoId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new Error("Forbidden");
        await adminDeletePhoto(input.photoId);
        return { success: true };
      }),

    listUsersWithLocation: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new Error("Forbidden");
      return getUsersWithGpsLocations();
    }),

    refreshEvents: protectedProcedure.mutation(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new Error("Forbidden");
      // Fire-and-forget crawl — returns immediately so the UI isn't blocked
      crawlAllCities().catch((e) => console.error("[admin.refreshEvents] crawl error:", e));
      return { ok: true, message: "Event refresh started in background" };
    }),

    getSallyEventFeedback: adminProcedure
      .input(z.object({ limit: z.number().int().min(1).max(500).default(200) }))
      .query(async ({ input }) => getAdminSallyEventFeedback(input.limit)),
  }),

  // ─── Venues & Activities ──────────────────────────────────────────────────
  venues: router({
    getAll: protectedProcedure
      .input(z.object({ city: z.string().optional() }))
      .query(async ({ input }) => {
        return getVenuePartners(input.city);
      }),

    getById: protectedProcedure
      .input(z.object({ venueId: z.number() }))
      .query(async ({ input }) => {
        return getVenueById(input.venueId);
      }),

    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        category: z.enum(ACTIVITY_CATEGORY_VALUES),
        description: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        phone: z.string().optional(),
        website: z.string().optional(),
        isPublicAccess: z.boolean().optional(),
        accessNotes: z.string().max(300).optional(),
        referralFeePerVisit: z.number().default(100),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new Error("Forbidden");
        return createVenuePartner(input);
      }),
  }),

  communityDirectory: router({
    search: protectedProcedure
      .input(z.object({
        city: z.string().trim().min(2).max(100),
        state: z.string().trim().min(2).max(40).optional(),
        kind: z.enum(["churches", "help"]),
        lat: z.number().min(-90).max(90).optional(),
        lng: z.number().min(-180).max(180).optional(),
      }))
      .query(async ({ input }) => {
        if (!isCommunityDirectoryCity(input.city)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a city to search the community directory." });
        }
        return getCommunityDirectory(input);
      }),
  }),

  activityBoard: router({
    getAll: protectedProcedure
      .input(z.object({
        city: z.string().optional(),
        category: z.string().optional(),
        lat: z.number().optional(),
        lng: z.number().optional(),
        radiusMiles: z.number().min(1).max(100).optional(),
      }))
      .query(async ({ ctx, input }) => {
        const profile = await getProfileByUserId(ctx.user.id);
        const city = input.city ?? profile?.city ?? undefined;
        const profileLat = profile?.latitude ? Number(profile.latitude) : undefined;
        const profileLng = profile?.longitude ? Number(profile.longitude) : undefined;
        if (city) {
          await refreshPublicActivitiesForCity(city, profile?.state ?? undefined).catch(() => {});
        }
        return getActivityListings(
          city,
          input.category,
          {
            lat: input.lat ?? profileLat,
            lng: input.lng ?? profileLng,
            radiusMiles: input.radiusMiles,
          },
        );
      }),

        getById: protectedProcedure
      .input(z.object({ activityId: z.number() }))
      .query(async ({ input }) => {
        return getActivityById(input.activityId);
      }),
    publicGetById: publicProcedure
      .input(z.object({ activityId: z.number() }))
      .query(async ({ input }) => {
        const activity = await getActivityById(input.activityId);
        if (!activity) throw new TRPCError({ code: "NOT_FOUND" });
        return {
          id: activity.id,
          title: activity.title,
          description: activity.description,
          category: activity.category,
          eventDate: activity.eventDate,
          durationMinutes: activity.durationMinutes,
          maxGroupSize: activity.maxGroupSize,
          isSponsored: activity.isSponsored,
          venueName: (activity as any).venueName ?? null,
          venueCity: (activity as any).venueCity ?? null,
          venueAddress: (activity as any).venueAddress ?? null,
        };
      }),
    create: protectedProcedure
      .input(z.object({
        venueId: z.number(),
        title: z.string(),
        description: z.string().optional(),
        category: z.enum(ACTIVITY_CATEGORY_VALUES),
        eventDate: z.string().optional(),
        durationMinutes: z.number().optional(),
        maxGroupSize: z.number().optional(),
        isRecurring: z.boolean().optional(),
        recurringSchedule: z.string().optional(),
        isPublicAccess: z.boolean().optional(),
        accessNotes: z.string().max(300).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new Error("Forbidden");
        return createActivityListing({
          ...input,
          eventDate: input.eventDate ? new Date(input.eventDate) : undefined,
        });
      }),

    rsvp: protectedProcedure
      .input(z.object({ activityId: z.number(), matchId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const rsvp = await rsvpToActivity(input.activityId, ctx.user.id, input.matchId);
        if (rsvp) await recordSponsoredPlacementMetric({ activityId: input.activityId, userId: ctx.user.id, eventType: "sign_up" });
        return rsvp;
      }),

    checkIn: protectedProcedure
      .input(z.object({ activityId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await checkInToActivity(input.activityId, ctx.user.id);
        return { success: true };
      }),

    getRsvps: protectedProcedure
      .input(z.object({ activityId: z.number() }))
      .query(async ({ input }) => {
        return getRsvpsForActivity(input.activityId);
      }),

    getSallyRecommendations: protectedProcedure
      .input(z.object({ matchId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const profile = await getProfileByUserId(ctx.user.id);
        const allActivities = await getActivityListings(profile?.city ?? undefined);

        if (allActivities.length === 0) {
          return {
            sallyMessage: "Hey there! I'm scouting your area for amazing activities right now! Check back soon — I'll have personalized picks just for you. In the meantime, explore the map below! 🗺️",
            activities: [],
          };
        }

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are Sally from Just Putzit. Based on a user's profile, recommend activities and write a warm 1-2 sentence message suggesting what they should do this weekend.`,
            },
            {
              role: "user",
              content: `User profile: ${JSON.stringify(profile?.traits)}\nAvailable activities: ${JSON.stringify(allActivities.slice(0, 10))}\n\nReturn JSON: { sallyMessage: string, recommendedActivityIds: number[] }`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "sally_recs",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  sallyMessage: { type: "string" },
                  recommendedActivityIds: { type: "array", items: { type: "number" } },
                },
                required: ["sallyMessage", "recommendedActivityIds"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices[0]?.message?.content;
        const parsed = JSON.parse(typeof content === "string" ? content : "{}");
        const recommended = allActivities.filter((a: { id: number }) => parsed.recommendedActivityIds?.includes(a.id));
        return {
          sallyMessage: parsed.sallyMessage || "I found some great activities for you this weekend!",
          activities: recommended.length > 0 ? recommended : allActivities.slice(0, 4),
        };
      }),
    getPersonalized: protectedProcedure.query(async ({ ctx }) => {
      const profile = await getProfileByUserId(ctx.user.id);
      const [activities, preferredCategories] = await Promise.all([
        getActivityListings(profile?.city ?? undefined),
        getMemberPreferredPickupCategories(ctx.user.id),
      ]);
      return {
        categories: preferredCategories,
        activities: selectSimilarActivities(activities, preferredCategories),
      };
    }),
    bookmarks: protectedProcedure.query(async ({ ctx }) => getActivityBookmarksForUser(ctx.user.id)),
    savedEvents: protectedProcedure.query(async ({ ctx }) => getSavedActivityEventsForUser(ctx.user.id)),
    toggleBookmark: protectedProcedure
      .input(z.object({ activityId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const activity = await getActivityById(input.activityId);
        if (!activity) throw new TRPCError({ code: "NOT_FOUND", message: "Activity not found." });
        return toggleActivityBookmark(input.activityId, ctx.user.id);
      }),
    similarForActivity: protectedProcedure
      .input(z.object({ activityId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const current = await getActivityById(input.activityId);
        if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Activity not found." });
        const profile = await getProfileByUserId(ctx.user.id);
        const preferredCategories = await getMemberPreferredPickupCategories(ctx.user.id);
        const city = profile?.city ?? (current as any).venueCity ?? undefined;
        const userLat = profile?.latitude != null ? Number(profile.latitude) : undefined;
        const userLng = profile?.longitude != null ? Number(profile.longitude) : undefined;
        const activities = await getActivityListings(city, undefined, {
          lat: userLat,
          lng: userLng,
          radiusMiles: 50,
        });
        return {
          basedOnPreferences: preferredCategories.length > 0,
          activities: selectSimilarEventDetails({
            activities,
            currentActivityId: current.id,
            currentCategory: current.category,
            preferredCategories,
          }),
        };
      }),
  }),

  pickupActivities: router({
    list: protectedProcedure.input(z.object({ city: z.string().optional() })).query(async ({ ctx, input }) => {
      const profile = await getProfileByUserId(ctx.user.id);
      return getPickupSessionsForMember(ctx.user.id, input.city ?? profile?.city ?? undefined);
    }),
    alertPreference: protectedProcedure.query(async ({ ctx }) => getPickupAlertPreference(ctx.user.id)),
    setAlertPreference: protectedProcedure
      .input(z.object({
        enabled: z.boolean(),
        city: z.string().max(100).optional(),
        categories: z.array(z.string().max(40)).max(12).optional(),
      }))
      .mutation(async ({ ctx, input }) => savePickupAlertPreference(ctx.user.id, input)),
    create: protectedProcedure
      .input(z.object({
        activityType: z.enum(PICKUP_ACTIVITY_TYPES),
        title: z.string().trim().min(3).max(160),
        description: z.string().trim().max(500).optional(),
        city: z.string().trim().min(2).max(100),
        state: z.string().trim().min(2).max(32),
        venueName: z.string().trim().min(2).max(200),
        venueAddress: z.string().trim().max(300).optional(),
        startAt: z.string().datetime(),
        endAt: z.string().datetime().optional(),
        capacity: z.number().int().min(2).max(20),
      }))
      .mutation(async ({ ctx, input }) => {
        const startAt = new Date(input.startAt);
        const endAt = input.endAt ? new Date(input.endAt) : undefined;
        const safetyError = getPickupSafetyError({ startAt, endAt, capacity: input.capacity, venueName: input.venueName, city: input.city });
        if (safetyError) throw new TRPCError({ code: "BAD_REQUEST", message: safetyError });
        const session = await createPickupSession({ ...input, hostUserId: ctx.user.id, startAt, endAt });
        const notifiedCount = await notifyNearbyPickupMembers(session);
        return { session, notifiedCount };
      }),
    join: protectedProcedure
      .input(z.object({ sessionId: z.number().int() }))
      .mutation(async ({ ctx, input }) => joinPickupSession(input.sessionId, ctx.user.id)),
    template: protectedProcedure
      .input(z.object({ activityType: z.enum(PICKUP_ACTIVITY_TYPES) }))
      .query(({ input }) => pickupTemplate(input.activityType)),
  }),

  // ─── Community Groups ─────────────────────────────────────────────────────
  community: router({
    getGroups: protectedProcedure
      .input(z.object({ city: z.string().optional() }))
      .query(async ({ input }) => {
        return getCommunityGroups(input.city);
      }),

    createGroup: protectedProcedure
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
        category: z.enum(["book_club","hiking","cooking","sports","arts","music","gaming","travel","fitness","social","other"]),
        city: z.string().optional(),
        maxMembers: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const group = await createCommunityGroup({ ...input, createdByUserId: ctx.user.id });
        if (group) await joinCommunityGroup(group.id, ctx.user.id);
        return group;
      }),

    joinGroup: protectedProcedure
      .input(z.object({ groupId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await joinCommunityGroup(input.groupId, ctx.user.id);
        return { success: true };
      }),

    getMembers: protectedProcedure
      .input(z.object({ groupId: z.number() }))
      .query(async ({ input }) => {
        return getGroupMembers(input.groupId);
      }),
  }),

  // ─── Marketplace (ticket booking) ─────────────────────────────────────────
  marketplace: router({
    categoryCounts: publicProcedure
      .input(z.object({ city: z.string().trim().min(1).max(120).optional() }))
      .query(async ({ input }) => getActivityMarketplaceCategoryCounts(input.city)),

    browse: publicProcedure
      .input(z.object({ category: z.string().optional(), city: z.string().trim().min(1).max(120).optional(), ticketsOnly: z.boolean().optional() }))
      .query(async ({ input }) => {
        const listings = await getActivityListings(input.city, input.category);
        const enriched = await Promise.all(
          listings.map(async (l) => {
            const venue = await getVenueById(l.venueId);
            return { ...l, venue };
          })
        );
        return input.ticketsOnly ? enriched.filter(l => l.hasTickets) : enriched;
      }),

    getListing: protectedProcedure
      .input(z.object({ activityId: z.number() }))
      .query(async ({ input }) => {
        const listing = await getActivityById(input.activityId);
        if (!listing) return null;
        const venue = await getVenueById(listing.venueId);
        return { ...listing, venue };
      }),

    book: protectedProcedure
      .input(z.object({
        activityId: z.number(),
        partySize: z.number().min(1).max(20),
        matchId: z.number().optional(),
        scheduledFor: z.string().optional(),
        notes: z.string().max(500).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const listing = await getActivityById(input.activityId);
        if (!listing) throw new Error("Activity not found");
        const venue = await getVenueById(listing.venueId);

        // Users are ALWAYS FREE. priceCents is what the venue charges; we track
        // commission + referral as what the VENDOR owes the platform.
        const unit = listing.priceCents ?? 0;
        const total = unit * input.partySize;
        const commissionPct = venue?.commissionPct ?? 12;
        const commission = Math.round((total * commissionPct) / 100);
        const referralFee = (venue?.referralFeePerVisit ?? 100) * input.partySize;
        const bookingType = listing.hasTickets ? "ticket" : (unit > 0 ? "reservation" : "rsvp_free");

        const booking = await createBooking({
          userId: ctx.user.id,
          activityId: listing.id,
          venueId: listing.venueId,
          matchId: input.matchId,
          partySize: input.partySize,
          unitPriceCents: unit,
          totalPriceCents: total,
          commissionCents: commission,
          referralFeeCents: referralFee,
          bookingType,
          confirmationCode: genCode("JP"),
          scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : undefined,
          notes: input.notes,
        });
        await recordReferralVisit(listing.id);
        await createNotification(
          ctx.user.id, "new_match", "Booking confirmed! 🎟️",
          `You're all set for ${listing.title}. Show up and have fun!`, booking?.id
        );
        return booking;
      }),

    createCheckout: protectedProcedure
      .input(z.object({
        activityId: z.number(),
        partySize: z.number().min(1).max(20),
        scheduledFor: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await createMarketplaceCheckoutSession(ctx.user, input, ctx.req);
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "Unable to start secure checkout.",
          });
        }
      }),

    getPaymentConfirmation: protectedProcedure
      .input(z.object({ sessionId: z.string().min(10).max(255) }))
      .query(async ({ ctx, input }) => {
        try {
          return await getMarketplacePaymentConfirmation(ctx.user.id, input.sessionId);
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "Unable to retrieve payment confirmation.",
          });
        }
      }),

    myBookings: protectedProcedure.query(async ({ ctx }) => {
      const myBookings = await getBookingsForUser(ctx.user.id);
      return Promise.all(myBookings.map(async (b) => {
        const activity = await getActivityById(b.activityId);
        const venue = await getVenueById(b.venueId);
        return { ...b, activity, venue };
      }));
    }),

    cancel: protectedProcedure
      .input(z.object({ bookingId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await cancelBooking(input.bookingId, ctx.user.id);
        return { success: true };
      }),

    requestReschedule: protectedProcedure
      .input(z.object({
        bookingId: z.number(),
        requestedFor: z.date(),
        note: z.string().trim().max(400).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const booking = await getBookingById(input.bookingId);
        if (!booking || booking.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        const error = getRescheduleRequestError(booking.status, input.requestedFor);
        if (error) throw new TRPCError({ code: "BAD_REQUEST", message: error });
        await requestBookingReschedule(input.bookingId, ctx.user.id, input.requestedFor, input.note);
        return { success: true };
      }),

    checkInBooking: protectedProcedure
      .input(z.object({ bookingId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const booking = await getBookingById(input.bookingId);
        if (!booking || booking.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        const activity = await getActivityById(booking.activityId);
        const error = getBookingCheckInError(booking.status, booking.scheduledFor ?? activity?.eventDate);
        if (error) throw new TRPCError({ code: "BAD_REQUEST", message: error });
        await checkInBooking(input.bookingId, ctx.user.id);
        return { success: true };
      }),
  }),

  // ─── Sally Date Concierge ─────────────────────────────────────────────────
  concierge: router({
    plan: protectedProcedure
      .input(z.object({
        occasion: z.string().max(120),
        vibe: z.string().max(200),
        location: z.string().max(200),
        budgetDollars: z.number().min(0).max(2000),
        partySize: z.number().min(1).max(20),
        preferredDate: z.string().optional(),
        dietaryNotes: z.string().max(300).optional(),
        matchId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const profile = await getProfileByUserId(ctx.user.id);
        const budgetCents = Math.round(input.budgetDollars * 100);
        const venues = await getVenuePartners(profile?.city ?? undefined);

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are Sally, the warm AI date concierge for Just Putzit. You design delightful, realistic real-world outings (picnics, park dates, food deliveries to a location, fun activities). You arrange everything: Sally contacts local vendors and coordinates food/supplies delivery to the spot. Keep it warm, specific, and doable within budget. Users never pay Just Putzit — local vendors do.`,
            },
            {
              role: "user",
              content: `Plan a ${input.occasion}. Vibe: ${input.vibe}. Location/area: ${input.location}. Budget: $${input.budgetDollars} for ${input.partySize} people. Preferred date: ${input.preferredDate ?? "flexible"}. Dietary notes: ${input.dietaryNotes ?? "none"}. User profile: ${JSON.stringify(profile?.traits ?? {})}. Nearby partner venues (optional to use): ${JSON.stringify(venues.slice(0, 8).map(v => ({ name: v.name, category: v.category })))}.\n\nReturn JSON: { title: string, summary: string (2-3 warm sentences from Sally), items: [{ label, detail, estCostCents, vendorName }] (3-5 items), estTotalCents: number }. Keep estTotalCents within budget.`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "concierge_plan",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  summary: { type: "string" },
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        label: { type: "string" },
                        detail: { type: "string" },
                        estCostCents: { type: "number" },
                        vendorName: { type: "string" },
                      },
                      required: ["label", "detail", "estCostCents", "vendorName"],
                      additionalProperties: false,
                    },
                  },
                  estTotalCents: { type: "number" },
                },
                required: ["title", "summary", "items", "estTotalCents"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices[0]?.message?.content;
        const parsed = JSON.parse(typeof content === "string" ? content : "{}");
        const items: ConciergePlanItem[] = parsed.items ?? [];

        const reqRow = await createConciergeRequest({
          userId: ctx.user.id,
          matchId: input.matchId,
          occasion: input.occasion,
          vibe: input.vibe,
          location: input.location,
          budgetCents,
          partySize: input.partySize,
          preferredDate: input.preferredDate ? new Date(input.preferredDate) : undefined,
          dietaryNotes: input.dietaryNotes,
          sallyPlanTitle: parsed.title ?? "Your Sally-planned outing",
          sallyPlanSummary: parsed.summary ?? "",
          sallyPlanItems: items,
          estTotalCents: parsed.estTotalCents ?? 0,
          status: "proposed",
        });
        return reqRow;
      }),

    confirm: protectedProcedure
      .input(z.object({ requestId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const reqRow = await getConciergeRequestById(input.requestId);
        if (!reqRow || reqRow.userId !== ctx.user.id) throw new Error("Not found");
        await updateConciergeRequest(input.requestId, { status: "arranged" });
        await createNotification(
          ctx.user.id, "new_match", "Sally is on it! 🌟",
          `I'm arranging "${reqRow.sallyPlanTitle}" and coordinating with local vendors. I'll confirm details soon!`, reqRow.id
        );
        return { success: true };
      }),

    myRequests: protectedProcedure.query(async ({ ctx }) => {
      return getConciergeRequestsForUser(ctx.user.id);
    }),
  }),

  // ─── Vendor Partner Portal ────────────────────────────────────────────────
  vendor: router({
    impactResults: protectedProcedure.query(async ({ ctx }) => getPartnerImpactForOwner(ctx.user.id)),
    sponsoredPerformance: protectedProcedure.query(async ({ ctx }) => getSponsoredPlacementPerformanceForOwner(ctx.user.id)),
    sponsoredAudience: protectedProcedure.query(async ({ ctx }) => getSponsoredAudienceSummaryForOwner(ctx.user.id)),
    trackSponsoredMetric: protectedProcedure
      .input(z.object({ activityId: z.number().int().positive(), eventType: z.enum(["view", "click"]) }))
      .mutation(async ({ ctx, input }) => {
        await recordSponsoredPlacementMetric({ activityId: input.activityId, userId: ctx.user.id, eventType: input.eventType });
        return { success: true };
      }),
    trend: protectedProcedure
      .input(z.object({ start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
      .query(async ({ ctx, input }) => {
        const start = parsePartnerTrendDate(input.start);
        const end = parsePartnerTrendDate(input.end);
        const error = getPartnerTrendRangeError(start, end);
        if (error) throw new TRPCError({ code: "BAD_REQUEST", message: error });
        return getPartnerImpactTrendForOwner(ctx.user.id, start, end);
      }),
    myVenues: protectedProcedure.query(async ({ ctx }) => {
      const venues = await getVenuesByOwner(ctx.user.id);
      return Promise.all(venues.map(async (v) => {
        const listings = await getListingsByVenue(v.id);
        const venueBookings = await getBookingsForVenue(v.id);
        const totalReferrals = listings.reduce((s, l) => s + (l.totalReferrals ?? 0), 0);
        const referralRevenueCents = venueBookings.reduce((s, b) => s + (b.referralFeeCents ?? 0), 0);
        const commissionPaidCents = venueBookings.reduce((s, b) => s + (b.commissionCents ?? 0), 0);
        return { ...v, listings, bookingCount: venueBookings.length, totalReferrals, referralRevenueCents, commissionPaidCents };
      }));
    }),

    registerVenue: protectedProcedure
      .input(z.object({
        name: z.string().min(2).max(200),
        category: z.enum(ACTIVITY_CATEGORY_VALUES),
        description: z.string().max(1000).optional(),
        address: z.string().max(300).optional(),
        city: z.string().max(100).optional(),
        phone: z.string().max(30).optional(),
        website: z.string().max(300).optional(),
        contactEmail: z.string().max(320).optional(),
        referralFeePerVisit: z.number().min(0).max(5000),
        isPublicAccess: z.boolean().optional(),
        accessNotes: z.string().max(300).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return createVenuePartner({ ...input, ownerUserId: ctx.user.id });
      }),

    addListing: protectedProcedure
      .input(z.object({
        venueId: z.number(),
        title: z.string().min(2).max(200),
        description: z.string().max(1000).optional(),
        category: z.enum(ACTIVITY_CATEGORY_VALUES),
        priceDollars: z.number().min(0).max(2000),
        hasTickets: z.boolean(),
        imageEmoji: z.string().max(10).optional(),
        maxGroupSize: z.number().min(1).max(100).optional(),
        recurringSchedule: z.string().max(100).optional(),
        isPublicAccess: z.boolean().optional(),
        accessNotes: z.string().max(300).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const venue = await getVenueById(input.venueId);
        if (!venue || venue.ownerUserId !== ctx.user.id) throw new Error("You do not own this venue");
        return createActivityListing({
          venueId: input.venueId,
          title: input.title,
          description: input.description,
          category: input.category,
          priceCents: Math.round(input.priceDollars * 100),
          hasTickets: input.hasTickets,
          imageEmoji: input.imageEmoji || "🎉",
          maxGroupSize: input.maxGroupSize,
          recurringSchedule: input.recurringSchedule,
          isPublicAccess: input.isPublicAccess ?? false,
          accessNotes: input.accessNotes,
          isRecurring: !!input.recurringSchedule,
        });
      }),

    startSponsoredPlacementCheckout: protectedProcedure
      .input(z.object({
        activityId: z.number().int().positive(),
        packageCode: z.enum(["week", "month"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const eligible = await getSponsoredPlacementEligibleListing(input.activityId, ctx.user.id);
        if (!eligible) throw new TRPCError({ code: "FORBIDDEN", message: "You can only promote activities owned by your business." });
        const policyError = getSponsoredPlacementEligibility({
          listingIsActive: eligible.listing.isActive,
          listingIsPublicAccess: eligible.listing.isPublicAccess,
          venueIsPublicAccess: eligible.venue.isPublicAccess,
        });
        if (policyError) throw new TRPCError({ code: "BAD_REQUEST", message: policyError });
        const existing = await getSponsoredPlacementsForActivities([eligible.listing.id]);
        if (existing.some((placement) => placement.status === "active" && placement.endsAt && placement.endsAt > new Date())) {
          throw new TRPCError({ code: "CONFLICT", message: "This activity already has an active sponsored placement." });
        }
        const packageDetails = getSponsoredPlacementPackage(input.packageCode as SponsoredPlacementPackage);
        const placement = await createSponsoredPlacement({
          activityId: eligible.listing.id,
          venueId: eligible.venue.id,
          purchaserUserId: ctx.user.id,
          packageCode: input.packageCode,
          amountCents: packageDetails.amountCents,
        });
        if (!placement) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to prepare the sponsored placement." });
        return createSponsoredPlacementCheckoutSession(ctx.user, {
          placementId: placement.id,
          activityTitle: eligible.listing.title,
          packageCode: input.packageCode,
        }, ctx.req);
      }),

    venueBookings: protectedProcedure
      .input(z.object({ venueId: z.number() }))
      .query(async ({ ctx, input }) => {
        const venue = await getVenueById(input.venueId);
        if (!venue || venue.ownerUserId !== ctx.user.id) throw new Error("Forbidden");
        return getBookingsForVenue(input.venueId);
      }),

    myListings: protectedProcedure.query(async ({ ctx }) => {
      return getListingsForOwner(ctx.user.id);
    }),
  }),

  // ─── Couples Network (couple-to-couple) ───────────────────────────────────
  couples: router({
    getMyCouple: protectedProcedure.query(async ({ ctx }) => {
      return getCoupleLinkForUser(ctx.user.id);
    }),

    saveCouple: protectedProcedure
      .input(z.object({
        partnerName: z.string().min(1).max(100),
        partnerEmail: z.string().max(320).optional(),
        relationshipLength: z.string().max(60).optional(),
        sharedInterests: z.array(z.string()).optional(),
        lookingFor: z.string().max(500).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await getOrCreateProfile(ctx.user.id);
        await updateProfile(ctx.user.id, { networkType: "couples" });
        return upsertCoupleLink(ctx.user.id, input);
      }),

    findCoupleMatches: protectedProcedure.mutation(async ({ ctx }) => {
      const mine = await getCoupleLinkForUser(ctx.user.id);
      if (!mine) throw new Error("Create your couple profile first");
      const all = await getAllCoupleLinks();
      const candidates = all.filter(c => c.userId !== ctx.user.id);
      const newMatches = [];
      for (const cand of candidates.slice(0, 5)) {
        const already = await existingCoupleMatch(ctx.user.id, cand.userId);
        if (already) continue;
        const result = await invokeLLM({
          messages: [
            { role: "system", content: "You are Sally, matching couples for couple-to-couple friendships and double dates on Just Putzit. Score compatibility for shared activities and vibe." },
            { role: "user", content: `Couple A: ${JSON.stringify({ interests: mine.sharedInterests, lookingFor: mine.lookingFor, relationshipLength: mine.relationshipLength })}\nCouple B: ${JSON.stringify({ interests: cand.sharedInterests, lookingFor: cand.lookingFor, relationshipLength: cand.relationshipLength })}\n\nReturn JSON: { score: number 0-100, reason: string (1-2 warm sentences) }` },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "couple_match", strict: true,
              schema: { type: "object", properties: { score: { type: "number" }, reason: { type: "string" } }, required: ["score", "reason"], additionalProperties: false },
            },
          },
        });
        const content = result.choices[0]?.message?.content;
        const parsed = JSON.parse(typeof content === "string" ? content : "{}");
        const score = Math.min(100, Math.max(0, Math.round(parsed.score ?? 70)));
        if (score >= 55) {
          const m = await createCoupleMatch(ctx.user.id, cand.userId, score, parsed.reason ?? "You two couples would have a blast together!");
          if (m) newMatches.push({ ...m, otherCouple: cand });
        }
      }
      return { matches: newMatches };
    }),

    getMyCoupleMatches: protectedProcedure.query(async ({ ctx }) => {
      const ms = await getCoupleMatchesForUser(ctx.user.id);
      return Promise.all(ms.map(async (m) => {
        const otherUserId = m.couple1UserId === ctx.user.id ? m.couple2UserId : m.couple1UserId;
        const otherCouple = await getCoupleLinkForUser(otherUserId);
        const otherProfile = await getProfileByUserId(otherUserId);
        return { ...m, otherCouple, otherProfile, otherUserId };
      }));
    }),
  }),

  // ─── Would You Rather (low AI cost: questions pre-written in DB) ───────────
  wyr: router({
    // Returns a shuffled batch of questions the user hasn't answered yet.
    getBatch: protectedProcedure
      .input(z.object({ category: z.string().optional(), limit: z.number().min(1).max(30).optional() }))
      .query(async ({ ctx, input }) => {
        const all = await getWyrQuestions(input.category ?? "all");
        const answered = new Set(await getWyrAnsweredQuestionIds(ctx.user.id));
        const unanswered = all.filter((q) => !answered.has(q.id));
        // Shuffle (Fisher-Yates) so order varies each session.
        for (let i = unanswered.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [unanswered[i], unanswered[j]] = [unanswered[j], unanswered[i]];
        }
        const limit = input.limit ?? 10;
        return {
          questions: unanswered.slice(0, limit),
          totalAnswered: answered.size,
          totalAvailable: all.length,
        };
      }),

    // Records the answer and returns the honest crowd split for that question.
    // Sally may retain only direct preference phrases from the selected option.
    answer: protectedProcedure
      .input(z.object({ questionId: z.number(), choice: z.enum(["A", "B"]) }))
      .mutation(async ({ ctx, input }) => {
        await recordWyrAnswer(ctx.user.id, input.questionId, input.choice);
        const split = await getWyrSplit(input.questionId);
        const total = split.a + split.b;
        let profileInsight: { updated: boolean; learnedTraits: string[] } = { updated: false, learnedTraits: [] };
        const question = await getWyrQuestionById(input.questionId);
        if (question) {
          const chosenText = input.choice === "A" ? question.optionA : question.optionB;
          const traits = await extractTraitsFromGameplay({
            gameType: "wyr",
            questionText: `Would you rather: "${question.optionA}" OR "${question.optionB}"`,
            chosenOptionText: chosenText,
          });
          const directPreferences = getWyrDirectPreferenceInsights(traits);
          profileInsight = await mergeGameTraitsIntoProfile(ctx.user.id, {
            ...traits,
            ...(directPreferences.length > 0 ? { wyrInsights: directPreferences } : {}),
          });
        }
        return {
          yourChoice: input.choice,
          countA: split.a,
          countB: split.b,
          percentA: total === 0 ? 0 : Math.round((split.a / total) * 100),
          percentB: total === 0 ? 0 : Math.round((split.b / total) * 100),
          totalVotes: total,
          profileUpdated: profileInsight.updated,
          learnedTraits: profileInsight.learnedTraits,
        };
      }),

    stats: protectedProcedure.query(async ({ ctx }) => {
      const count = await getWyrAnswerCount(ctx.user.id);
      return { answered: count };
    }),

    // ── 2-player challenge flow ──────────────────────────────────────────────
    // Send a challenge to a match (picks 10 random questions from the pool)
    sendChallenge: protectedProcedure
      .input(z.object({ challengedId: z.number(), matchId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const match = await getMatchById(input.matchId);
        const isMatchParticipant = match && (match.user1Id === ctx.user.id || match.user2Id === ctx.user.id);
        const otherMemberId = match?.user1Id === ctx.user.id ? match.user2Id : match?.user2Id === ctx.user.id ? match.user1Id : null;
        if (!isMatchParticipant || otherMemberId !== input.challengedId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Challenges can only be sent to an existing match." });
        }
        const all = await getWyrQuestions("all");
        // Pick 10 random questions
        const shuffled = [...all].sort(() => Math.random() - 0.5).slice(0, 10);
        const qids = shuffled.map((q) => q.id);
        const challenge = await createWyrChallenge(ctx.user.id, input.challengedId, qids, input.matchId);
        return { challenge, questions: shuffled };
      }),

    // Get a specific challenge (for the challenged user to see and answer)
    getChallenge: protectedProcedure
      .input(z.object({ challengeId: z.number() }))
      .query(async ({ ctx, input }) => {
        const challenge = await getWyrChallenge(input.challengeId);
        if (!challenge) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Challenge not found." });
        }
        if (challenge.challengerId !== ctx.user.id && challenge.challengedId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only challenge participants can view this invitation." });
        }
        // Fetch the questions for this challenge
        const allQ = await getWyrQuestions("all");
        const qMap = new Map(allQ.map((q) => [q.id, q]));
        const questions = (challenge.questionIds as number[]).map((id) => qMap.get(id)).filter(Boolean);
        const progress = await getWyrChallengeAnswerProgress(
          challenge.challengerId,
          challenge.challengedId,
          challenge.questionIds as number[],
        );
        const isChallenger = challenge.challengerId === ctx.user.id;
        const myAnsweredQuestionIds = isChallenger
          ? progress.challengerAnsweredQuestionIds
          : progress.challengedAnsweredQuestionIds;
        const partnerAnsweredQuestionIds = isChallenger
          ? progress.challengedAnsweredQuestionIds
          : progress.challengerAnsweredQuestionIds;
        const displayStatus = challenge.status === "completed"
          ? "completed"
          : myAnsweredQuestionIds.length > 0 || partnerAnsweredQuestionIds.length > 0
            ? "active"
            : "pending";
        return {
          challenge,
          questions,
          myAnsweredQuestionIds,
          myAnsweredCount: myAnsweredQuestionIds.length,
          partnerAnsweredCount: partnerAnsweredQuestionIds.length,
          displayStatus,
          canReveal: myAnsweredQuestionIds.length === questions.length && partnerAnsweredQuestionIds.length === questions.length,
        };
      }),

    // List all challenges for the current user
    myChallenges: protectedProcedure.query(async ({ ctx }) => {
      return getWyrChallengesForUser(ctx.user.id);
    }),

    // After both users have answered, compute and store compatibility %
    computeCompatibility: protectedProcedure
      .input(z.object({ challengeId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const challenge = await getWyrChallenge(input.challengeId);
        if (!challenge) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Challenge not found." });
        }
        if (challenge.challengerId !== ctx.user.id && challenge.challengedId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only challenge participants can reveal compatibility." });
        }
        const questionIds = challenge.questionIds as number[];
        const progress = await getWyrChallengeAnswerProgress(
          challenge.challengerId,
          challenge.challengedId,
          questionIds,
        );
        if (
          questionIds.length === 0 ||
          progress.challengerAnsweredQuestionIds.length !== questionIds.length ||
          progress.challengedAnsweredQuestionIds.length !== questionIds.length
        ) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Compatibility unlocks after both members answer every shared question.",
          });
        }
        const pct = await computeWyrCompatibility(
          challenge.challengerId,
          challenge.challengedId,
          questionIds
        );
        await updateWyrChallengeStatus(challenge.id, "completed", pct);
        return { compatibilityPct: pct };
      }),
  }),

  // ─── Campus Growth Engine ──────────────────────────────────────────────────
  campus: router({
    // Get stats for a campus by ID (used on the waitlist page)
    getStats: publicProcedure
      .input(z.object({ campusId: z.number() }))
      .query(async ({ input }) => {
        return getCampusStats(input.campusId);
      }),

    // Get stats by slug (e.g. "carroll-university")
    getStatsBySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        const campus = await getCampusBySlug(input.slug);
        if (!campus) throw new Error("Campus not found");
        return getCampusStats(campus.id);
      }),

    // Get the leaderboard of top inviters for a campus
    getLeaderboard: publicProcedure
      .input(z.object({ campusId: z.number(), limit: z.number().min(1).max(50).optional() }))
      .query(async ({ input }) => {
        return getCampusLeaderboard(input.campusId, input.limit ?? 10);
      }),

    // Generate (or retrieve) the current user's personal invite code
    getMyInviteCode: protectedProcedure.mutation(async ({ ctx }) => {
      const code = await generateInviteCode(ctx.user.id);
      const baseUrl = process.env.VITE_SITE_URL ?? "https://putzitapp-6zuussay.manus.space";
      return {
        code,
        inviteUrl: `${baseUrl}/join?ref=${code}`,
      };
    }),

    // Record that a new user joined via an invite code
    useInviteCode: protectedProcedure
      .input(z.object({ code: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const result = await recordReferral(input.code, ctx.user.id);
        return { success: !!result };
      }),

    // ── Self-serve campus dating pool ──────────────────────────────────────
    // List all campuses with member counts and whether the current user has joined
    listAll: protectedProcedure.query(async ({ ctx }) => {
      const all = await getAllCampuses();
      const myCampuses = await getUserCampuses(ctx.user.id);
      const mySet = new Set(myCampuses.map((m) => m.campusId));
      return Promise.all(
        all.map(async (c) => ({
          ...c,
          memberCount: await getCampusMemberCount(c.id),
          isMember: mySet.has(c.id),
        }))
      );
    }),

    // Join a campus dating pool
    join: protectedProcedure
      .input(z.object({ campusId: z.number(), verifiedEmail: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const result = await joinCampus(ctx.user.id, input.campusId, input.verifiedEmail);
        return { success: !!result };
      }),

    // Leave a campus dating pool
    leave: protectedProcedure
      .input(z.object({ campusId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await leaveCampus(ctx.user.id, input.campusId);
        return { success: true };
      }),

    // Browse members in a campus dating pool
    browseMembers: protectedProcedure
      .input(z.object({ campusId: z.number() }))
      .query(async ({ ctx, input }) => {
        return getCampusMemberProfiles(input.campusId, ctx.user.id);
      }),

    // Get campuses the current user has joined
    myCampuses: protectedProcedure.query(async ({ ctx }) => {
      const myCampuses = await getUserCampuses(ctx.user.id);
      const all = await getAllCampuses();
      return myCampuses.map((m) => ({
        ...m,
        campus: all.find((c) => c.id === m.campusId),
      }));
    }),
  }),

  // ─── Notifications ────────────────────────────────────────────────────────
  notifications: router({
    getAll: protectedProcedure.query(async ({ ctx }) => {
      return getNotificationsForUser(ctx.user.id);
    }),

    markRead: protectedProcedure
      .input(z.object({ notifId: z.number() }))
      .mutation(async ({ input }) => {
        await markNotificationRead(input.notifId);
        return { success: true };
      }),

    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      await markAllNotificationsRead(ctx.user.id);
      return { success: true };
    }),
  }),

  // ─── Login Ads ────────────────────────────────────────────────────────────────
  loginAds: router({
    getActive: publicProcedure.query(async () => {
      return getActiveLoginAd();
    }),

    recordImpression: publicProcedure
      .input(z.object({ adId: z.number().int() }))
      .mutation(async ({ input }) => {
        await recordAdImpression(input.adId);
        return { success: true };
      }),

    create: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1).max(255),
          videoUrl: z.string().url(),
          ctaText: z.string().max(128).optional(),
          ctaUrl: z.string().url().optional(),
          durationSeconds: z.number().int().min(5).max(30).default(10),
          budgetCents: z.number().int().min(0).default(0),
          cpmCents: z.number().int().min(1).default(5),
          startsAt: z.string().optional(),
          endsAt: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Vendor must have a registered venue
        const venues = await getVenuesByOwner(ctx.user.id);
        if (venues.length === 0) throw new TRPCError({ code: "FORBIDDEN", message: "Register as a vendor first" });
        await createLoginAd({
          ...input,
          vendorId: venues[0].id,
          startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
          endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
        });
        return { success: true };
      }),

    myAds: protectedProcedure.query(async ({ ctx }) => {
      const venues = await getVenuesByOwner(ctx.user.id);
      if (venues.length === 0) return [];
      return getLoginAdsForVendor(venues[0].id);
    }),

    toggleActive: protectedProcedure
      .input(z.object({ adId: z.number().int(), isActive: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const venues = await getVenuesByOwner(ctx.user.id);
        if (venues.length === 0) throw new TRPCError({ code: "FORBIDDEN" });
        await updateLoginAdStatus(input.adId, input.isActive);
        return { success: true };
      }),
  }),

  // ─── WebAuthn Passkeys ────────────────────────────────────────────────────────────────
  passkey: router({
    registrationOptions: protectedProcedure.query(async ({ ctx }) => {
      const { generateRegistrationOptions } = await import("@simplewebauthn/server");
      const existingPasskeys = await getPasskeysForUser(ctx.user.id);
      const options = await generateRegistrationOptions({
        rpName: "Just Putzit",
        rpID: process.env.WEBAUTHN_RP_ID ?? "localhost",
        userName: ctx.user.email ?? ctx.user.name ?? String(ctx.user.id),
        userDisplayName: ctx.user.name ?? "Just Putzit User",
        attestationType: "none",
        excludeCredentials: existingPasskeys.map((pk) => ({
          id: pk.credentialId,
          transports: pk.transports ? (JSON.parse(pk.transports) as AuthenticatorTransport[]) : undefined,
        })),
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred",
        },
      });
      const { storeWebAuthnChallenge } = await import("./db");
      await storeWebAuthnChallenge(ctx.user.id, "registration", options.challenge);
      return options;
    }),

    verifyRegistration: protectedProcedure
      .input(z.object({ response: z.any() }))
      .mutation(async ({ ctx, input }) => {
        const { verifyRegistrationResponse } = await import("@simplewebauthn/server");
        const { consumeWebAuthnChallenge } = await import("./db");
        const expectedChallenge = await consumeWebAuthnChallenge(ctx.user.id, "registration");
        if (!expectedChallenge) throw new TRPCError({ code: "BAD_REQUEST", message: "No challenge found. Start registration again." });
        const verification = await verifyRegistrationResponse({
          response: input.response,
          expectedChallenge,
          expectedOrigin: process.env.WEBAUTHN_ORIGIN ?? `https://${process.env.WEBAUTHN_RP_ID ?? "localhost"}`,
          expectedRPID: process.env.WEBAUTHN_RP_ID ?? "localhost",
        });
        if (!verification.verified || !verification.registrationInfo) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Biometric registration failed" });
        }
        const { credential, credentialDeviceType, aaguid } = verification.registrationInfo;
        await savePasskeyCredential({
          userId: ctx.user.id,
          credentialId: credential.id,
          publicKey: Buffer.from(credential.publicKey).toString("base64"),
          counter: credential.counter,
          deviceType: credentialDeviceType,
          transports: JSON.stringify(credential.transports ?? []),
          aaguid,
        });
        return { verified: true };
      }),

    authOptions: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .query(async ({ input }) => {
        const { generateAuthenticationOptions } = await import("@simplewebauthn/server");
        const { getUserByEmail } = await import("./db");
        const user = await getUserByEmail(input.email);
        if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        const passkeys = await getPasskeysForUser(user.id);
        if (passkeys.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "No passkey registered" });
        const options = await generateAuthenticationOptions({
          rpID: process.env.WEBAUTHN_RP_ID ?? "localhost",
          allowCredentials: passkeys.map((pk) => ({
            id: pk.credentialId,
            transports: pk.transports ? (JSON.parse(pk.transports) as AuthenticatorTransport[]) : undefined,
          })),
          userVerification: "preferred",
        });
        const { storeWebAuthnChallenge } = await import("./db");
        await storeWebAuthnChallenge(user.id, "authentication", options.challenge);
        return { options, userId: user.id };
      }),

    verifyAuth: publicProcedure
      .input(z.object({ userId: z.number().int(), response: z.any() }))
      .mutation(async ({ input }) => {
        const { verifyAuthenticationResponse } = await import("@simplewebauthn/server");
        const { consumeWebAuthnChallenge } = await import("./db");
        const expectedChallenge = await consumeWebAuthnChallenge(input.userId, "authentication");
        if (!expectedChallenge) throw new TRPCError({ code: "BAD_REQUEST", message: "Challenge expired. Try again." });
        const passkey = await getPasskeyByCredentialId(input.response.id);
        if (!passkey || passkey.userId !== input.userId) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Passkey not found" });
        }
        const verification = await verifyAuthenticationResponse({
          response: input.response,
          expectedChallenge,
          expectedOrigin: process.env.WEBAUTHN_ORIGIN ?? `https://${process.env.WEBAUTHN_RP_ID ?? "localhost"}`,
          expectedRPID: process.env.WEBAUTHN_RP_ID ?? "localhost",
          credential: {
            id: passkey.credentialId,
            publicKey: Buffer.from(passkey.publicKey, "base64"),
            counter: passkey.counter,
            transports: passkey.transports ? (JSON.parse(passkey.transports) as AuthenticatorTransport[]) : undefined,
          },
        });
        if (!verification.verified) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Biometric verification failed" });
        }
        await updatePasskeyCounter(passkey.credentialId, verification.authenticationInfo.newCounter);
        // Passkey proves identity; hand back a one-time Supabase token so the client can open a normal session.
        const user = await getUserById(input.userId);
        if (!user) throw new TRPCError({ code: "NOT_FOUND" });
        if (!user.email) throw new TRPCError({ code: "BAD_REQUEST", message: "This account has no email to sign in with" });
        const { data: link, error: linkError } = await getSupabaseAdmin().auth.admin.generateLink({ type: "magiclink", email: user.email });
        const tokenHash = link?.properties?.hashed_token;
        if (linkError || !tokenHash) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not start a session" });
        return { success: true, tokenHash, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
      }),

    myPasskeys: protectedProcedure.query(async ({ ctx }) => {
      const passkeys = await getPasskeysForUser(ctx.user.id);
      return passkeys.map((pk) => ({ id: pk.id, deviceType: pk.deviceType, createdAt: pk.createdAt, lastUsedAt: pk.lastUsedAt }));
    }),
    markVerified: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { users } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.update(users).set({ passkeyVerified: true }).where(eq(users.id, ctx.user.id));
      return { success: true };
    }),
    verificationStatus: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { users } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const [user] = await db.select({ passkeyVerified: users.passkeyVerified }).from(users).where(eq(users.id, ctx.user.id));
      const profile = await getProfileByUserId(ctx.user.id);
      return {
        passkeyVerified: user?.passkeyVerified ?? false,
        gpsPhotoVerified: profile?.locationVerified ?? false,
      };
    }),

    remove: protectedProcedure
      .input(z.object({ passkeyId: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        await deletePasskey(input.passkeyId, ctx.user.id);
        return { success: true };
      }),
  }),

  // ─── Community Events ────────────────────────────────────────────────────────
  events: router({
    list: publicProcedure
      .input(
        z.object({
          city: z.string().optional(),
          category: z.string().optional(),
          isFree: z.boolean().optional(),
          limit: z.number().int().min(1).max(200).optional(),
          lat: z.number().optional(),
          lng: z.number().optional(),
          radiusMiles: z.number().optional(),
        })
      )
      .query(async ({ input }) => {
        return getCommunityEvents(input);
      }),

    create: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1).max(255),
          description: z.string().optional(),
          category: z.enum(["music", "food", "market", "sports", "arts", "community", "outdoors", "other"]),
          eventDate: z.string(), // ISO string
          endDate: z.string().optional(),
          venueName: z.string().optional(),
          address: z.string().optional(),
          city: z.string().min(1),
          state: z.string().default("WI"),
          isFree: z.boolean().default(true),
          priceCents: z.number().int().min(0).default(0),
          externalUrl: z.string().url().optional(),
          imageUrl: z.string().url().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Admins post as admin; regular users post as community
        const source = ctx.user.role === "admin" ? "admin" : "community";
        await createCommunityEvent({
          ...input,
          eventDate: new Date(input.eventDate),
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          source,
          postedByUserId: ctx.user.id,
          isActive: true,
        });
        return { success: true };
      }),

    rsvp: protectedProcedure
      .input(z.object({ eventId: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        return rsvpToEvent(input.eventId, ctx.user.id);
      }),

    setIntroductionOptIn: protectedProcedure
      .input(z.object({ eventId: z.number().int(), openToSallyIntroduction: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        return setEventIntroductionOptIn(input.eventId, ctx.user.id, input.openToSallyIntroduction);
      }),

    requestSallyIntroduction: protectedProcedure
      .input(z.object({ eventId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        return createMutualEventIntroduction(input.eventId, ctx.user.id);
      }),

    myRsvps: protectedProcedure.query(async ({ ctx }) => {
      return getUserEventRsvps(ctx.user.id);
    }),

    getEventbrite: publicProcedure
      .input(z.object({
        city: z.string().default("Milwaukee"),
        lat: z.number().optional(),
        lng: z.number().optional(),
        radiusMiles: z.number().min(1).max(100).optional(),
      }))
      .query(async ({ input }) => {
        const token = process.env.EVENTBRITE_TOKEN ?? "";
        if (!token) return [];
        return getEventbriteEvents(input.city, token, {
          lat: input.lat,
          lng: input.lng,
          radiusMiles: input.radiusMiles,
        });
      }),

    toggleSponsored: protectedProcedure
      .input(z.object({ eventId: z.number().int(), isSponsored: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        await toggleSponsoredEvent(input.eventId, input.isSponsored);
        return { success: true };
      }),

    setThirdWheelHost: protectedProcedure
      .input(z.object({ eventId: z.number().int(), hasThirdWheelHost: z.boolean(), thirdWheelHostNote: z.string().max(280).optional() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        await setThirdWheelHostForEvent(input.eventId, input.hasThirdWheelHost, input.thirdWheelHostNote);
        return { success: true };
      }),

    sourceHealth: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return getEventSourceHealth();
    }),

    markInterest: protectedProcedure
      .input(z.object({ eventId: z.number().int(), status: z.enum(["interested", "going", "attended"]).default("interested") }))
      .mutation(async ({ ctx, input }) => {
        return markEventInterest(ctx.user.id, input.eventId, input.status);
      }),

    removeInterest: protectedProcedure
      .input(z.object({ eventId: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        return removeEventInterest(ctx.user.id, input.eventId);
      }),

    getInterested: publicProcedure
      .input(z.object({ eventId: z.number().int() }))
      .query(async ({ input }) => {
        const interests = await getEventInterests(input.eventId);
        const count = await getInterestedCount(input.eventId);
        return { interests, count };
      }),

    myInterests: protectedProcedure.query(async ({ ctx }) => {
      return getUserEventInterests(ctx.user.id);
    }),

    matchesInterestedInSameEvent: protectedProcedure
      .input(z.object({ eventId: z.number().int() }))
      .query(async ({ ctx, input }) => {
        return getMatchesInterestedInSameEvents(ctx.user.id, input.eventId);
      }),
  }),

  // ─── Activities (sponsored) ────────────────────────────────────────────────
  activities: router({
    toggleSponsored: protectedProcedure
      .input(z.object({ activityId: z.number().int(), isSponsored: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        await toggleSponsoredActivity(input.activityId, input.isSponsored);
        return { success: true };
      }),
  }),

  // ─── Revenue Summary ───────────────────────────────────────────────────────
  revenue: router({
    summary: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return getRevenueSummary();
    }),
    entertainmentSummary: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return getEntertainmentRevenueSummary();
    }),
  }),

  // ── Entertainment Hub ──────────────────────────────────────────────────────
  entertainment: router({
    trackMovieClick: publicProcedure
      .input(z.object({
        movieId: z.string(),
        movieTitle: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const profile = ctx.user ? await getUserWithProfile(ctx.user.id) : null;
        await recordMovieBookingClick({
          userId: ctx.user?.id,
          movieId: input.movieId,
          movieTitle: input.movieTitle,
          userCity: profile?.profile?.city ?? undefined,
        });
        return { ok: true };
      }),

    trackEntertainmentClick: publicProcedure
      .input(z.object({
        category: z.enum(["concert", "theme_park", "adventure", "sports", "comedy", "other"]),
        eventId: z.string(),
        eventTitle: z.string(),
        venueName: z.string().optional(),
        venueCity: z.string().optional(),
        affiliateNetwork: z.string(),
        affiliateUrl: z.string(),
        estimatedCommissionCents: z.number().optional(),
        estimatedCommissionPct: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const profile = ctx.user ? await getUserWithProfile(ctx.user.id) : null;
        await recordEntertainmentClick({
          ...input,
          userId: ctx.user?.id,
          userCity: profile?.profile?.city ?? undefined,
        });
        return { ok: true };
      }),
  }),

  invites: router({
    send: protectedProcedure
      .input(z.array(z.object({
        contactName: z.string().min(1),
        contactPhone: z.string().optional(),
        contactEmail: z.string().email().optional(),
      })))
      .mutation(async ({ ctx, input }) => {
        const results = [];
        for (const contact of input) {
          const { inviteCode } = await createFriendInvite({
            inviterId: ctx.user.id,
            contactName: contact.contactName,
            contactPhone: contact.contactPhone,
            contactEmail: contact.contactEmail,
          });
          results.push({ contactName: contact.contactName, inviteCode });
        }
        return results;
      }),
    myInvites: protectedProcedure.query(async ({ ctx }) => {
      return getMyInvites(ctx.user.id);
    }),
    trackOpen: publicProcedure
      .input(z.object({ inviteCode: z.string() }))
      .mutation(async ({ input }) => {
        await markInviteOpened(input.inviteCode);
        return { ok: true };
      }),
    stats: protectedProcedure.query(async ({ ctx }) => {
      const myInvites = await getMyInvites(ctx.user.id);
      const total = myInvites.length;
      const opened = myInvites.filter(i => i.status === "opened" || i.status === "joined").length;
      const joined = myInvites.filter(i => i.status === "joined").length;
      return { total, opened, joined };
    }),
  }),

  // ─── Trivia Game ────────────────────────────────────────────────────────────
  trivia: router({
    getQuestions: publicProcedure
      .input(z.object({ category: z.string().optional(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        return getTriviaQuestions(input.category, input.limit ?? 30);
      }),

    createRoom: protectedProcedure
      .input(z.object({ maxPlayers: z.number().min(1).max(8).default(8) }))
      .mutation(async ({ ctx, input }) => {
        const room = await createTriviaRoom(ctx.user.id, input.maxPlayers);
        if (!room) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create room' });
        // Auto-join as host
        await joinTriviaRoom(room.id, ctx.user.id);
        return room;
      }),

    joinRoom: protectedProcedure
      .input(z.object({ gameCode: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const room = await getTriviaRoomByCode(input.gameCode.toUpperCase());
        if (!room) throw new TRPCError({ code: 'NOT_FOUND', message: 'Room not found' });
        if (room.status !== 'waiting') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Game already started' });
        const players = await getTriviaRoomPlayers(room.id);
        if (players.length >= room.maxPlayers) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Room is full' });
        const player = await joinTriviaRoom(room.id, ctx.user.id);
        return { room, player };
      }),

    getRoom: protectedProcedure
      .input(z.object({ roomId: z.number() }))
      .query(async ({ input }) => {
        const room = await getTriviaRoomById(input.roomId);
        if (!room) throw new TRPCError({ code: 'NOT_FOUND', message: 'Room not found' });
        const players = await getTriviaRoomPlayers(room.id);
        return { room, players };
      }),

    getOpenRooms: publicProcedure.query(async () => {
      return getOpenTriviaRooms();
    }),

    setReady: protectedProcedure
      .input(z.object({ roomId: z.number(), isReady: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        await setPlayerReady(input.roomId, ctx.user.id, input.isReady);
        // Check if all players are ready and auto-start
        const players = await getTriviaRoomPlayers(input.roomId);
        const room = await getTriviaRoomById(input.roomId);
        if (room && room.status === 'waiting' && players.length >= 1 && players.every(p => p.isReady)) {
          await updateTriviaRoom(input.roomId, { status: 'in_progress', startedAt: new Date() });
        }
        return { ok: true };
      }),

    startRoom: protectedProcedure
      .input(z.object({ roomId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const room = await getTriviaRoomById(input.roomId);
        if (!room) throw new TRPCError({ code: 'NOT_FOUND', message: 'Room not found' });
        if (room.hostUserId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN', message: 'Only host can start' });
        await updateTriviaRoom(input.roomId, { status: 'in_progress', startedAt: new Date() });
        return { ok: true };
      }),

    submitAnswer: protectedProcedure
      .input(z.object({
        roomId: z.number(),
        questionId: z.number(),
        answer: z.enum(['A', 'B', 'C', 'D']),
        answeredAtMs: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const question = await getTriviaQuestionById(input.questionId);
        if (!question) throw new TRPCError({ code: 'NOT_FOUND', message: 'Question not found' });
        const isCorrect = question.correctAnswer === input.answer;
        const result = await submitTriviaAnswer(
          input.roomId, ctx.user.id, input.questionId,
          input.answer, isCorrect, input.answeredAtMs
        );
        // Extract profile trait if question has one
        if (question.profileTraitKey && isCorrect) {
          await mergeGameTraitsIntoProfile(ctx.user.id, {
            [question.profileTraitKey]: question.category,
          });
        }
        return { isCorrect, correctAnswer: question.correctAnswer, result };
      }),

    getAnswers: protectedProcedure
      .input(z.object({ roomId: z.number(), questionId: z.number().optional() }))
      .query(async ({ input }) => {
        return getTriviaAnswersForRoom(input.roomId, input.questionId);
      }),

    advanceQuestion: protectedProcedure
      .input(z.object({ roomId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const room = await getTriviaRoomById(input.roomId);
        if (!room) throw new TRPCError({ code: 'NOT_FOUND', message: 'Room not found' });
        if (room.hostUserId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN', message: 'Only host can advance' });
        const questionIds = (room.questionIds as number[]) ?? [];
        const nextIndex = (room.currentQuestionIndex ?? 0) + 1;
        if (nextIndex >= questionIds.length) {
          await updateTriviaRoom(input.roomId, { status: 'completed', completedAt: new Date() });
          return { done: true, nextIndex };
        }
        await updateTriviaRoom(input.roomId, { currentQuestionIndex: nextIndex });
        return { done: false, nextIndex };
      }),

    // ─── Game Chat ─────────────────────────────────────────────────────────
    sendChat: protectedProcedure
      .input(z.object({ roomId: z.number(), content: z.string().max(500) }))
      .mutation(async ({ ctx, input }) => {
        return sendGameChatMessage(input.roomId, ctx.user.id, input.content, 'trivia');
      }),

    getChat: protectedProcedure
      .input(z.object({ roomId: z.number(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        return getGameChatMessages(input.roomId, input.limit ?? 50);
      }),
  }),

  family: router({
    getProfile: protectedProcedure
      .query(async ({ ctx }) => {
        return getFamilyProfileByUserId(ctx.user.id);
      }),

    setup: protectedProcedure
      .input(z.object({
        familyName: z.string().min(1),
        bio: z.string().optional(),
        neighborhoodCity: z.string(),
        interests: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const profile = await getOrCreateFamilyProfile(ctx.user.id);
        if (!profile) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await updateFamilyProfile(ctx.user.id, {
          familyName: input.familyName,
          bio: input.bio,
          neighborhoodCity: input.neighborhoodCity,
          interests: input.interests,
          isActive: true,
        });
        return { success: true };
      }),

    addChild: protectedProcedure
      .input(z.object({
        ageYears: z.number().min(0).max(25),
        gender: z.enum(["boy", "girl", "nonbinary", "prefer_not_to_say"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const profile = await getOrCreateFamilyProfile(ctx.user.id);
        if (!profile) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await addFamilyChild(profile.id, input.ageYears, input.gender);
        return { success: true };
      }),

    removeChild: protectedProcedure
      .input(z.object({ childId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const profile = await getOrCreateFamilyProfile(ctx.user.id);
        if (!profile) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await removeFamilyChild(input.childId, profile.id);
        return { success: true };
      }),

    getChildren: protectedProcedure
      .query(async ({ ctx }) => {
        const profile = await getOrCreateFamilyProfile(ctx.user.id);
        if (!profile) return [];
        return getFamilyChildren(profile.id);
      }),

    findMatches: protectedProcedure
      .input(z.object({
        maxDistance: z.number().optional(),
        minChildAge: z.number().optional(),
        maxChildAge: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const profile = await getOrCreateFamilyProfile(ctx.user.id);
        if (!profile) return [];
        const children = await getFamilyChildren(profile.id);
        const childAges = children.map(c => c.ageYears);
        const minAge = input.minChildAge ?? Math.min(...childAges, 0);
        const maxAge = input.maxChildAge ?? Math.max(...childAges, 18);
        const db = await getDb();
        if (!db) return [];
        const matches = await db.select().from(familyProfiles)
          .where(and(
            ne(familyProfiles.id, profile.id),
            eq(familyProfiles.isActive, true)
          ))
          .limit(20);
        return matches;
      }),

    getFamilyEvents: protectedProcedure
      .input(z.object({
        lat: z.number().optional(),
        lng: z.number().optional(),
        maxDistanceKm: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const profile = await getOrCreateFamilyProfile(ctx.user.id);
        if (!profile) return [];
        const db = await getDb();
        if (!db) return [];
        const events = await db.select().from(communityEvents)
          .where(and(
            eq(communityEvents.isOnCampus, false),
            or(
              eq(communityEvents.source, 'milwaukee_library'),
              eq(communityEvents.source, 'waukesha_library')
            )
          ))
          .orderBy(communityEvents.eventDate)
          .limit(50);
        return events;
      }),

    connectFamily: protectedProcedure
      .input(z.object({ otherFamilyId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const profile = await getOrCreateFamilyProfile(ctx.user.id);
        if (!profile) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await connectFamilies(profile.id, input.otherFamilyId);
        return { success: true };
      }),

    getTripPlans: protectedProcedure
      .query(async ({ ctx }) => {
        return getTripPlans(ctx.user.id);
      }),

    createTripPlan: protectedProcedure
      .input(z.object({
        title: z.string().min(1),
        tripDate: z.string(),
        city: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await createTripPlan(ctx.user.id, input.title, input.tripDate, input.city, input.notes);
        return result || { success: false };
      }),

    updateTripPlan: protectedProcedure
      .input(z.object({
        planId: z.number(),
        title: z.string().optional(),
        tripDate: z.string().optional(),
        city: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const data: any = {};
        if (input.title) data.title = input.title;
        if (input.tripDate) data.tripDate = input.tripDate;
        if (input.city) data.city = input.city;
        if (input.notes) data.notes = input.notes;
        await updateTripPlan(input.planId, ctx.user.id, data);
        return { success: true };
      }),

    deleteTripPlan: protectedProcedure
      .input(z.object({ planId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteTripPlan(input.planId, ctx.user.id);
        return { success: true };
      }),

    addTripItem: protectedProcedure
      .input(z.object({
        planId: z.number(),
        title: z.string().min(1),
        type: z.enum(["activity", "event", "venue", "custom"]),
        time: z.string().optional(),
        location: z.string().optional(),
        url: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const item = {
          id: Date.now().toString(),
          title: input.title,
          type: input.type,
          time: input.time,
          location: input.location,
          url: input.url,
          notes: input.notes,
        };
        await addTripItem(input.planId, ctx.user.id, item);
        return { success: true };
      }),

    removeTripItem: protectedProcedure
      .input(z.object({ planId: z.number(), itemId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await removeTripItem(input.planId, ctx.user.id, input.itemId);
        return { success: true };
      }),
  }),

  jeopardy: jeopardyRouter,
  triviaPursuit: triviaPursuitRouter,
  bullgerdash: bullgerdashRouter,
  watchParty: watchPartyRouter,
  sportsScores: sportsScoresRouter,
  gym: gymRouter,
  workout: workoutRouter,
  homepage: router({
    /** Get the current user's saved homepage layout */
    getLayout: protectedProcedure.query(async ({ ctx }) => {
      const rows = await getHomepageLayout(ctx.user.id);
      return { modules: rows };
    }),

    /** Save (upsert) the current user's homepage layout */
    saveLayout: protectedProcedure
      .input(z.object({
        modules: z.array(z.object({
          moduleId: z.string().min(1).max(64),
          position: z.number().int().min(0),
          pinned: z.boolean(),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        await saveHomepageLayout(ctx.user.id, input.modules);
        return { success: true };
      }),

    getTodaysPlan: protectedProcedure.query(({ ctx }) => getTodaysPlan(ctx.user.id)),

    saveTodaysPlan: protectedProcedure
      .input(z.object({
        eventId: z.number().int().positive().nullable().optional(),
        activityId: z.number().int().positive().nullable().optional(),
        note: z.string().max(255).nullable().optional(),
      }))
      .mutation(({ input, ctx }) => saveTodaysPlan(ctx.user.id, input)),

    clearTodaysPlan: protectedProcedure.mutation(async ({ ctx }) => {
      await clearTodaysPlan(ctx.user.id);
      return { success: true };
    }),
  }),

  advertising: router({
    // Public: submit an inquiry
    submitInquiry: publicProcedure
      .input(z.object({
        businessName: z.string().min(1),
        contactName: z.string().min(1),
        contactEmail: z.string().email(),
        contactPhone: z.string().optional(),
        website: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        tier: z.enum(["basic", "featured", "sponsored_event", "premium"]),
        tagline: z.string().optional(),
        promoText: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const { adPartners } = await import("../drizzle/schema");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        await db.insert(adPartners).values({
          businessName: input.businessName,
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          website: input.website,
          address: input.address,
          city: input.city,
          state: input.state,
          tier: input.tier,
          tagline: input.tagline,
          promoText: input.promoText,
          status: "inquiry",
        });
        return { success: true };
      }),

    // Admin: list all partners/inquiries
    list: protectedProcedure
      .input(z.object({ status: z.enum(["inquiry", "active", "paused", "cancelled", "all"]).optional() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const { adPartners } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) return [];
        if (input.status && input.status !== "all") {
          return db.select().from(adPartners).where(eq(adPartners.status, input.status)).orderBy(adPartners.inquiredAt);
        }
        return db.select().from(adPartners).orderBy(adPartners.inquiredAt);
      }),

    // Admin: update partner status/details
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["inquiry", "active", "paused", "cancelled"]).optional(),
        tier: z.enum(["basic", "featured", "sponsored_event", "premium"]).optional(),
        monthlyRate: z.number().optional(),
        billingNotes: z.string().optional(),
        adminNotes: z.string().optional(),
        tagline: z.string().optional(),
        logoUrl: z.string().optional(),
        promoText: z.string().optional(),
        // Banner ad fields
        bannerImageUrl: z.string().optional(),
        bannerLinkUrl: z.string().optional(),
        bannerHeadline: z.string().max(100).optional(),
        bannerCta: z.string().max(50).optional(),
        bannerPages: z.string().optional(), // comma-separated: home,activities,community,activity_board
        // Geofenced reach
        venueLat: z.number().optional(),
        venueLng: z.number().optional(),
        bannerReachMiles: z.number().optional(), // 15=Local, 50=Regional, 999=Statewide
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const { adPartners } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { id, ...updates } = input;
        const patch: Record<string, unknown> = { ...updates, updatedAt: new Date() };
        if (updates.status === "active") patch.activatedAt = new Date();
        await db.update(adPartners).set(patch).where(eq(adPartners.id, id));
        return { success: true };
      }),

    // Admin: delete a partner
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const { adPartners } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        await db.delete(adPartners).where(eq(adPartners.id, input.id));
        return { success: true };
      }),

    // Public: get active featured partners for a city (for Activity Board badges)
    getFeaturedPartners: publicProcedure
      .input(z.object({ city: z.string().optional() }))
      .query(async ({ input }) => {
        const { getDb } = await import("./db");
        const { adPartners } = await import("../drizzle/schema");
        const { eq, or, and, inArray } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) return [];
        return db.select().from(adPartners).where(
          and(
            inArray(adPartners.status, ["active"]),
            inArray(adPartners.tier, ["featured", "premium", "sponsored_event"])
          )
        );
      }),

    // Get active banner ads for a specific page slot
    getBanners: publicProcedure
      .input(z.object({
        page: z.enum(["home", "activities", "community", "activity_board", "gym_buddy", "gym_detail"]),
        userLat: z.number().optional(),
        userLng: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const { getDb } = await import("./db");
        const { adPartners } = await import("../drizzle/schema");
        const { and, inArray } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) return [];
        const active = await db.select().from(adPartners).where(
          and(
            inArray(adPartners.status, ["active"]),
            inArray(adPartners.tier, ["featured", "premium", "sponsored_event"])
          )
        );
        // Haversine distance in miles between two lat/lng points
        function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
          const R = 3958.8; // Earth radius in miles
          const dLat = (lat2 - lat1) * Math.PI / 180;
          const dLng = (lng2 - lng1) * Math.PI / 180;
          const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
          return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        }
        return active
          .filter(p => {
            // Must have some banner content
            if (!p.bannerImageUrl && !p.bannerHeadline) return false;
            // Filter to partners whose bannerPages includes this page (or is null/empty = all pages)
            if (p.bannerPages) {
              const pages = p.bannerPages.split(",").map(s => s.trim());
              if (!pages.includes(input.page)) return false;
            }
            // Geofence check: if venue has lat/lng and user has lat/lng, apply reach radius
            if (p.venueLat != null && p.venueLng != null && input.userLat != null && input.userLng != null) {
              const dist = haversineMiles(input.userLat, input.userLng, p.venueLat, p.venueLng);
              const reach = p.bannerReachMiles ?? 15;
              if (reach < 999 && dist > reach) return false; // 999 = statewide, no limit
            }
            return true;
          });
      }),
  }),

  pickPlan: router({
    start: protectedProcedure
      .input(z.object({ matchId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const match = await getMatchById(input.matchId);
        if (!match || match.status !== "active" || !isMatchParticipant(match, ctx.user.id)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Pick a Plan is available only to the two members of an active match." });
        }
        const otherMemberId = match.user1Id === ctx.user.id ? match.user2Id : match.user1Id;
        if (await isBlockInEffect(ctx.user.id, otherMemberId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "This activity is unavailable for this match." });
        }
        const activeRound = await getActivePickPlanRoundForMatch(match.id);
        if (activeRound) return { roundId: activeRound.id };
        const [myProfile, otherProfile] = await Promise.all([
          getProfileByUserId(ctx.user.id),
          getProfileByUserId(otherMemberId),
        ]);
        const city = myProfile?.city ?? otherProfile?.city;
        if (!city) throw new TRPCError({ code: "BAD_REQUEST", message: "Add a city to your profile before starting Pick a Plan." });
        const candidates = (await getCommunityEvents({ city, limit: 30 }))
          .filter((event) => isEligiblePublicEventProposal(event))
          .slice(0, 3);
        if (candidates.length < 2) {
          throw new TRPCError({ code: "NOT_FOUND", message: "There are not enough current public events nearby to start a plan yet." });
        }
        const round = await createPickPlanRound({
          matchId: match.id,
          creatorId: ctx.user.id,
          candidateEventIds: candidates.map((event) => event.id),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
        return { roundId: round.id };
      }),

    get: protectedProcedure
      .input(z.object({ roundId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const payload = await getPickPlanRound(input.roundId);
        if (!payload) throw new TRPCError({ code: "NOT_FOUND", message: "Pick a Plan round not found." });
        const match = await getMatchById(payload.round.matchId);
        if (!match || !isMatchParticipant(match, ctx.user.id)) throw new TRPCError({ code: "FORBIDDEN" });
        const otherMemberId = match.user1Id === ctx.user.id ? match.user2Id : match.user1Id;
        if (await isBlockInEffect(ctx.user.id, otherMemberId)) throw new TRPCError({ code: "FORBIDDEN" });
        return toPickPlanViewerPayload(payload, ctx.user.id, otherMemberId);
      }),

    vote: protectedProcedure
      .input(z.object({ roundId: z.number().int().positive(), eventId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await getPickPlanRound(input.roundId);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Pick a Plan round not found." });
        const match = await getMatchById(existing.round.matchId);
        if (!match || match.status !== "active" || !isMatchParticipant(match, ctx.user.id)) throw new TRPCError({ code: "FORBIDDEN" });
        const otherMemberId = match.user1Id === ctx.user.id ? match.user2Id : match.user1Id;
        if (await isBlockInEffect(ctx.user.id, otherMemberId)) throw new TRPCError({ code: "FORBIDDEN" });
        const candidate = existing.candidates.find((event) => event.id === input.eventId);
        if (!isEligiblePublicEventProposal(candidate)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a current public event from this round." });
        }
        await recordPickPlanVote({ roundId: input.roundId, userId: ctx.user.id, eventId: input.eventId });
        const revealed = await revealPickPlanMatch(input.roundId, [match.user1Id, match.user2Id]);
        if (!revealed) throw new TRPCError({ code: "NOT_FOUND" });
        return toPickPlanViewerPayload(revealed, ctx.user.id, otherMemberId);
      }),
  }),

  outreach: router({
    eligibleVenues: adminProcedure.query(async () => {
      const venues = await getVenuePartners();
      return venues.filter((venue) => venue.isActive && Boolean(venue.contactEmail)).map((venue) => ({
        id: venue.id,
        name: venue.name,
        city: venue.city,
        contactEmail: venue.contactEmail!,
      }));
    }),
    history: adminProcedure.input(z.object({ venueId: z.number().int().positive() })).query(async ({ input }) => getVenueOutreachHistory(input.venueId)),
    send: adminProcedure.input(z.object({
      venueId: z.number().int().positive(),
      subject: z.string().trim().min(3).max(500),
      body: z.string().trim().min(10).max(20_000),
      confirmed: z.literal(true),
    })).mutation(async ({ input, ctx }) => {
      const venue = await getVenueById(input.venueId);
      if (!venue?.isActive || !venue.contactEmail) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This active venue needs an official contact email before outreach can be sent." });
      const result = await sendVerifiedOutreachEmail({ to: venue.contactEmail, subject: input.subject, body: input.body });
      const record = await createVenueOutreachRecord({
        venueId: venue.id,
        sentByUserId: ctx.user.id,
        toEmail: venue.contactEmail,
        fromEmail: process.env.OUTREACH_FROM_EMAIL ?? null,
        subject: input.subject,
        body: input.body,
        status: result.ok ? "sent" : "failed",
        providerMessageId: result.ok ? result.providerMessageId : null,
        errorMessage: result.ok ? null : result.errorMessage,
      });
      if (!result.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Delivery failed and was recorded: ${result.errorMessage}` });
      return { record, fromEmail: process.env.OUTREACH_FROM_EMAIL ?? null };
    }),
  }),

  sharedQuestionAdmin: router({
    list: adminProcedure
      .input(z.object({ status: z.enum(["draft", "approved", "published", "retired"]).optional() }).optional())
      .query(async ({ input }) => getSharedQuestionsForEditorialReview(input?.status)),

    createDraft: adminProcedure
      .input(z.object({
        prompt: z.string().trim().min(5).max(4_000),
        format: z.enum(["would_you_rather", "multiple_choice", "free_response", "visual"]),
        category: z.string().trim().min(2).max(100),
        difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
        optionA: z.string().trim().max(300).optional(),
        optionB: z.string().trim().max(300).optional(),
        optionC: z.string().trim().max(300).optional(),
        optionD: z.string().trim().max(300).optional(),
        canonicalAnswer: z.string().trim().max(500).optional(),
        acceptedAnswers: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
        imageUrl: z.string().url().max(1000).optional(),
        sourceUrl: z.string().url().max(1000).optional(),
        license: z.string().trim().max(255).optional(),
        attribution: z.string().trim().max(4_000).optional(),
        gameTargets: z.array(z.object({ gameType: z.enum(SHARED_GAME_TYPES), gameConfig: z.record(z.string(), z.unknown()).optional() })).min(1).max(6),
      }))
      .mutation(async ({ input }) => createSharedQuestionDraft(input)),

    approve: adminProcedure
      .input(z.object({ questionId: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const question = await getSharedQuestionForEditorialReview(input.questionId);
        if (!question) throw new TRPCError({ code: "NOT_FOUND", message: "Shared question not found." });
        if (question.contentStatus !== "draft") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Only draft questions can be approved." });
        assertSharedQuestionReadyForApproval(question);
        return setSharedQuestionStatus(question.id, "approved");
      }),

    publish: adminProcedure
      .input(z.object({ questionId: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const question = await getSharedQuestionForEditorialReview(input.questionId);
        if (!question) throw new TRPCError({ code: "NOT_FOUND", message: "Shared question not found." });
        if (question.contentStatus !== "approved") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A question must be approved before publication." });
        assertSharedQuestionReadyForApproval(question);
        return setSharedQuestionStatus(question.id, "published");
      }),

    retire: adminProcedure
      .input(z.object({ questionId: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const question = await getSharedQuestionForEditorialReview(input.questionId);
        if (!question) throw new TRPCError({ code: "NOT_FOUND", message: "Shared question not found." });
        if (question.contentStatus === "draft") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Drafts can be deleted or revised instead of retired." });
        return setSharedQuestionStatus(question.id, "retired");
      }),
  }),

  // Published questions only. Canonical and accepted answers intentionally stay
  // server-side so clients cannot inspect answers before a game evaluates them.
  sharedQuestions: router({
    listForGame: protectedProcedure
      .input(z.object({
        gameType: z.enum(["would_you_rather", "trivia", "jeopardy", "trivia_pursuit", "bullgerdash", "pick_a_plan"]),
        category: z.string().trim().min(1).max(100).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      }))
      .query(async ({ input }) => getPublishedSharedQuestionsForGame(input.gameType, input)),
  }),
});

export type AppRouter = typeof appRouter;

// ─── Helper functions ─────────────────────────────────────────────────────────

export function toPickPlanViewerPayload(
  payload: NonNullable<Awaited<ReturnType<typeof getPickPlanRound>>>,
  viewerId: number,
  otherMemberId: number,
) {
  const myVoteEventId = payload.votes.find((vote) => vote.userId === viewerId)?.eventId ?? null;
  const partnerSubmitted = payload.votes.some((vote) => vote.userId === otherMemberId);
  const matchedEvent = payload.round.status === "matched"
    ? payload.candidates.find((event) => event.id === payload.round.matchedEventId) ?? null
    : null;

  return {
    round: {
      id: payload.round.id,
      matchId: payload.round.matchId,
      status: payload.round.status,
      expiresAt: payload.round.expiresAt,
      myVoteEventId,
      partnerSubmitted,
      matchedEvent,
    },
    candidates: payload.candidates,
  };
}

export function assertSharedQuestionReadyForApproval(question: NonNullable<Awaited<ReturnType<typeof getSharedQuestionForEditorialReview>>>) {
  if (question.targets.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose at least one compatible game target." });
  if (question.targets.some((target) => !isSharedQuestionFormatEligible(question.format, target.gameType))) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "One or more game targets do not support this question format." });
  }
  if (question.format === "would_you_rather" && (!question.optionA || !question.optionB)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Would You Rather questions need both answer options." });
  }
  if (question.format === "multiple_choice" && (!question.optionA || !question.optionB || !question.optionC || !question.optionD || !question.canonicalAnswer)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Multiple-choice questions need four options and a canonical answer." });
  }
  if ((question.format === "free_response" || question.format === "visual") && !question.canonicalAnswer) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "This question format needs a canonical answer before approval." });
  }
  if (question.format === "visual" && (!question.imageUrl || !question.sourceUrl || !question.license || !question.attribution)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Visual questions need image provenance, license, and attribution before approval." });
  }
}

async function generateFollowUpQuestion(traits: ProfileTraits, interviewCount: number): Promise<string> {
  const covered = Object.keys(traits);
  const topics = ["travel dreams", "childhood memories", "bucket list", "quirky habits", "values", "friendship style", "sense of humor"];
  const uncovered = topics.filter(t => !covered.some(c => c.toLowerCase().includes(t.split(" ")[0]!)));
  const topic = uncovered[interviewCount % uncovered.length] || topics[0]!;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "You are Sally from Just Putzit. Generate ONE fun, open-ended interview question about the given topic. Keep it warm and conversational. Return just the question text.",
      },
      { role: "user", content: `Topic: ${topic}. Existing profile: ${JSON.stringify(traits)}` },
    ],
  });
  return (response.choices[0]?.message?.content as string) || "What's something that always makes you smile?";
}

async function extractTraitsFromInterview(messages: InterviewMessage[], existingTraits: ProfileTraits): Promise<ProfileTraits> {
  const conversation = messages.map(m => `${m.role}: ${m.content}`).join("\n");

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `Extract personality traits and preferences from this interview conversation. Return a JSON object with relevant fields like hobbies, favoriteActivities, personalityKeywords, dreamVacation, favoriteFood, morningOrNight, biggestPetPeeve, guiltPleasure, idealWeekend, funFact, lookingFor, idealDate, perfectSunday. Only include fields that were actually discussed.`,
      },
      { role: "user", content: conversation },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "profile_traits",
        strict: false,
        schema: {
          type: "object",
          properties: {
            hobbies: { type: "array", items: { type: "string" } },
            favoriteActivities: { type: "array", items: { type: "string" } },
            personalityKeywords: { type: "array", items: { type: "string" } },
            dreamVacation: { type: "string" },
            favoriteFood: { type: "string" },
            morningOrNight: { type: "string" },
            biggestPetPeeve: { type: "string" },
            guiltPleasure: { type: "string" },
            idealWeekend: { type: "string" },
            funFact: { type: "string" },
            lookingFor: { type: "string" },
            idealDate: { type: "string" },
            perfectSunday: { type: "string" },
          },
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content as string | undefined;
  try {
    return JSON.parse(typeof content === "string" ? content : "{}");
  } catch {
    return {};
  }
}

async function extractIdentityFromInterview(messages: InterviewMessage[]): Promise<{
  gender?: string;
  sexualOrientation?: string;
  birthDate?: string; // YYYY-MM-DD
}> {
  const conversation = messages.map(m => `${m.role}: ${m.content}`).join("\n");
  const genderValues = ["man", "woman", "non_binary", "other", "prefer_not_to_say"];
  const orientationValues = ["straight", "gay", "lesbian", "bisexual", "pansexual", "asexual", "queer", "other", "prefer_not_to_say"];

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `Extract identity information from this interview conversation. Look for mentions of gender identity, sexual orientation, and birth year/age. Return a JSON object. For gender use one of: ${genderValues.join(", ")}. For sexualOrientation use one of: ${orientationValues.join(", ")}. For birthdate, if the user mentions their age or birth year, calculate the approximate birthdate as an ISO date string (e.g. "1990-01-01"). Only include fields that were clearly mentioned.`,
      },
      { role: "user", content: conversation },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "identity_extract",
        strict: false,
        schema: {
          type: "object",
          properties: {
            gender: { type: "string" },
            sexualOrientation: { type: "string" },
            birthdate: { type: "string" },
          },
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content as string | undefined;
  try {
    const parsed = JSON.parse(typeof content === "string" ? content : "{}");
    const result: { gender?: string; sexualOrientation?: string; birthDate?: string } = {};
    if (genderValues.includes(parsed.gender)) result.gender = parsed.gender;
    if (orientationValues.includes(parsed.sexualOrientation)) result.sexualOrientation = parsed.sexualOrientation;
    if (parsed.birthdate) {
      // Accept YYYY-MM-DD or ISO string, store as YYYY-MM-DD
      const d = new Date(parsed.birthdate);
      if (!isNaN(d.getTime())) result.birthDate = d.toISOString().split('T')[0];
    }
    return result;
  } catch {
    return {};
  }
}

async function generateProfileSummary(
  traits: ProfileTraits,
  userName: string,
  interviewMessages?: InterviewMessage[],
  priorSummary?: string,
): Promise<string> {
  const interviewResponses = (interviewMessages ?? [])
    .filter((message) => message.role === "user")
    .map((message) => message.content);
  const evidence = buildProfileSummaryEvidence(traits, interviewResponses);
  if (evidence.facts.length === 0) return priorSummary ?? "";

  const systemPrompt = `You are Sally from Just Putzit. Write an honest 1-3 sentence profile summary for ${userName}.

You may use ONLY the factual member evidence supplied below. The summary must include at least two concrete details or phrases from that evidence whenever two are available. Do not invent traits, hobbies, relationships, activities, or personality claims. Avoid hype, generic praise, dating-app clichés, and unsupported labels such as "adventurous," "incredible," "vibrant," or "infectious." Write in a warm, straightforward voice that sounds like someone who actually listened. Output only the summary—no heading, label, quotation marks, or emoji.`;

  const userContent = `Member evidence (use only these details):\n- ${evidence.facts.join("\n- ")}`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
  });
  const candidate = response.choices[0]?.message?.content as string | undefined;
  const cleanCandidate = typeof candidate === "string" ? candidate.trim() : "";
  if (isEvidenceGroundedProfileSummary(cleanCandidate, evidence)) {
    return cleanCandidate;
  }

  // A weak draft must never replace a stronger existing member summary.
  return priorSummary ?? "";
}

// ─── Game-to-Profile Intelligence ─────────────────────────────────────────────
// Unified helper: given a game type and the raw gameplay data, ask Sally to
// extract personality signals and merge them into the user's profile.
// This is always called fire-and-forget (no await at call site) so it never
// blocks the response to the player.

interface GameplaySignal {
  gameType: "wyr" | "trivia" | "icebreaker" | "two_truths" | "this_or_that" | "lobby_game";
  // For WYR: the question text + chosen option text
  questionText?: string;
  chosenOptionText?: string;
  // For lobby / match games: array of {question, answer} pairs
  qaItems?: { question: string; answer: string }[];
}

async function extractTraitsFromGameplay(signal: GameplaySignal): Promise<Partial<ProfileTraits>> {
  let userContent = "";
  if (signal.gameType === "wyr") {
    userContent = `The player explicitly selected this option: "${signal.chosenOptionText}"\n\nQuestion context: "${signal.questionText}"`;
  } else if (signal.qaItems && signal.qaItems.length > 0) {
    const pairs = signal.qaItems.map(q => `Q: ${q.question}\nA: ${q.answer}`).join("\n\n");
    userContent = `Game type: ${signal.gameType}. Here are the player's answers:\n\n${pairs}\n\nWhat personality traits, interests, or values do these answers reveal?`;
  } else {
    return {};
  }

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: signal.gameType === "wyr"
            ? `You are Sally from Just Putzit. A single Would You Rather selection establishes only a direct preference, never a personality trait. Return JSON with favoriteActivities, interests, and values arrays. Each entry must be a 1-6 word phrase copied exactly from the selected option. If no direct preference phrase is safe to retain, return empty arrays. Never infer labels such as adventurous, extrovert, funny, competitive, or anything not literally present in the selected option.`
            : `You are Sally from Just Putzit. Analyze this gameplay data and extract personality insights. Return a JSON object with any of these fields that are revealed: hobbies (array), favoriteActivities (array), personalityKeywords (array), interests (array), values (array), competitiveStyle (string: "very_competitive"|"casual"|"just_for_fun"), humorStyle (string), adventurousness (string: "low"|"medium"|"high"), socialStyle (string: "introvert"|"extrovert"|"ambivert"). Only include fields with clear evidence.`,
        },
        { role: "user", content: userContent },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "game_traits",
          strict: false,
          schema: {
            type: "object",
            properties: {
              hobbies: { type: "array", items: { type: "string" } },
              favoriteActivities: { type: "array", items: { type: "string" } },
              personalityKeywords: { type: "array", items: { type: "string" } },
              interests: { type: "array", items: { type: "string" } },
              values: { type: "array", items: { type: "string" } },
              competitiveStyle: { type: "string" },
              humorStyle: { type: "string" },
              adventurousness: { type: "string" },
              socialStyle: { type: "string" },
            },
            additionalProperties: false,
          },
        },
      },
    });
    const content = response.choices[0]?.message?.content as string | undefined;
    const parsed = JSON.parse(typeof content === "string" ? content : "{}");
    return signal.gameType === "wyr"
      ? sanitizeWyrProfileInsights(parsed, signal.chosenOptionText ?? "")
      : parsed;
  } catch {
    return {};
  }
}

async function mergeGameTraitsIntoProfile(userId: number, newTraits: Partial<ProfileTraits>): Promise<{ updated: boolean; learnedTraits: string[] }> {
  if (!newTraits || Object.keys(newTraits).length === 0) return { updated: false, learnedTraits: [] };
  try {
    const profile = await getProfileByUserId(userId);
    const existing: ProfileTraits = (profile?.traits as ProfileTraits) ?? {};

    // Deep-merge arrays (deduplicate), overwrite scalar fields only if not already set
    const merged: ProfileTraits = { ...existing };
    const learnedTraits: string[] = [];
    for (const [key, value] of Object.entries(newTraits)) {
      if (Array.isArray(value) && value.length > 0) {
        const existingArr: string[] = (existing as Record<string, unknown>)[key] as string[] ?? [];
        const known = new Set(existingArr.map((entry) => entry.toLocaleLowerCase()));
        const additions = value.filter((entry): entry is string => typeof entry === "string" && !known.has(entry.toLocaleLowerCase()));
        if (additions.length > 0) {
          (merged as Record<string, unknown>)[key] = [...existingArr, ...additions];
          learnedTraits.push(...additions);
        }
      } else if (value !== undefined && value !== null && value !== "") {
        // Only overwrite scalar if not already set
        if (!(merged as Record<string, unknown>)[key]) {
          (merged as Record<string, unknown>)[key] = value;
          learnedTraits.push(String(value));
        }
      }
    }

    const uniqueLearnedTraits = Array.from(new Set(learnedTraits.map((trait) => trait.trim()).filter(Boolean)));
    if (uniqueLearnedTraits.length === 0) return { updated: false, learnedTraits: [] };
    await updateProfile(userId, { traits: merged });
    return { updated: true, learnedTraits: uniqueLearnedTraits };
  } catch {
    // Silently fail — never block gameplay
    return { updated: false, learnedTraits: [] };
  }
}
