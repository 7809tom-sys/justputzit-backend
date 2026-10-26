import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getCampusStats, getCampusLeaderboard, generateInviteCode, recordReferral } from "./db";
import { userProfiles, campuses, referrals } from "../drizzle/schema";
import { eq, or } from "drizzle-orm";

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function getDb2() {
  const mod = await import("./_core/index");
  return mod.db;
}

const TEST_USER_A = 88001;
const TEST_USER_B = 88002;
const CARROLL_ID = 1;

async function setupTestProfiles() {
  const db = await getDb2();
  if (!db) return;
  // Clean up any leftover test data
  await db.delete(referrals).where(or(eq(referrals.inviterUserId, TEST_USER_A), eq(referrals.inviteeUserId, TEST_USER_B)));
  await db.delete(userProfiles).where(or(eq(userProfiles.userId, TEST_USER_A), eq(userProfiles.userId, TEST_USER_B)));
  // Ensure Carroll campus exists
  const [campus] = await db.select().from(campuses).where(eq(campuses.id, CARROLL_ID)).limit(1);
  if (!campus) {
    await db.insert(campuses).values({
      id: CARROLL_ID,
      name: "Carroll University",
      city: "Waukesha",
      state: "WI",
      emailDomains: "carrollu.edu",
      launchThreshold: 100,
      isLive: false,
      colorHex: "#f97316",
    }).onDuplicateKeyUpdate({ set: { name: "Carroll University" } });
  }
  // Insert fresh test profiles
  await db.insert(userProfiles).values([
    { userId: TEST_USER_A, displayName: "Campus Tester A", campusId: CARROLL_ID, isAmbassador: false },
    { userId: TEST_USER_B, displayName: "Campus Tester B", campusId: CARROLL_ID, isAmbassador: false },
  ]);
}

beforeAll(setupTestProfiles);

afterAll(async () => {
  const db = await getDb2();
  if (!db) return;
  await db.delete(referrals).where(or(eq(referrals.inviterUserId, TEST_USER_A), eq(referrals.inviteeUserId, TEST_USER_B)));
  await db.delete(userProfiles).where(or(eq(userProfiles.userId, TEST_USER_A), eq(userProfiles.userId, TEST_USER_B)));
});

describe("campus growth engine", () => {
  it("getCampusStats returns total and threshold for Carroll", async () => {
    const stats = await getCampusStats(CARROLL_ID);
    expect(stats).toHaveProperty("total");
    expect(stats).toHaveProperty("threshold");
    expect(stats.threshold).toBe(100);
    expect(typeof stats.total).toBe("number");
  });

  it("generateInviteCode creates a unique code for a user", async () => {
    const code = await generateInviteCode(TEST_USER_A);
    expect(typeof code).toBe("string");
    expect(code.length).toBeGreaterThan(4);
    expect(code).toMatch(/^JP-/);
  });

  it("recordReferral links invitee to inviter", async () => {
    const db = await getDb2();
    if (!db) return;
    // Self-contained: ensure profiles exist with a known invite code
    await db.delete(referrals).where(or(eq(referrals.inviterUserId, TEST_USER_A), eq(referrals.inviteeUserId, TEST_USER_B)));
    await db.delete(userProfiles).where(or(eq(userProfiles.userId, TEST_USER_A), eq(userProfiles.userId, TEST_USER_B)));
    const testCode = `JP-${TEST_USER_A}-REFTEST`;
    await db.insert(userProfiles).values([
      { userId: TEST_USER_A, displayName: "Campus Tester A", campusId: CARROLL_ID, isAmbassador: false, inviteCode: testCode },
      { userId: TEST_USER_B, displayName: "Campus Tester B", campusId: CARROLL_ID, isAmbassador: false },
    ]);
    const result = await recordReferral(testCode, TEST_USER_B);
    expect(result).toBeTruthy();
  });

  it("getCampusLeaderboard returns correct shape and includes inviter after referral", async () => {
    const db = await getDb2();
    if (!db) return;
    // Fully self-contained: insert fresh profiles, generate code, insert referral directly
    await db.delete(referrals).where(or(eq(referrals.inviterUserId, TEST_USER_A), eq(referrals.inviteeUserId, TEST_USER_B)));
    await db.delete(userProfiles).where(or(eq(userProfiles.userId, TEST_USER_A), eq(userProfiles.userId, TEST_USER_B)));
    const testCode = `JP-${TEST_USER_A}-TESTCD`;
    await db.insert(userProfiles).values([
      { userId: TEST_USER_A, displayName: "Campus Tester A", campusId: CARROLL_ID, isAmbassador: false, inviteCode: testCode },
      { userId: TEST_USER_B, displayName: "Campus Tester B", campusId: CARROLL_ID, isAmbassador: false },
    ]);
    // Insert a referral directly
    await db.insert(referrals).values({
      inviterUserId: TEST_USER_A,
      inviteeUserId: TEST_USER_B,
      inviteCode: testCode,
      campusId: CARROLL_ID,
      status: "joined",
    });
    const board = await getCampusLeaderboard(CARROLL_ID, 50);
    expect(Array.isArray(board)).toBe(true);
    for (const entry of board) {
      expect(entry).toHaveProperty("userId");
      expect(entry).toHaveProperty("referralCount");
      expect(entry).toHaveProperty("displayName");
    }
    const entry = board.find((e) => e.userId === TEST_USER_A);
    expect(entry).toBeDefined();
    expect(entry!.referralCount).toBeGreaterThanOrEqual(1);
  });
});
