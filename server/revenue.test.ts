import { describe, expect, it, beforeAll } from "vitest";
import { afterAll } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { activityListings, venuePartners } from "../drizzle/schema";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function makeUser(id: number, name: string): AuthenticatedUser {
  return {
    id,
    openId: `test-user-${id}`,
    email: `user${id}@example.com`,
    name,
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
}

function ctxFor(user: AuthenticatedUser): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {}, cookie: () => {} } as unknown as TrpcContext["res"],
  };
}

// Use a high, stable test user id to avoid clashing with real data.
const VENDOR_USER = makeUser(990001, "Test Vendor");
const GUEST_USER = makeUser(990002, "Test Guest");

describe("vendor portal", () => {
  let venueId: number;
  let listingId: number;

  it("registers a venue owned by the caller", async () => {
    const caller = appRouter.createCaller(ctxFor(VENDOR_USER));
    const venue = await caller.vendor.registerVenue({
      name: "Test Lanes",
      category: "bowling",
      city: "Austin",
      address: "1 Test St",
      contactEmail: "owner@testlanes.com",
      referralFeePerVisit: 300,
    });
    expect(venue).toBeTruthy();
    expect(venue.name).toBe("Test Lanes");
    venueId = venue.id;
    expect(venueId).toBeGreaterThan(0);
  });

  it("adds a listing under the owned venue", async () => {
    const caller = appRouter.createCaller(ctxFor(VENDOR_USER));
    const listing = await caller.vendor.addListing({
      venueId,
      title: "Cosmic Bowling",
      category: "bowling",
      priceDollars: 20,
      hasTickets: true,
      imageEmoji: "🎳",
      description: "Glow-in-the-dark lanes",
    });
    expect(listing.title).toBe("Cosmic Bowling");
    expect(listing.priceCents).toBe(2000);
    listingId = listing.id;
  });

  it("lists the vendor's venues with the new listing", async () => {
    const caller = appRouter.createCaller(ctxFor(VENDOR_USER));
    const venues = await caller.vendor.myVenues();
    const mine = venues.find((v) => v.id === venueId);
    expect(mine).toBeTruthy();
    expect(mine!.listings.some((l) => l.id === listingId)).toBe(true);
  });

  it("prevents adding a listing to a venue you do not own", async () => {
    const caller = appRouter.createCaller(ctxFor(GUEST_USER));
    await expect(
      caller.vendor.addListing({
        venueId,
        title: "Sneaky Listing",
        category: "bowling",
        priceDollars: 5,
        hasTickets: false,
        imageEmoji: "🎳",
      })
    ).rejects.toThrow();
  });
});

describe("marketplace booking", () => {
  let bookableActivityId: number;

  beforeAll(async () => {
    // Ensure there is a vendor-owned listing to book.
    const caller = appRouter.createCaller(ctxFor(VENDOR_USER));
    const venues = await caller.vendor.myVenues();
    const listing = venues.flatMap((v) => v.listings)[0];
    bookableActivityId = listing!.id;
  });

  it("books an activity and returns a confirmation code", async () => {
    const caller = appRouter.createCaller(ctxFor(GUEST_USER));
    const booking = await caller.marketplace.book({
      activityId: bookableActivityId,
      partySize: 2,
    });
    expect(booking).toBeTruthy();
    expect(booking!.confirmationCode).toMatch(/.+/);
    expect(booking!.partySize).toBe(2);
  });

  it("shows the booking in the guest's bookings list", async () => {
    const caller = appRouter.createCaller(ctxFor(GUEST_USER));
    const bookings = await caller.marketplace.myBookings();
    expect(bookings.some((b) => b.activityId === bookableActivityId)).toBe(true);
  });
});

describe("couples network", () => {
  it("creates a couple profile and finds matches without throwing", async () => {
    const caller = appRouter.createCaller(ctxFor(GUEST_USER));
    const couple = await caller.couples.saveCouple({
      partnerName: "Jamie",
      relationshipLength: "2 years",
      sharedInterests: ["Hiking", "Board games"],
      lookingFor: "Fun couples for weekend trips",
    });
    expect(couple).toBeTruthy();

    const mine = await caller.couples.getMyCouple();
    expect(mine?.partnerName).toBe("Jamie");

    // Should resolve (may produce 0 matches) and never throw.
    const res = await caller.couples.findCoupleMatches();
    expect(Array.isArray(res.matches)).toBe(true);
  });

  it("requires a couple profile before matching", async () => {
    const lonelyCaller = appRouter.createCaller(ctxFor(makeUser(990003, "No Couple")));
    await expect(lonelyCaller.couples.findCoupleMatches()).rejects.toThrow();
  });
});

afterAll(async () => {
  const db = await getDb();
  if (!db) return;
  const testVenues = await db.select({ id: venuePartners.id })
    .from(venuePartners)
    .where(eq(venuePartners.contactEmail, "owner@testlanes.com"));
  const testVenueIds = testVenues.map((venue) => venue.id);
  if (testVenueIds.length > 0) {
    await db.update(activityListings).set({ isActive: false }).where(inArray(activityListings.venueId, testVenueIds));
    await db.update(venuePartners).set({ isActive: false }).where(inArray(venuePartners.id, testVenueIds));
  }
});
